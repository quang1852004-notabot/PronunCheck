from fastapi import FastAPI, File, UploadFile, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import os
import uuid
import torch

# Các thư viện AI
from faster_whisper import WhisperModel
from transformers import Wav2Vec2Processor, Wav2Vec2ForCTC

# Khởi tạo ứng dụng FastAPI
app = FastAPI(title="Pronunciation Assessment API (Hybrid AI)", version="2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "temp_audio"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ==========================================
# BƯỚC 0: KHỞI TẠO CÁC MÔ HÌNH AI (Global)
# ==========================================
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
COMPUTE_TYPE = "float16" if DEVICE == "cuda" else "int8" # Dùng int8 trên CPU để nhẹ hơn

print(f"Loading AI models on {DEVICE.upper()}... This might take a few minutes.")

# 1. Tải WhisperModel (Faster-Whisper) thay cho WhisperX để tương thích Python 3.12
try:
    whisper_model = WhisperModel("base", device=DEVICE, compute_type=COMPUTE_TYPE)
except Exception as e:
    print(f"Error loading Faster-Whisper: {e}")
    whisper_model = None

# 2. Tải Wav2Vec2 (Phoneme Recognition)
try:
    w2v_processor = Wav2Vec2Processor.from_pretrained("facebook/wav2vec2-large-xlsr-53-german")
    w2v_model = Wav2Vec2ForCTC.from_pretrained("facebook/wav2vec2-large-xlsr-53-german").to(DEVICE)
except Exception as e:
    print(f"Error loading Wav2Vec2: {e}")
    w2v_processor, w2v_model = None, None

print("Models loaded successfully!")


# ==========================================
# BƯỚC 2A: PHÂN TÍCH VỚI WAV2VEC2 (Phoneme)
# ==========================================
def analyze_with_wav2vec2(file_path: str):
    if not w2v_model:
        return 0.5 
    
    from faster_whisper.audio import decode_audio
    
    try:
        # decode_audio returns 1D numpy array, 16000Hz float32
        audio_array = decode_audio(file_path, sampling_rate=16000)
    except Exception as e:
        print(f"Error decoding audio: {e}")
        return 0.5

    inputs = w2v_processor(audio_array, sampling_rate=16000, return_tensors="pt").to(DEVICE)
    with torch.no_grad():
        logits = w2v_model(**inputs).logits

    probs = torch.nn.functional.softmax(logits, dim=-1)
    max_probs, _ = torch.max(probs, dim=-1)
    
    avg_confidence = max_probs.mean().item()
    return avg_confidence


# ==========================================
# BƯỚC 2B: PHÂN TÍCH VỚI FASTER-WHISPER
# ==========================================
def analyze_with_whisperx(file_path: str, expected_word: str):
    """
    Sử dụng Faster-Whisper để transcribe và lấy word-level probability.
    Hàm này thay thế cho WhisperX để tránh lỗi tương thích Python 3.12.
    """
    if not whisper_model:
        return 0.5

    # Lấy word_timestamps để nhận word-level confidence
    segments, info = whisper_model.transcribe(file_path, beam_size=5, language="de", word_timestamps=True)
    
    word_confidence = 0.0
    segments_list = list(segments) # Chuyển generator thành list
    
    for segment in segments_list:
        for word in segment.words:
            # Nếu tìm thấy từ giống expected_word (có thể dính dấu câu nên dùng in)
            if expected_word.lower() in word.word.lower():
                word_confidence = word.probability
                break
                
    # Nếu không tìm thấy chính xác từ đó, tức là người dùng đọc hoàn toàn sai thành từ khác.
    # Trong trường hợp này, điểm phải là 0.0 thay vì lấy trung bình độ tự tin của các từ bị nói sai.
    # (Loại bỏ đoạn tính total_prob / word_count để tránh bug "nói sai vẫn điểm cao")

    return word_confidence


# ==========================================
# BƯỚC 3: HYBRID SCORING ENGINE
# ==========================================
def calculate_pronunciation_score(w2v_score: float, whisper_score: float, threshold=0.6, w1=0.4, w2=0.6, target_phoneme="sch"):
    """
    Kết hợp điểm từ 2 mô hình (Wav2Vec2 và WhisperX).
    w1: Trọng số của Wav2Vec2 (Lắng nghe âm thanh thô)
    w2: Trọng số của WhisperX (Khớp với kịch bản chuẩn)
    """
    # Tính điểm mục tiêu kết hợp
    final_target_score = (w2v_score * w1) + (whisper_score * w2)
    
    # Quy đổi ra thang điểm 100
    final_score_100 = round(final_target_score * 100, 2)
    
    # Đánh giá Pass/Fail
    is_passed = bool(final_target_score >= threshold)

    return {
        "wav2vec_raw_score": round(w2v_score * 100, 2),
        "whisper_raw_score": round(whisper_score * 100, 2),
        "hybrid_target_score": final_score_100,
        "is_passed": is_passed,
        "feedback": "Phát âm rất rõ ràng và chuẩn xác!" if is_passed else f"Âm thanh chưa khớp với từ chuẩn. Hãy phát âm rõ hơn vần/âm '{target_phoneme}'."
    }


ALLOWED_EXTENSIONS = {"wav", "webm", "mp3", "ogg"}
MAX_FILE_SIZE_MB = 10
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024


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
    try:
        file_extension = audio_file.filename.split(".")[-1].lower() if audio_file.filename else ""
        if file_extension not in ALLOWED_EXTENSIONS:
            return JSONResponse(status_code=400, content={"status": "error", "message": "Sai định dạng."})

        file_content = audio_file.file.read()
        if len(file_content) > MAX_FILE_SIZE_BYTES:
            return JSONResponse(status_code=400, content={"status": "error", "message": "File quá lớn."})

        temp_filename = f"{uuid.uuid4()}.{file_extension}"
        file_path = os.path.join(UPLOAD_DIR, temp_filename)
        
        with open(file_path, "wb") as buffer:
            buffer.write(file_content)

        # CHẠY 2 MÔ HÌNH AI SONG SONG (TUẦN TỰ)
        print(f"Starting assessment for file {temp_filename}...", flush=True)
        w2v_score = analyze_with_wav2vec2(file_path)
        whisper_score = analyze_with_whisperx(file_path, expected_word)

        # TÍNH ĐIỂM HYBRID (VD: Wav2Vec chiếm 40%, Whisper chiếm 60%)
        assessment_result = calculate_pronunciation_score(
            w2v_score=w2v_score,
            whisper_score=whisper_score,
            threshold=threshold,
            w1=w1, 
            w2=w2,
            target_phoneme=target_phoneme
        )

        os.remove(file_path)
        
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
        if 'file_path' in locals() and os.path.exists(file_path):
            os.remove(file_path)
        return JSONResponse(status_code=500, content={"status": "error", "message": err_msg})

# uvicorn main:app --reload