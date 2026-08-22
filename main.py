"""
================================================================================
                    PRONUNCHECK FASTAPI BACKEND SERVICE (GATEWAY)
================================================================================
Dự án: DT3_PronunCheck
Kiến trúc: Gateway & API Routing
  - Cung cấp REST API đánh giá phát âm tiếng Đức (/api/v1/assess).
  - Tích hợp mô hình Hybrid AI từ package Light_ScoringBackend:
      1. Wav2Vec2 (CTC Forced Alignment / Phoneme-level scoring + German Phonetics)
      2. Faster-Whisper Tiny (ASR word-level completeness factor)
      3. F0 + FastDTW (Pitch contour intonation matching với Google TTS)
  - Kiến trúc mở: Sẵn sàng định tuyến thêm HuBERT Large IPA Pro Tier.
================================================================================
"""

from fastapi import FastAPI, File, UploadFile, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
import uuid
import numpy as np
import torch
import soundfile as sf
from concurrent.futures import ThreadPoolExecutor
import uvicorn
import traceback

# Import cấu hình và module chấm điểm từ package Light_ScoringBackend
import config
from Light_ScoringBackend import scoring, german_phonetics

# Khởi tạo Sentry SDK (an toàn, không crash nếu chưa pip install)
try:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.starlette import StarletteIntegration

    if getattr(config, "SENTRY_DSN", None):
        sentry_sdk.init(
            dsn=config.SENTRY_DSN,
            environment=getattr(config, "ENVIRONMENT", "production"),
            integrations=[
                FastApiIntegration(),
                StarletteIntegration(),
            ],
            traces_sample_rate=getattr(config, "SENTRY_TRACES_SAMPLE_RATE", 1.0),
            send_default_pii=True,
        )
        print(f"Sentry Backend SDK initialized (Env: {getattr(config, 'ENVIRONMENT', 'production')}).", flush=True)
except ImportError:
    print("Warning: sentry-sdk not installed. Continuing without Sentry monitoring.", flush=True)
except Exception as e:
    print(f"Warning: Sentry init failed ({e}). Continuing without Sentry.", flush=True)

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
print(f"Loading AI models on {config.DEVICE.upper()} (Light Tier Engine)...", flush=True)

# 2.1. Tải mô hình Faster-Whisper Tiny (nhận diện nhanh & tiết kiệm RAM)
try:
    whisper_model = WhisperModel(
        config.WHISPER_MODEL_NAME,
        device=config.DEVICE,
        compute_type=config.COMPUTE_TYPE,
        cpu_threads=config.WHISPER_CPU_THREADS,
        num_workers=config.WHISPER_NUM_WORKERS
    )
    print("Faster-Whisper Tiny loaded successfully.", flush=True)
except Exception as e:
    print(f"Error loading Faster-Whisper: {e}", flush=True)
    whisper_model = None

# 2.2. Tải mô hình Wav2Vec2 (phân tích âm vị / ký tự chi tiết qua CTC logits)
try:
    w2v_processor = Wav2Vec2Processor.from_pretrained(config.WAV2VEC_MODEL_NAME)
    w2v_model = Wav2Vec2ForCTC.from_pretrained(config.WAV2VEC_MODEL_NAME).to(config.DEVICE)
    w2v_model.eval()  # Chuyển sang chế độ inference (không tính gradient)
    vocab_dict = w2v_processor.tokenizer.get_vocab()
    print("Wav2Vec2 model loaded successfully.", flush=True)
except Exception as e:
    print(f"Error loading Wav2Vec2: {e}", flush=True)
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
    print("Warming up AI models with dummy inference...", flush=True)
    try:
        dummy_audio = np.zeros(16000, dtype=np.float32)
        if whisper_model:
            list(whisper_model.transcribe(dummy_audio, language="de", beam_size=1)[0])
        if w2v_model and w2v_processor:
            inputs = w2v_processor(dummy_audio, sampling_rate=16000, return_tensors="pt").to(config.DEVICE)
            with torch.inference_mode():
                _ = w2v_model(**inputs).logits
        scoring.extract_f0_semitones(dummy_audio, sr=16000)
        print("AI Models warm-up complete!", flush=True)
    except Exception as e:
        print(f"Warm-up warning: {e}", flush=True)

    yield
    print("Shutting down backend service...", flush=True)


