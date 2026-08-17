#!/bin/bash
# ==============================================================================
# Script tự động cập nhật code và khởi động lại Backend trên GCP VM
# ==============================================================================
set -e

# Chuyển vào thư mục chứa script (thư mục gốc dự án)
cd "$(dirname "$0")"

echo "=================================================="
echo " [1/4] Đang kéo code mới nhất từ GitHub..."
echo "=================================================="
git pull origin main

echo "=================================================="
echo " [2/4] Cấp quyền thực thi cho các script..."
echo "=================================================="
chmod +x run_production.sh Excution/run_production.sh reload_backend.sh 2>/dev/null || true

echo "=================================================="
echo " [3/4] Đang khởi động lại dịch vụ pronuncheck-backend..."
echo "=================================================="
sudo systemctl restart pronuncheck-backend

echo "=================================================="
echo " [4/4] Trạng thái dịch vụ:"
echo "=================================================="
sudo systemctl status pronuncheck-backend --no-pager -l
