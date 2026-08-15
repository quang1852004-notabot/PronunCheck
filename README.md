# DT3_PronunCheck

Web app kiểm tra phát âm tiếng Đức cho học sinh. Học sinh ghi âm phát âm, AI phân tích, sau đó trả điểm & nhận xét.

## 📋 Tính năng chính

- **Ghi âm trực tiếp trên trình duyệt**
- **Đánh giá phát âm AI** (Hiện tại đang sử dụng mock engine)
- **Phân quyền Học sinh & Giáo viên**
- **Chế độ lớp học & Chế độ tự do**
- **Dashboard Giáo viên**: Quản lý lớp, giao bài tập, theo dõi tiến độ
- **Lưu trữ**: Firebase Auth & Firestore

## 🛠 Tech Stack

- **Frontend**: Next.js + React + TypeScript + Tailwind CSS
- **Backend**: Python FastAPI
- **Cơ sở dữ liệu & Xác thực**: Firebase (Auth + Firestore + Storage)

## 🚀 Cài đặt & Khởi chạy

### 1. Backend (FastAPI)

`ash
# Tạo môi trường ảo
python -m venv venv
venv\Scripts\activate

# Cài đặt dependencies
pip install -r requirements.txt

# Khởi chạy server
uvicorn main:app --reload
`

### 2. Frontend (Next.js)

`ash
cd frontend-pronuncheck

# Cài đặt dependencies
npm install

# Tạo file .env.local với cấu hình Firebase của bạn
# ...

# Khởi chạy server
npm run dev
`

Hoặc có thể chạy cả hai cùng lúc bằng script: start_servers.bat

## 🗺 Roadmap

Xem chi tiết trong file [roadmap.md](roadmap.md).
