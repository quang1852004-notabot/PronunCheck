"""
================================================================================
                    CẤU HÌNH HỆ THỐNG PRONUNCHECK BACKEND
================================================================================
File này chứa toàn bộ các thông số cấu hình về tài nguyên CPU, số luồng (threads),
số tiến trình (workers), và mô hình AI để bạn dễ dàng tinh chỉnh theo cấu hình máy.
================================================================================
"""

import os
import torch

# ==============================================================================
# 1. CẤU HÌNH SERVER & TIẾN TRÌNH (UVICORN / GUNICORN)
# ==============================================================================
HOST = "0.0.0.0"
PORT = 8000

# Số lượng tiến trình (Workers) chạy song song của Web Server:
# - VM 8 vCPUs (như c2-standard-8): Đề xuất 2 đến 4 workers
# - VM 4 vCPUs: Đề xuất 2 workers
# - Chạy thử nghiệm cục bộ (Local dev): Đề xuất 1 worker
WORKERS = 4


# ==============================================================================
# 2. CẤU HÌNH ĐA LUỒNG CPU & PHẦN CỨNG (HARDWARE ACCELERATION)
# ==============================================================================
# Thiết bị chạy AI: "auto" (tự chọn), "cpu", hoặc "cuda" (nếu có GPU)
DEVICE_SETTING = "auto"

if DEVICE_SETTING == "auto":
    DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
else:
    DEVICE = DEVICE_SETTING

# Kiểu tính toán lượng tử hóa:
# - Trên CPU (đặc biệt Intel Cascade Lake có AVX-512/VNNI): "int8" là nhanh nhất
# - Trên GPU: "float16"
COMPUTE_TYPE = "float16" if DEVICE == "cuda" else "int8"

# Số luồng CPU cho PyTorch (Wav2Vec2):
# - Để None hoặc 0: PyTorch tự lấy theo số core của máy
# - Đặt số cụ thể (ví dụ 2 hoặc 4): Giới hạn số luồng per worker
TORCH_CPU_THREADS = 4

# Số luồng CPU cho Faster-Whisper (CTranslate2):
# - 0: Auto (tự lấy tối đa luồng khả dụng)
# - 2, 4, hoặc 6: Số luồng cố định cho mỗi worker
WHISPER_CPU_THREADS = 4

# Số worker nội bộ của Faster-Whisper
WHISPER_NUM_WORKERS = 1

# Số luồng chạy song song 2 mô hình AI (Wav2Vec2 + Whisper) trong 1 request
# Khuyến nghị: 2 (vì có 2 mô hình chạy đồng thời)
PARALLEL_AI_WORKERS = 2


# ==============================================================================
# 3. CẤU HÌNH MÔ HÌNH AI
# ==============================================================================
# Kích thước mô hình Whisper: "tiny", "base", "small", "medium", "large-v3"
WHISPER_MODEL_NAME = "base"

# Mô hình Wav2Vec2 cho nhận diện ngữ âm tiếng Đức
WAV2VEC_MODEL_NAME = "facebook/wav2vec2-large-xlsr-53-german"


# ==============================================================================
# 4. CẤU HÌNH LƯU TRỮ VÀ TẢI FILE
# ==============================================================================
UPLOAD_DIR = "temp_audio"
REFERENCE_AUDIO_DIR = "reference_audio"
MAX_FILE_SIZE_MB = 10
ALLOWED_EXTENSIONS = {"wav", "webm", "mp3", "ogg"}