# ==============================================================================
# 4. KHỞI TẠO FASTAPI APP & CORS MIDDLEWARE
# ==============================================================================
app = FastAPI(
    title="PronunCheck AI Backend Service",
    version="3.5",
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


import time
START_TIME = time.time()


# ==============================================================================
# 5. API ENDPOINTS
# ==============================================================================
@app.get("/")
@app.get("/health")
@app.get("/api/v1/health")
def health_check():
    """
    Endpoint kiểm tra trạng thái sức khỏe toàn diện của Backend Service và các AI Model.
    Không cần đăng nhập client hay gửi file âm thanh vẫn biết server có hoạt động thực sự hay không.
    """
    whisper_ready = whisper_model is not None
    w2v_ready = (w2v_model is not None and w2v_processor is not None)
    all_ready = whisper_ready and w2v_ready
    
    return {
        "status": "healthy" if all_ready else "degraded",
        "service": "PronunCheck AI Backend",
        "version": "3.5",
        "device": config.DEVICE.upper(),
        "compute_type": config.COMPUTE_TYPE,
        "uptime_seconds": round(time.time() - START_TIME, 2),
        "models": {
            "faster_whisper": {
                "loaded": whisper_ready,
                "model_name": config.WHISPER_MODEL_NAME
            },
            "wav2vec2_ctc": {
                "loaded": w2v_ready,
                "model_name": config.WAV2VEC_MODEL_NAME
            },
            "fast_dtw_f0": {
                "loaded": True,
                "method": "pYIN Semitones + Google TTS"
            }
        },
        "ready_for_scoring": all_ready
    }

@app.get("/api/v1/health/selftest")
def health_selftest():
    """
    Tự động thực hiện một chu trình chấm điểm giả lập (Self-Test Inference) 
    để kiểm tra xem toàn bộ pipeline PyTorch, Whisper và DTW có thực sự tính toán được không.
    """
    t0 = time.time()
    try:
        dummy_audio = np.zeros(16000, dtype=np.float32)
        test_word = "Schule"
        
        # Test wav2vec2 alignment
        p_score, char_scores, worst_char = scoring.analyze_precise_score(
            dummy_audio, test_word, w2v_model, w2v_processor, vocab_dict
        )
        # Test whisper
        w_score = scoring.analyze_with_whisperx(dummy_audio, test_word, whisper_model)
        # Test dtw
        dtw_score = scoring.calculate_dtw_score(dummy_audio, test_word)
        # Test dynamic scoring
        res = scoring.calculate_dynamic_score(p_score, w_score, dtw_score, test_word, worst_char)
        
        duration_ms = round((time.time() - t0) * 1000, 2)
        return {
            "status": "success",
            "self_test": "PASSED",
            "inference_duration_ms": duration_ms,
            "test_word": test_word,
            "sample_assessment": res
        }
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "self_test": "FAILED",
                "message": str(e),
                "traceback": traceback.format_exc()
            }
        )

from fastapi.responses import FileResponse

@app.post("/api/v1/denoise")
def denoise_audio_endpoint(
    audio_file: UploadFile = File(..., description="File âm thanh thô từ microphone"),
    noise_level: int = Form(1, description="Mức độ khử ồn (0-4)")
):
    file_path = ""
    out_path = ""
    try:
        file_extension = audio_file.filename.split(".")[-1].lower() if audio_file.filename else "webm"
        temp_filename = f"{uuid.uuid4()}.{file_extension}"
        file_path = os.path.join(config.UPLOAD_DIR, temp_filename)
        out_path = os.path.join(config.UPLOAD_DIR, f"denoised_{uuid.uuid4()}.wav")
        
        with open(file_path, "wb") as buffer:
            buffer.write(audio_file.file.read())
            
        audio_array = decode_audio(file_path, sampling_rate=16000)
        
        # Gọi hàm khử ồn 5 nấc
        denoised_array = scoring.apply_5_level_denoise(audio_array, sr=16000, level=noise_level)
        
        # Lưu ra file wav
        sf.write(out_path, denoised_array, 16000)
        
        return FileResponse(out_path, media_type="audio/wav", filename="denoised.wav")
    except Exception as e:
        print(f"Error in /denoise: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})
    finally:
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass

@app.post("/api/v1/assess")
def assess_pronunciation(
    audio_file: UploadFile = File(..., description="File âm thanh ghi âm từ microphone của học sinh"),
    expected_word: str = Form("Schule", description="Từ hoặc câu mục tiêu cần phát âm")
):
    """
    Endpoint chính xử lý file âm thanh và trả về kết quả đánh giá phát âm:
    
    Quy trình xử lý:
      1. Lưu file audio tạm thời vào UPLOAD_DIR với UUID ngẫu nhiên.
      2. Decode file audio về mảng numpy 1D tần số lấy mẫu 16kHz chuẩn.
      3. Gửi đồng thời 3 tác vụ tính điểm vào ThreadPoolExecutor (non-blocking).
      4. Chờ cả 3 tác vụ hoàn thành (.result()).
      5. Gọi hàm calculate_dynamic_score với công thức trọng số Sigmoid động tuyến tính.
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

        # Ghi nhận Sentry Breadcrumb cho lượt chấm điểm AI
        sentry_sdk.add_breadcrumb(
            category="ai_scoring",
            message=f"Starting AI pronunciation assessment for word: '{expected_word}'",
            level="info",
            data={
                "word": expected_word,
                "audio_samples": len(audio_array),
                "duration_sec": round(len(audio_array) / 16000, 2)
            }
        )

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
        precise_score, char_scores, worst_char, word_timestamps = future_precise.result()
        whisper_score = future_whisper.result()
        dtw_score = future_dtw.result()

        # 5. Tính toán điểm số tổng hợp động và nhận xét sư phạm
        assessment_result = scoring.calculate_dynamic_score(
            precise_score=precise_score,
            whisper_score=whisper_score,
            dtw_score=dtw_score,
            expected_text=expected_word,
            worst_char_info=worst_char,
            char_scores=char_scores
        )

        # 6. Trả về JSON Response cho client
        return JSONResponse(content={
            "status": "success",
            "word": expected_word,
            "char_scores": char_scores,
            "word_timestamps": word_timestamps,
            "assessment": assessment_result
        })

    except Exception as e:
        err_msg = traceback.format_exc()
        print("API Error:", err_msg, flush=True)
        # Gửi sự kiện lỗi tức thì lên Sentry để kích hoạt Mobile Alert
        with sentry_sdk.push_scope() as scope:
            scope.set_tag("endpoint", "/api/v1/assess")
            scope.set_tag("expected_word", expected_word)
            scope.set_extra("traceback", err_msg)
            sentry_sdk.capture_exception(e)
            
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
