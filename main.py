"""
================================================================================
                    PRONUNCHECK FASTAPI BACKEND SERVICE
================================================================================
Dự án: DT3_PronunCheck
Mục đích:
  - Cung cấp REST API đánh giá phát âm tiếng Đức (/api/v1/assess).
  - Tích hợp mô hình Hybrid AI chạy song song đa luồng (ThreadPoolExecutor):
      1. Wav2Vec2 (CTC Forced Alignment / Phoneme-level scoring)
      2. Faster-Whisper (ASR word-level transcription & confidence)
      3. FastDTW (Dynamic Time Warping so sánh với audio chuẩn Google TTS)
  - Tổng hợp kết quả và trả về điểm số chi tiết từng ký tự/âm tiết cho Frontend.
================================================================================
"""

from fastapi import FastAPI, File, UploadFile, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
import uuid
import torch
from concurrent.futures import ThreadPoolExecutor
import uvicorn
import traceback

# Import cấu hình tập trung và module chấm điểm
import config
import scoring

# Thư viện mô hình AI
from faster_whisper import WhisperModel
from faster_whisper.audio import decode_audio
from transformers import Wav2Vec2Processor, Wav2Vec2ForCTC


# ==============================================================================
# 1. CẤU HÌNH PHẦN CỨNG & TẠO THƯ MỤC LƯU TRỮ TẠM
# ==============================================================================
# Thiết lập số luồng tính toán cho PyTorch nếu chạy trên CPU
if config.DEVICE == "cpu" and config.TORCH_CPU_THREADS:
    torch.set_num_threads(config.TORCH_CPU_THREADS)

# Đảm bảo các thư mục upload và audio mẫu luôn tồn tại
os.makedirs(config.UPLOAD_DIR, exist_ok=True)
os.makedirs(config.REFERENCE_AUDIO_DIR, exist_ok=True)

# Khởi tạo ThreadPoolExecutor để chạy song song 3 tác vụ AI (Wav2Vec2, Whisper, DTW) trong cùng 1 request
executor = ThreadPoolExecutor(max_workers=config.PARALLEL_AI_WORKERS)


# ==============================================================================
# 2. KHỞI TẠO CÁC MÔ HÌNH AI (GLOBAL INSTANCES)
# ==============================================================================
print(f"Loading AI models on {config.DEVICE.upper()}...")

# 2.1. Tải mô hình Faster-Whisper (nhận diện văn bản ASR & xác suất từ ngữ)
try:
    whisper_model = WhisperModel(
        config.WHISPER_MODEL_NAME,
        device=config.DEVICE,
        compute_type=config.COMPUTE_TYPE,
        cpu_threads=config.WHISPER_CPU_THREADS,
        num_workers=config.WHISPER_NUM_WORKERS
    )
except Exception as e:
    print(f"Error loading Faster-Whisper: {e}")
    whisper_model = None

# 2.2. Tải mô hình Wav2Vec2 (phân tích âm vị / ký tự chi tiết qua CTC logits)
try:
    w2v_processor = Wav2Vec2Processor.from_pretrained(config.WAV2VEC_MODEL_NAME)
    w2v_model = Wav2Vec2ForCTC.from_pretrained(config.WAV2VEC_MODEL_NAME).to(config.DEVICE)
    w2v_model.eval()  # Chuyển sang chế độ inference (không tính gradient)
    vocab_dict = w2v_processor.tokenizer.get_vocab()
except Exception as e:
    print(f"Error loading Wav2Vec2: {e}")
    w2v_processor, w2v_model, vocab_dict = None, None, None


