# 🗺️ ROADMAP — DT3_PronunCheck

> **Cập nhật lần cuối:** 2026-08-15

---

## 📋 Tổng quan dự án

| Thuộc tính | Giá trị |
|---|---|
| **Tên dự án** | DT3_PronunCheck |
| **Mô tả** | Web app kiểm tra phát âm tiếng Đức cho học sinh |
| **Mục tiêu** | Học sinh ghi âm phát âm → AI phân tích → Trả điểm & nhận xét |
| **Ngôn ngữ mục tiêu** | Tiếng Đức (hiện tập trung vần "sch" — từ "Schule") |

### Tech Stack

| Layer | Công nghệ | Phiên bản |
|---|---|---|
| Frontend | Next.js + React + TypeScript + Tailwind CSS | 16.3.0 / 19.2.8 / 4 |
| Backend | Python FastAPI | — |
| Auth / DB | Firebase (Auth + Firestore) | ^12.17.1 |
| AI Engine | Dự kiến Azure Speech / WhisperX | ⚠️ Mock Data |

### Kiến trúc

```
Browser (Ghi âm) → Next.js Frontend (:3000) → FastAPI Backend (:8000) → AI Engine → Scoring → Kết quả
                          ↕
                    Firebase (Auth + Firestore)
```

---

## ✅ Đã hoàn thành

### Phase 0: Khởi tạo dự án
- [x] Tạo project Next.js 16 với TypeScript + Tailwind CSS 4
- [x] Cấu hình Firebase SDK (`app/firebase.ts`)
- [x] Tạo `.env.local` với Firebase project keys
- [x] Backend FastAPI với endpoint `POST /api/v1/assess`
- [x] Scoring Engine — thuật toán tính điểm phát âm (weighted: 80% âm mục tiêu, 20% còn lại)
- [x] Mock AI Engine — hàm giả lập kết quả AI cho testing
- [x] Frontend prototype (HTML thuần `index.html`) — ghi âm + gửi API + hiển thị kết quả
- [x] File audio test mẫu (ElevenLabs TTS "Schule")

### Phase 1a: Frontend Next.js
- [x] Trang chính (`app/page.tsx`) — UI dark-mode: ghi âm, gọi API, hiển thị kết quả
- [x] Tailwind CSS setup với dark/light theme variables

### Phase 1b: Authentication & Bug fixes *(2026-08-15)*
- [x] Cấu hình `.env.local` với Firebase project keys
- [x] Tạo AuthContext (`app/contexts/AuthContext.tsx`) — quản lý trạng thái đăng nhập
- [x] Trang Login/Register (`app/login/page.tsx`) — UI đăng nhập/đăng ký bằng Email + Firebase Auth
- [x] AuthGuard component (`app/components/AuthGuard.tsx`) — bảo vệ route, redirect nếu chưa đăng nhập
- [x] Tích hợp AuthProvider vào root layout
- [x] Cập nhật metadata (title: "PronunCheck - Luyện Phát Âm")
- [x] Sửa lỗi stream cleanup — stop audio tracks sau khi ghi âm xong
- [x] Thêm header bar (email + logout) vào trang chính
- [x] Backend: validate file type (chỉ chấp nhận .wav, .webm, .mp3, .ogg)
- [x] Backend: giới hạn file size (max 10MB)

---

## 🔲 Chưa làm

### Phase 2: Tích hợp AI thật
- [ ] Chọn AI provider (Azure Speech SDK / Google Cloud Speech / WhisperX)
- [ ] Tích hợp Speech-to-Text API thật
- [ ] Phoneme-level analysis từ audio thật
- [ ] Cải thiện Scoring Engine dựa trên dữ liệu AI thật
- [ ] Xử lý các edge case (audio quá ngắn, quá dài, không có giọng nói)

### Phase 3: Hệ thống bài tập & UX (Đã hoàn thành một phần)
- [x] Phân quyền Học sinh & Giáo viên
- [x] Chế độ tự do (Free Mode) cho học sinh
- [x] Chế độ lớp học (Class Mode) — học sinh làm bài theo yêu cầu
- [x] Dashboard giáo viên — tạo lớp, quản lý học sinh, giao bài tập (chỉnh độ khó w1, w2, threshold)
- [x] Lưu file audio nộp bài lên Firebase Storage để giáo viên nghe lại
- [ ] Lịch sử luyện tập — xem lại lịch sử dài hạn (đã có xem bài nộp nhưng cần dashboard cá nhân tốt hơn)
- [ ] Nút "🔊 Nghe mẫu" — nghe phát âm chuẩn trước khi ghi âm
- [ ] Responsive + PWA

### Phase 4: Nâng cao
- [ ] Đa ngôn ngữ (Anh, Pháp, ...)
- [ ] Gamification (huy hiệu, streak, bảng xếp hạng)
- [ ] API URL thành env variable (`NEXT_PUBLIC_API_URL`)
- [ ] Deploy (Frontend → Vercel, Backend → Railway/Fly.io)
- [ ] CORS config production-ready

---

## 📁 Cấu trúc dự án hiện tại

```
DT3_PronunCheck/
├── main.py                              # FastAPI Backend (Hybrid AI + Dynamic Thresholds)
├── index.html                           # Frontend cũ (prototype)
├── roadmap.md                           # 📍 File này
├── temp_audio/                          # Thư mục audio tạm
├── test/
│   └── ElevenLabs_2026-08-Schule.mp3    # Audio test
│
└── frontend-pronuncheck/                # Next.js Frontend
    ├── .env.local                       # Firebase keys
    ├── app/
    │   ├── firebase.ts                  # Firebase init (Auth + Firestore + Storage)
    │   ├── layout.tsx                   # Root layout + AuthProvider
    │   ├── globals.css                  # Tailwind CSS
    │   ├── page.tsx                     # Trang Chọn Vai Trò (Role Selection)
    │   ├── student/page.tsx             # Dashboard Học sinh
    │   ├── teacher/page.tsx             # Dashboard Giáo viên
    │   ├── contexts/
    │   │   └── AuthContext.tsx           # Auth state management
    │   ├── components/
    │   │   └── AuthGuard.tsx            # Route protection
    │   └── login/
    │       └── page.tsx                 # Login/Register page
    └── public/                          # Static assets
```

---

## 📝 Ghi chú kỹ thuật

- **Backend API**: `http://127.0.0.1:8000/api/v1/assess` (POST, multipart/form-data)
- **Frontend**: `http://localhost:3000` (Next.js dev server)
- **Firebase Auth**: Email/Password authentication
- **CORS**: Hiện đang `allow_origins=["*"]` — cần restrict khi deploy
- **AI Engine**: Đang dùng Mock Data — luôn trả kết quả cứng cho từ "Schule"
