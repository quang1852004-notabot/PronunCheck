"""
================================================================================
                    CẤU HÌNH HỆ THỐNG LIGHT SCORING BACKEND
================================================================================
File này chứa toàn bộ các thông số cấu hình về tài nguyên CPU, số luồng (threads),
số tiến trình (workers), và mô hình AI để bạn dễ dàng tinh chỉnh theo cấu hình máy.
================================================================================
"""

import os
import torch

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

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

# Số luồng chạy song song các mô hình AI trong 1 request
PARALLEL_AI_WORKERS = 3


# ==============================================================================
# 3. CẤU HÌNH MÔ HÌNH AI (LIGHT TIER)
# ==============================================================================
# Kích thước mô hình Whisper: "tiny" (~39MB, siêu nhẹ, nhận diện nhanh)
WHISPER_MODEL_NAME = "tiny"

# Mô hình Wav2Vec2 cho nhận diện ngữ âm tiếng Đức
WAV2VEC_MODEL_NAME = "facebook/wav2vec2-large-xlsr-53-german"


# ==============================================================================
# 4. CẤU HÌNH F0 PITCH CONTOUR & DTW (INTONATION & PROSODY)
# ==============================================================================
F0_FMIN = 65.0          # Tần số thấp nhất giọng người (C2)
F0_FMAX = 2093.0        # Tần số cao nhất giọng người (C7)
F0_HOP_LENGTH = 512
DTW_PITCH_DECAY = 0.08  # Hệ số suy giảm khoảng cách DTW cao độ


# ==============================================================================
# 5. CẤU HÌNH THUẬT TOÁN CHẤM ĐIỂM ĐỘNG (DYNAMIC SCORING SPECIFICATION)
# ==============================================================================
# Trọng số Sigmoid theo độ dài hiệu dụng L:
# w_acc(L) = 1 / (1 + exp(k * (L - L0)))
# w_flu(L) = 1 - w_acc(L)
SCORING_L0 = 4.0        # Điểm chuyển giao cân bằng (4 từ/âm tiết hiệu dụng)
SCORING_K = 0.5         # Độ dốc chuyển tiếp
PASSING_THRESHOLD = 55.0 # Điểm qua môn (trên thang 100)


# ==============================================================================
# 6. CẤU HÌNH LƯU TRỮ VÀ TẢI FILE
# ==============================================================================
UPLOAD_DIR = os.path.join(BASE_DIR, "temp_audio")
REFERENCE_AUDIO_DIR = os.path.join(BASE_DIR, "reference_audio")
MAX_FILE_SIZE_MB = 10
ALLOWED_EXTENSIONS = {"wav", "webm", "mp3", "ogg"}