# ==============================================================================
# 3. QUẢN LÝ VÒNG ĐỜI ỨNG DỤNG (LIFESPAN & WARM-UP)
# ==============================================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Quản lý vòng đời khởi động/tắt của FastAPI app.
    Warm-up model giúp request đầu tiên của người dùng không bị trễ/lag.
    """
    print("Warming up AI models...", flush=True)
    yield
    print("Shutting down backend service...", flush=True)


# ==============================================================================
# 4. KHỞI TẠO FASTAPI APP & CORS MIDDLEWARE
# ==============================================================================
app = FastAPI(
    title="Advanced Pronunciation Assessment",
    version="3.1",
    lifespan=lifespan
)

# Cho phép Frontend (Vercel / Localhost) gọi API mà không bị chặn bởi CORS policy
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==============================================================================
# 5. API ENDPOINT ĐÁNH GIÁ PHÁT ÂM
# ==============================================================================
@app.post("/api/v1/assess")
def assess_pronunciation(
    audio_file: UploadFile = File(..., description="File âm thanh ghi âm từ microphone của học sinh"),
    expected_word: str = Form("Schule", description="Từ mục tiêu cần phát âm (ví dụ: Schule, Tisch...)")
):
    """
    Endpoint chính xử lý file âm thanh và trả về kết quả đánh giá phát âm:
    
    Quy trình xử lý:
      1. Lưu file audio tạm thời vào UPLOAD_DIR với UUID ngẫu nhiên.
      2. Decode file audio về mảng numpy 1D tần số lấy mẫu 16kHz chuẩn.
      3. Gửi đồng thời 3 tác vụ tính điểm vào ThreadPoolExecutor (non-blocking):
         - analyze_precise_score (Wav2Vec2 alignment)
         - analyze_with_whisperx (Whisper ASR)
         - calculate_dtw_score (DTW với Google TTS audio mẫu)
      4. Chờ cả 3 tác vụ hoàn thành (.result()), lấy điểm và nhận diện âm lỗi nhất (worst_char).
      5. Gọi hàm calculate_dynamic_score để tổng hợp điểm số cuối cùng kèm lời khuyên.
      6. Khối `finally` đảm bảo xóa file audio tạm để giải phóng ổ cứng.
    """
    file_path = ""
    try:
        # 1. Trích xuất định dạng và lưu file tạm
        file_extension = audio_file.filename.split(".")[-1].lower() if audio_file.filename else "wav"
        temp_filename = f"{uuid.uuid4()}.{file_extension}"
        file_path = os.path.join(config.UPLOAD_DIR, temp_filename)
        
        with open(file_path, "wb") as buffer:
            buffer.write(audio_file.file.read())

        # 2. Giải mã âm thanh thành mảng float32 16kHz
        audio_array = decode_audio(file_path, sampling_rate=16000)

        # 3. Gửi 3 luồng phân tích song song vào Executor
        future_precise = executor.submit(
            scoring.analyze_precise_score,
            audio_array, expected_word, w2v_model, w2v_processor, vocab_dict
        )
        future_whisper = executor.submit(
            scoring.analyze_with_whisperx,
            audio_array, expected_word, whisper_model
        )
        future_dtw = executor.submit(
            scoring.calculate_dtw_score,
            audio_array, expected_word
        )

        # 4. Thu thập kết quả từ 3 tác vụ
        precise_score, char_scores, worst_char = future_precise.result()
        whisper_score = future_whisper.result()
        dtw_score = future_dtw.result()

        # 5. Tính toán điểm số tổng hợp động và nhận xét
        assessment_result = scoring.calculate_dynamic_score(
            precise_score, whisper_score, dtw_score, expected_word, worst_char
        )

        # 6. Trả về JSON Response cho client
        return JSONResponse(content={
            "status": "success",
            "word": expected_word,
            "char_scores": char_scores,
            "assessment": assessment_result
        })

    except Exception as e:
        err_msg = traceback.format_exc()
        print("API Error:", err_msg, flush=True)
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})
        
    finally:
        # Luôn luôn dọn dẹp file ghi âm tạm thời sau khi xử lý xong
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass


# ==============================================================================
# 6. KHỞI CHẠY TRỰC TIẾP (CHO MÔI TRƯỜNG LOCAL / DEBUG)
# ==============================================================================
if __name__ == "__main__":
    uvicorn.run("main:app", host=config.HOST, port=config.PORT, workers=config.WORKERS)

