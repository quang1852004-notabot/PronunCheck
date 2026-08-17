#!/bin/bash
# ==============================================================================
# Script khởi chạy Backend Production tối ưu cho GCP c2-standard-8 (8 vCPUs, 32GB RAM)
# ==============================================================================

# Chuyển vào thư mục gốc của project
cd "$(dirname "$0")/.."

# Kích hoạt virtualenv nếu có
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Tối ưu hóa biến môi trường cho CPU Intel Cascade Lake & OpenMP
export OMP_NUM_THREADS=4
export MKL_NUM_THREADS=4
export OPENBLAS_NUM_THREADS=4

echo "============================================================"
echo " Starting DT3 Light Scoring Backend on c2-standard-8 "
echo "============================================================"

# Chuyển vào thư mục Light_ScoringBackend và chạy Uvicorn
cd Light_ScoringBackend
exec uvicorn main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --workers 4 \
    --log-level info
