from fastapi import FastAPI, File, UploadFile, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
import uuid
import numpy as np
import torch
from concurrent.futures import ThreadPoolExecutor
import uvicorn

# Import cấu hình tập trung từ config.py
import config

# Các thư viện AI
from faster_whisper import WhisperModel
from faster_whisper.audio import decode_audio
from transformers import Wav2Vec2Processor, Wav2Vec2ForCTC

# ==========================================
# CẤU HÌNH PHẦN CỨNG & ĐA LUỒNG CPU
# ==========================================
if config.DEVICE == "cpu" and config.TORCH_CPU_THREADS:
    torch.set_num_threads(config.TORCH_CPU_THREADS)

os.makedirs(config.UPLOAD_DIR, exist_ok=True)

# Khởi tạo ThreadPoolExecutor để chạy song song các mô hình AI trong 1 request
executor = ThreadPoolExecutor(max_workers=config.PARALLEL_AI_WORKERS)

# ==========================================
# KHỞI TẠO CÁC MÔ HÌNH AI (Global)
# ==========================================
print(f"Loading AI models on {config.DEVICE.upper()} (Compute Type: {config.COMPUTE_TYPE})...")

# 1. Tải Faster-Whisper
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

# 2. Tải Wav2Vec2 (Phoneme Recognition)
try:
    w2v_processor = Wav2Vec2Processor.from_pretrained(config.WAV2VEC_MODEL_NAME)
    w2v_model = Wav2Vec2ForCTC.from_pretrained(config.WAV2VEC_MODEL_NAME).to(config.DEVICE)
    w2v_model.eval() # Chuyển sang inference mode
except Exception as e:
    print(f"Error loading Wav2Vec2: {e}")
    w2v_processor, w2v_model = None, None

# ==========================================
# WARM-UP MODEL KHI KHỞI ĐỘNG (Tránh giật lag request đầu tiên)
# ==========================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Warming up AI models for instant first response...", flush=True)
    try:
        dummy_audio = np.zeros(16000, dtype=np.float32) # 1 giây âm thanh tĩnh
        if whisper_model:
            list(whisper_model.transcribe(dummy_audio, beam_size=1, language="de", word_timestamps=True)[0])
        if w2v_model and w2v_processor:
            inputs = w2v_processor(dummy_audio, sampling_rate=16000, return_tensors="pt").to(config.DEVICE)
            with torch.inference_mode():
                _ = w2v_model(**inputs).logits
        print("Models warmed up and ready!", flush=True)
    except Exception as e:
        print(f"Warmup warning: {e}", flush=True)
    yield

