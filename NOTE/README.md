# 🎤 PronunCheck — Ứng dụng Luyện Phát Âm Tiếng Đức

> Web app kiểm tra và luyện phát âm tiếng Đức cho học sinh, sử dụng **AI Hybrid** (Wav2Vec2 + Faster-Whisper), với hệ thống lớp học quản lý bởi giáo viên.

![Next.js](https://img.shields.io/badge/Next.js-16.3.0-black?logo=next.js)
![React](https://img.shields.io/badge/React-19.2.8-blue?logo=react)
![FastAPI](https://img.shields.io/badge/FastAPI-v2.1-009688?logo=fastapi)
![Firebase](https://img.shields.io/badge/Firebase-Auth%20%2B%20Firestore%20%2B%20Storage-FFCA28?logo=firebase)
![PyTorch](https://img.shields.io/badge/PyTorch-Wav2Vec2-EE4C2C?logo=pytorch)
![Whisper](https://img.shields.io/badge/Faster--Whisper-STT-green)

---

## 📸 Tổng quan tính năng

### Luồng hoạt động

```
Đăng ký (chọn vai trò) → Dashboard theo vai trò

🎓 Học sinh:                                 👨‍🏫 Giáo viên:
├── Luyện tập tự do                          ├── Tạo lớp học (ID + mật khẩu)
│   ├── Nhập từ + phoneme bất kỳ             ├── Tạo bài tập (từ, phoneme, deadline)
│   ├── Ghi âm / Upload file                 │   └── Cấu hình scoring (w1, w2, threshold)
│   └── AI chấm điểm ĐẠT / CHƯA ĐẠT         ├── Xem bài nộp (nghe audio + xem điểm)
└── Làm bài tập lớp                          │   └── Chi tiết: Wav2Vec + Whisper scores
    ├── Tham gia lớp (Mã lớp + mật khẩu)     └── Quản lý học sinh (danh sách, xóa)
    ├── Ghi âm → Nghe lại → Nộp bài
    └── Audio + điểm gửi cho GV tự động
```

### Tính năng chính

| Tính năng | Mô tả |
|---|---|
| 🤖 **AI Hybrid Scoring** | Wav2Vec2 (phoneme) + Faster-Whisper (transcription) chạy song song, chấm điểm tức thì |
| 🔐 **Auth theo vai trò** | Đăng ký/Đăng nhập bằng Email — phân vai Học sinh hoặc Giáo viên |
| 🎤 **Ghi âm trực tiếp** | Thu âm qua trình duyệt, nghe lại trước khi nộp |
| 📁 **Upload file audio** | Hỗ trợ .wav, .mp3, .webm, .ogg (max 10MB) |
| 🏫 **Hệ thống lớp học** | GV tạo lớp → HS tham gia bằng mã + mật khẩu |
| 📋 **Giao & làm bài tập** | GV tạo bài (custom scoring) → HS làm → GV xem kết quả + nghe audio |
| ⚙️ **Cấu hình scoring** | Tùy chỉnh w1 (Wav2Vec), w2 (Whisper), threshold theo từng bài |
| 🚀 **Production-ready** | GCP VM, 4 workers, int8 quantization, GitHub Actions CI/CD |

---

## 🛠 Tech Stack

| Layer | Công nghệ |
|---|---|
| **Frontend** | Next.js 16.3 • React 19 • TypeScript • Tailwind CSS 4 • Lucide Icons |
| **Backend** | Python FastAPI • Uvicorn (multi-worker) |
| **AI: Phoneme** | Wav2Vec2 (`facebook/wav2vec2-large-xlsr-53-german`) — PyTorch |
| **AI: Transcription** | Faster-Whisper (`base`) — CTranslate2, int8 quantized |
| **Auth** | Firebase Authentication (Email/Password + Role) |
| **Database** | Cloud Firestore |
| **Storage** | Firebase Storage (audio submissions) |
| **Deployment** | GCP `c2-standard-8` • GitHub Actions CI/CD |

---

## 🚀 Hướng dẫn cài đặt & chạy

### Yêu cầu

- **Node.js** 18+
- **Python** 3.10+
- **Firebase project** (bật Authentication + Firestore + Storage)
- **RAM** ≥ 8GB (AI models cần ~6GB cho 4 workers)

### 1. Clone & cài đặt

```bash
git clone <repo-url>
cd DT3_PronunCheck

# Backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Linux/Mac
pip install -r requirements.txt

# Frontend
cd frontend-pronuncheck
npm install
```

### 2. Cấu hình Firebase

Tạo file `frontend-pronuncheck/.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_API_URL=http://localhost:8000
```

> **Lưu ý**: Bật **Email/Password** trong Firebase Console → Authentication → Sign-in method

### 3. Chạy ứng dụng

**Cách nhanh (Windows):**
```bash
start_servers.bat
```

**Cách thủ công:**

```bash
# Terminal 1: Backend (AI models sẽ tự động tải lần đầu)
cd DT3_PronunCheck
venv\Scripts\activate
python main.py
# hoặc: uvicorn main:app --reload

# Terminal 2: Frontend
cd DT3_PronunCheck/frontend-pronuncheck
npm run dev
```

### 4. Truy cập

| URL | Mô tả |
|---|---|
| `http://localhost:3000` | Frontend (Next.js) |
| `http://localhost:8000` | Backend API |
| `http://localhost:8000/docs` | Swagger API Docs |

---

## 📁 Cấu trúc dự án

```
DT3_PronunCheck/
├── main.py                     # FastAPI + Hybrid AI (Wav2Vec2 + Faster-Whisper)
├── config.py                   # Centralized config (hardware, models, server)
├── requirements.txt            # Python deps (torch, transformers, faster-whisper)
├── start_servers.bat           # One-click startup (Windows)
├── run_production.sh           # Production deploy (GCP, 4 workers)
├── .github/workflows/
│   └── deploy.yml              # GitHub Actions → GCP VM auto-deploy
│
└── frontend-pronuncheck/       # Next.js Frontend
    ├── .env.local              # Firebase + API configuration
    ├── app/
    │   ├── firebase.ts         # Firebase SDK init (Auth + Firestore + Storage)
    │   ├── layout.tsx          # Root layout + AuthProvider
    │   ├── page.tsx            # Home — role selection + auto-redirect
    │   ├── contexts/
    │   │   └── AuthContext.tsx  # Auth state + role management
    │   ├── components/
    │   │   ├── AuthGuard.tsx   # Route protection + role guard
    │   │   └── AudioRecorder.tsx # Reusable audio recorder
    │   ├── lib/
    │   │   ├── firestore.ts   # Firestore typed CRUD
    │   │   └── storage.ts     # Firebase Storage helpers
    │   ├── login/page.tsx     # Login/Register (role-aware)
    │   ├── student/
    │   │   ├── page.tsx       # Student dashboard (Free + Class)
    │   │   ├── free/page.tsx  # Free practice
    │   │   └── class/[classId]/page.tsx
    │   └── teacher/
    │       ├── page.tsx       # Teacher dashboard
    │       ├── class/[classId]/page.tsx
    │       └── components/    # AssignmentForm, ScoringConfig, SubmissionTable
    └── public/
```

---

## 🔌 API Endpoints

### Pronunciation Assessment

| Method | Endpoint | Mô tả |
|---|---|---|
| `POST` | `/api/v1/assess` | Chấm điểm phát âm bằng Hybrid AI |

**Request** (multipart/form-data):

| Field | Type | Default | Mô tả |
|---|---|---|---|
| `audio_file` | File | required | File audio (.wav/.webm/.mp3/.ogg, max 10MB) |
| `expected_word` | string | "Schule" | Từ mong đợi |
| `target_phoneme` | string | "ʃ" | Âm mục tiêu |
| `threshold` | float | 0.55 | Ngưỡng đạt (0.0 - 1.0) |
| `w1` | float | 0.4 | Trọng số Wav2Vec2 |
| `w2` | float | 0.6 | Trọng số Whisper |

**Response**:
```json
{
  "status": "success",
  "word": "Schule",
  "target": "ʃ",
  "assessment": {
    "wav2vec_raw_score": 78.5,
    "whisper_raw_score": 92.3,
    "hybrid_target_score": 86.78,
    "is_passed": true,
    "feedback": "Phát âm rất rõ ràng và chuẩn xác!"
  }
}
```

---

## 🗄️ Firestore Collections

| Collection | Mô tả | Key Fields |
|---|---|---|
| `users/` | User + vai trò | `email`, `role` ("student"/"teacher") |
| `classes/` | Lớp học | `name`, `password`, `teacherId`, `scoringConfig` |
| `class_members/` | Học sinh trong lớp | `classId`, `studentId`, `studentEmail` |
| `tasks/` | Bài tập | `classId`, `word`, `targetPhoneme`, `w1`, `w2`, `threshold`, `deadline` |
| `submissions/` | Bài nộp | `taskId`, `studentId`, `audioUrl`, `scores` (wav2vec + whisper + hybrid) |

---

## ⚙️ Cấu hình Backend (`config.py`)

| Config | Mô tả | Default |
|---|---|---|
| `WORKERS` | Số Uvicorn workers | 4 |
| `DEVICE` | CPU / CUDA (auto-detect) | auto |
| `COMPUTE_TYPE` | Quantization (int8 / float16) | int8 (CPU) |
| `TORCH_CPU_THREADS` | PyTorch threads per worker | 4 |
| `WHISPER_CPU_THREADS` | CTranslate2 threads | 4 |
| `WHISPER_MODEL_NAME` | Whisper model size | "base" |
| `WAV2VEC_MODEL_NAME` | Wav2Vec2 pretrained model | "facebook/wav2vec2-large-xlsr-53-german" |
| `PARALLEL_AI_WORKERS` | Concurrent AI threads per request | 2 |

---

## 🚧 Trạng thái phát triển

- ✅ Hybrid AI Engine (Wav2Vec2 + Faster-Whisper) — **HOẠT ĐỘNG**
- ✅ Role-based Authentication (Student / Teacher)
- ✅ Student dashboard (Luyện tự do + Bài tập lớp)
- ✅ Teacher dashboard (Lớp học + Bài tập + Bài nộp + Quản lý HS)
- ✅ Audio recording + upload + preview + Firebase Storage
- ✅ GCP production deployment + GitHub Actions CI/CD
- 📋 Xem chi tiết tại [`roadmap.md`](roadmap.md)

---

## 📄 License

Private project — DT3 Team.