# Khởi tạo ứng dụng FastAPI với lifespan
app = FastAPI(
    title="Pronunciation Assessment API (Hybrid AI - Ultra Fast)",
    version="2.1",
    lifespan=lifespan
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# BƯỚC 2A: PHÂN TÍCH VỚI WAV2VEC2 (Phoneme)
# ==========================================
def analyze_with_wav2vec2(audio_array: np.ndarray) -> float:
    if not w2v_model or not w2v_processor:
        return 0.5 
    
    try:
        inputs = w2v_processor(audio_array, sampling_rate=16000, return_tensors="pt").to(config.DEVICE)
        with torch.inference_mode():
            logits = w2v_model(**inputs).logits

        probs = torch.nn.functional.softmax(logits, dim=-1)
        max_probs, _ = torch.max(probs, dim=-1)
        
        return float(max_probs.mean().item())
    except Exception as e:
        print(f"Error in Wav2Vec2 inference: {e}", flush=True)
        return 0.5


# ==========================================
# BƯỚC 2B: PHÂN TÍCH VỚI FASTER-WHISPER
# ==========================================
def analyze_with_whisperx(audio_array: np.ndarray, expected_word: str) -> float:
    if not whisper_model:
        return 0.5

    try:
        segments, _ = whisper_model.transcribe(
            audio_array,
            beam_size=5,
            language="de",
            word_timestamps=True
        )
        
        word_confidence = 0.0
        for segment in segments:
            for word in segment.words:
                if expected_word.lower() in word.word.lower():
                    word_confidence = word.probability
                    break
            if word_confidence > 0.0:
                break
                    
        return float(word_confidence)
    except Exception as e:
        print(f"Error in Whisper inference: {e}", flush=True)
        return 0.5


# ==========================================
# BƯỚC 3: HYBRID SCORING ENGINE
# ==========================================
def calculate_pronunciation_score(w2v_score: float, whisper_score: float, threshold=0.6, w1=0.4, w2=0.6, target_phoneme="sch"):
    final_target_score = (w2v_score * w1) + (whisper_score * w2)
    final_score_100 = round(final_target_score * 100, 2)
    is_passed = bool(final_target_score >= threshold)

    return {
        "wav2vec_raw_score": round(w2v_score * 100, 2),
        "whisper_raw_score": round(whisper_score * 100, 2),
        "hybrid_target_score": final_score_100,
        "is_passed": is_passed,
        "feedback": "Phát âm rất rõ ràng và chuẩn xác!" if is_passed else f"Âm thanh chưa khớp với từ chuẩn. Hãy phát âm rõ hơn vần/âm '{target_phoneme}'."
    }


# ==========================================
# BƯỚC 1: ENDPOINT API
# ==========================================
@app.post("/api/v1/assess")
def assess_pronunciation(
    audio_file: UploadFile = File(...), 
    expected_word: str = Form("Schule"),
    target_phoneme: str = Form("ʃ"),
    threshold: float = Form(0.55),
    w1: float = Form(0.4),
    w2: float = Form(0.6)
):
    temp_filename = ""
    file_path = ""
    try:
        file_extension = audio_file.filename.split(".")[-1].lower() if audio_file.filename else ""
        if file_extension not in config.ALLOWED_EXTENSIONS:
            return JSONResponse(status_code=400, content={"status": "error", "message": "Sai định dạng."})

        file_content = audio_file.file.read()
        max_bytes = config.MAX_FILE_SIZE_MB * 1024 * 1024
        if len(file_content) > max_bytes:
            return JSONResponse(status_code=400, content={"status": "error", "message": "File quá lớn."})

        temp_filename = f"{uuid.uuid4()}.{file_extension}"
        file_path = os.path.join(config.UPLOAD_DIR, temp_filename)
        
        with open(file_path, "wb") as buffer:
            buffer.write(file_content)

        # 1. Decode âm thanh DUY NHẤT 1 LẦN sang float32 16kHz
        audio_array = decode_audio(file_path, sampling_rate=16000)

        # 2. CHẠY ĐỒNG THỜI CẢ 2 MÔ HÌNH TRÊN ĐA LUỒNG CPU
        future_w2v = executor.submit(analyze_with_wav2vec2, audio_array)
        future_whisper = executor.submit(analyze_with_whisperx, audio_array, expected_word)

        w2v_score = future_w2v.result()
        whisper_score = future_whisper.result()

        # 3. TÍNH ĐIỂM HYBRID
        assessment_result = calculate_pronunciation_score(
            w2v_score=w2v_score,
            whisper_score=whisper_score,
            threshold=threshold,
            w1=w1, 
            w2=w2,
            target_phoneme=target_phoneme
        )

        return JSONResponse(content={
            "status": "success",
            "word": expected_word,
            "target": target_phoneme,
            "assessment": assessment_result
        })

    except Exception as e:
        import traceback
        err_msg = traceback.format_exc()
        print("API Error:", err_msg, flush=True)
        return JSONResponse(status_code=500, content={"status": "error", "message": err_msg})
    finally:
        if file_path and os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass


if __name__ == "__main__":
    print(f"Starting server on http://{config.HOST}:{config.PORT} with {config.WORKERS} workers...")
    uvicorn.run(
        "main:app",
        host=config.HOST,
        port=config.PORT,
        workers=config.WORKERS
    )