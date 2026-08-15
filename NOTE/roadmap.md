# 🗺️ ROADMAP — DT3_PronunCheck

> **Cập nhật lần cuối:** 2026-08-16 01:15

---

## 📋 Tổng quan dự án

| Thuộc tính | Giá trị |
|---|---|
| **Tên dự án** | DT3_PronunCheck |
| **Mô tả** | Web app kiểm tra & luyện phát âm tiếng Đức cho học sinh, với hệ thống lớp học quản lý bởi giáo viên |
| **Mục tiêu** | Học sinh ghi âm phát âm → AI phân tích phoneme → Hybrid scoring → Giáo viên theo dõi kết quả |
| **Ngôn ngữ mục tiêu** | Tiếng Đức |
| **Production API** | `https://api.thuy-tien.pro` |

### Tech Stack

| Layer | Công nghệ | Phiên bản / Chi tiết |
|---|---|---|
| Frontend | Next.js + React + TypeScript + Tailwind CSS | 16.3.0 / 19.2.8 / 4 |
| Icons | Lucide React | ^1.31.0 |
| Backend | Python FastAPI + Uvicorn | v2.1, multi-worker |
| AI: Phoneme | **Wav2Vec2** (`facebook/wav2vec2-large-xlsr-53-german`) | PyTorch + Transformers |
| AI: Transcription | **Faster-Whisper** (CTranslate2, model `base`) | Chạy song song với Wav2Vec2 |
| Auth | Firebase Authentication (Email/Password + Role-based) | ^12.17.1 |
| Database | Cloud Firestore | ^12.17.1 |
| Storage | Firebase Storage (lưu audio bài nộp) | ^12.17.1 |
| Deployment | GCP VM `c2-standard-8` (8 vCPUs, 32GB RAM) | GitHub Actions auto-deploy |
| Config | Python centralized config (`config.py`) | CPU threads, workers, models |

### Kiến trúc hệ thống

```
                          ┌──────────────────────────────┐
                          │        Firebase Cloud         │
                          │  ┌──────────────────────────┐ │
                          │  │ Auth (Email + Role)       │ │
                          │  │ Firestore (classes, tasks,│ │
                          │  │   submissions, users)     │ │
                          │  │ Storage (audio files)     │ │
                          │  └──────────────────────────┘ │
                          └──────────────┬────────────────┘
                                         │
  ┌─────────────────┐    ┌───────────────┴────────────────┐    ┌──────────────────────────┐
  │  Học sinh 🎓     │───▶│  Next.js Frontend (:3000)      │───▶│  FastAPI Backend (:8000)  │
  │  - Luyện tự do   │    │  - Trang chủ (chọn role)       │    │                          │
  │  - Làm bài lớp   │    │  - Login/Register (role-aware) │    │  ┌─ Wav2Vec2 (phoneme)   │
  │  - Ghi âm/Upload │    │  - /student (dashboard)        │    │  │  (chạy song song)     │
  └─────────────────┘    │  - /teacher (dashboard)        │    │  └─ Faster-Whisper (STT)  │
                          └────────────────────────────────┘    │                          │
  ┌─────────────────┐                 ▲                        │  Hybrid Scoring Engine   │
  │  Giáo viên 👨‍🏫  │─────────────────┘                        │  w1×Wav2Vec + w2×Whisper │
  │  - Tạo/xóa lớp  │                                          └──────────────────────────┘
  │  - Giao bài tập  │                                                      │
  │  - Cấu hình điểm │                                          Deploy: GCP c2-standard-8
  │  - Xem bài nộp   │                                          4 workers, int8 quantization
  │  - Quản lý HS    │                                          GitHub Actions CI/CD
  └─────────────────┘
```

### Firestore Data Model

```
users/{uid}
  ├── email: string
  └── role: "student" | "teacher"

classes/{classId}
  ├── name: string
  ├── password: string
  ├── teacherId: string
  ├── scoringConfig: { threshold, w1, w2 }
  ├── createdAt: timestamp
  ├── assignments/{assignmentId}    (subcollection)
  │   ├── word, targetPhoneme, maxAttempts, deadline, isActive
  └── submissions/{submissionId}    (subcollection)
      ├── studentId, studentEmail, assignmentId, word
      ├── audioStoragePath, detailedScore, isPassed, attemptNumber

class_members/{classId}_{studentUid}
  ├── classId, studentId, studentEmail, joinedAt

tasks/{taskId}                      (top-level, used by teacher/student pages)
  ├── classId, word, targetPhoneme, deadline, w1, w2, threshold

submissions/{submissionId}          (top-level, used by teacher submissions view)
  ├── taskId, classId, studentId, studentEmail, audioUrl, scores, timestamp
```

---

## ✅ Đã hoàn thành

### Phase 0: Khởi tạo & Prototype
- [x] Tạo project Next.js 16 với TypeScript + Tailwind CSS 4
- [x] Backend FastAPI prototype với Mock AI Engine
- [x] Scoring Engine v1 — thuật toán tính điểm phát âm (weighted)
- [x] Frontend prototype HTML thuần (`index.html`)
- [x] File audio test mẫu (ElevenLabs TTS "Schule")

### Phase 1: Authentication & Core UI
- [x] Cấu hình Firebase SDK (`firebase.ts`: Auth + Firestore + Storage)
- [x] Cấu hình `.env.local` với Firebase project keys
- [x] AuthContext — quản lý user state + **role-based auth** (student/teacher)
- [x] Lưu user role vào Firestore collection `users/`
- [x] AuthGuard component — bảo vệ route + role-based redirect
- [x] Trang Login/Register — role-aware qua URL param (`?role=teacher`)
- [x] Dịch lỗi Firebase sang tiếng Việt
- [x] Trang chủ (`/`) — chọn vai trò + auto-redirect nếu đã có role
- [x] Xử lý tài khoản cũ chưa có role (assign role screen)
- [x] Metadata: "PronunCheck - Luyện Phát Âm"
- [x] `export const dynamic = "force-dynamic"` (Firebase cần browser APIs)

### Phase 2: Hệ thống Học sinh (`/student`)
- [x] Dashboard học sinh với header bar (email + logout)
- [x] **Chế độ Tự do (Free Mode)** — nhập từ bất kỳ + phoneme → ghi âm → chấm điểm
- [x] **Chế độ Lớp học (Class Mode)**:
  - [x] Hiển thị danh sách lớp đã tham gia
  - [x] Tham gia lớp bằng Mã lớp + Mật khẩu
  - [x] Xem danh sách bài tập (word, targetPhoneme, deadline)
  - [x] Làm bài tập: ghi âm → preview → nộp
  - [x] Gửi w1/w2/threshold từ bài tập tới API
- [x] Ghi âm trực tiếp qua Microphone (MediaRecorder API)
- [x] Tải file audio lên (upload .wav/.mp3/.webm)
- [x] **Nghe lại bản thu** trước khi nộp (audio preview)
- [x] Thu âm lại nếu chưa hài lòng
- [x] Upload audio lên Firebase Storage khi nộp bài lớp
- [x] Lưu submission vào Firestore (scores + audioUrl + timestamp)
- [x] Hiển thị kết quả ĐẠT/CHƯA ĐẠT với CheckCircle/XCircle icons
- [x] Stream cleanup (stop audio tracks sau khi ghi âm xong)
- [x] API URL thông qua env variable (`NEXT_PUBLIC_API_URL`)
- [x] Component `AudioRecorder.tsx` reusable

### Phase 3: Hệ thống Giáo viên (`/teacher`)
- [x] Dashboard giáo viên với header bar
- [x] **Tạo lớp học** — tên lớp + mật khẩu (auto-generate class ID 7 ký tự)
- [x] Hiển thị danh sách lớp dạng grid cards + xóa lớp (confirm dialog)
- [x] Chi tiết lớp — tabs: **Bài tập | Học sinh**
- [x] **Tạo bài tập** — word, targetPhoneme, deadline, w1/w2/threshold tùy chỉnh
- [x] **Xem bài nộp** — email, timestamp, audio player, wav2vec score, whisper score, hybrid score, trạng thái
- [x] **Quản lý học sinh** — bảng danh sách (email, ngày tham gia, xóa)
- [x] Hiển thị mã lớp + mật khẩu cho giáo viên share
- [x] Sub-route pages: `teacher/class/[classId]/page.tsx`
- [x] Components: `AssignmentForm.tsx`, `ScoringConfig.tsx`, `SubmissionTable.tsx`

### Phase 4: AI Engine — Hybrid Real AI ✨
- [x] **Wav2Vec2** (`facebook/wav2vec2-large-xlsr-53-german`) — phoneme-level analysis
- [x] **Faster-Whisper** (CTranslate2, model `base`) — speech-to-text transcription tiếng Đức
- [x] **Chạy song song** 2 model bằng `ThreadPoolExecutor` (đa luồng CPU)
- [x] **Hybrid Scoring Engine** v2: `final = (w2v_score × w1) + (whisper_score × w2)`
- [x] API nhận dynamic w1/w2/threshold từ frontend (per-task config)
- [x] **Model warm-up** khi khởi động (lifespan) — tránh lag request đầu tiên
- [x] Audio decode 1 lần duy nhất (`faster_whisper.audio.decode_audio` → float32 16kHz)
- [x] Trả về detailed scores: `wav2vec_raw_score`, `whisper_raw_score`, `hybrid_target_score`
- [x] Error handling + traceback logging
- [x] File cleanup trong `finally` block

### Phase 5: Infrastructure & DevOps
- [x] `config.py` — Centralized settings (host, port, workers, CPU threads, models, device, compute type)
- [x] Intel Cascade Lake optimization (int8 quantization, AVX-512/VNNI)
- [x] `requirements.txt` — fastapi, uvicorn, torch, torchaudio, transformers, faster-whisper
- [x] `start_servers.bat` — one-click startup (Windows)
- [x] `run_production.sh` — GCP production deployment (4 workers, OMP/MKL env vars)
- [x] `sync_git.bat` — auto git add/commit/push
- [x] `.github/workflows/deploy.yml` — GitHub Actions auto-deploy to GCP VM via SSH
- [x] `.gitignore` — venv, pycache, temp_audio, keys, node_modules
- [x] `lib/firestore.ts` — typed interfaces + CRUD (ClassData, AssignmentData, SubmissionData, DetailedScore)
- [x] `lib/storage.ts` — Firebase Storage upload + download helpers
- [x] Python venv setup
- [x] Frontend sub-routes: `student/class/[classId]`, `student/free`, `teacher/class/[classId]`

---

## 🔲 Chưa làm

### Phase 6: UX & Tính năng nâng cao *(Đề xuất tiếp theo)*
- [ ] 🔊 Nghe audio mẫu phát âm chuẩn (TTS hoặc pre-recorded)
- [ ] 📈 Lịch sử luyện tập cá nhân — dashboard xem tiến trình theo thời gian
- [ ] 📊 Thống kê tổng quan cho giáo viên (tỷ lệ đạt lớp, điểm trung bình, biểu đồ)
- [ ] 📥 Export kết quả lớp ra CSV/PDF
- [ ] 🔔 Realtime notifications (FCM) — thông báo khi GV giao bài, khi HS nộp bài
- [ ] 📱 Responsive design tối ưu cho mobile
- [ ] 🌐 PWA support (offline practice mode)
- [ ] 🌙 Dark/Light mode toggle

### Phase 7: Bảo mật & Scale
- [ ] Firestore Security Rules — restrict read/write theo role
- [ ] API rate limiting (per-user, per-IP)
- [ ] CORS restrict cho production domain
- [ ] Firebase Storage rules (chỉ cho phép upload vào folder của mình)
- [ ] Input sanitization (XSS prevention)
- [ ] Giới hạn số lần nộp bài (maxAttempts đã có interface nhưng chưa enforce)

### Phase 8: Mở rộng
- [ ] Đa ngôn ngữ (Anh, Pháp, Tây Ban Nha, ...)
- [ ] Gamification (huy hiệu, streak, bảng xếp hạng)
- [ ] AI model upgrade (large-v3 Whisper, phoneme-specific scoring)
- [ ] Admin dashboard (quản lý toàn hệ thống)
- [ ] Landing page + pricing (nếu thương mại hóa)

---

## 📁 Cấu trúc dự án hiện tại

```
DT3_PronunCheck/
├── main.py                              # 🐍 FastAPI + Hybrid AI (Wav2Vec2 + Whisper)
├── config.py                            # ⚙️ Centralized config (hardware, models, server)
├── requirements.txt                     # 📦 Python deps (torch, transformers, faster-whisper)
├── index.html                           # 📄 Frontend cũ (prototype)
├── roadmap.md                           # 🗺️ File này
├── README.md                            # 📖 Hướng dẫn dự án
├── start_servers.bat                    # 🚀 Startup script (Windows)
├── run_production.sh                    # 🚀 Production deploy (GCP)
├── sync_git.bat                         # 🔄 Auto git sync
├── .gitignore
├── .github/
│   └── workflows/deploy.yml             # 🔄 GitHub Actions → GCP VM auto-deploy
├── venv/                                # 🐍 Python virtual environment
├── temp_audio/                          # 📂 Audio tạm (auto-cleanup)
├── test/                                # 🧪 Audio test files
├── structure note/
│   └── DEPLOYMENT_INFO.md
│
└── frontend-pronuncheck/                # 🖥️ Next.js Frontend
    ├── .env.local                       # 🔑 Firebase keys + API URL
    ├── package.json                     # 📦 Dependencies (firebase, lucide-react, next, react)
    ├── app/
    │   ├── firebase.ts                  # 🔥 Firebase init (Auth + Firestore + Storage)
    │   ├── layout.tsx                   # 📐 Root layout + AuthProvider + force-dynamic
    │   ├── globals.css                  # 🎨 Tailwind CSS theme
    │   ├── page.tsx                     # 🏠 Role selection + auto-redirect
    │   ├── contexts/
    │   │   └── AuthContext.tsx           # 🔐 Auth state + role (student/teacher)
    │   ├── components/
    │   │   ├── AuthGuard.tsx            # 🛡️ Route protection + role guard
    │   │   └── AudioRecorder.tsx        # 🎤 Reusable audio recorder component
    │   ├── lib/
    │   │   ├── firestore.ts            # 📚 Firestore typed CRUD
    │   │   └── storage.ts              # 📦 Firebase Storage helpers
    │   ├── login/
    │   │   └── page.tsx                 # 🔑 Login/Register (role-aware via URL param)
    │   ├── student/
    │   │   ├── page.tsx                 # 🎓 Student dashboard (Free + Class modes)
    │   │   ├── free/page.tsx            # 🎤 Free practice sub-page
    │   │   └── class/[classId]/page.tsx # 📋 Class assignments sub-page
    │   └── teacher/
    │       ├── page.tsx                 # 👨‍🏫 Teacher dashboard
    │       ├── class/[classId]/page.tsx  # 📊 Class details sub-page
    │       └── components/
    │           ├── AssignmentForm.tsx    # ✏️ Create assignment form
    │           ├── ScoringConfig.tsx     # ⚙️ Scoring weights config
    │           └── SubmissionTable.tsx   # 📋 Submissions table
    └── public/                          # 📂 Static assets
```

---

## 📝 Ghi chú kỹ thuật

| Mục | Chi tiết |
|---|---|
| **Production API** | `https://api.thuy-tien.pro/api/v1/assess` |
| **Frontend Dev** | `http://localhost:3000` |
| **Backend Dev** | `http://localhost:8000` (Swagger: `/docs`) |
| **Firebase Auth** | Email/Password + Role lưu trong Firestore `users/` |
| **AI Models** | Wav2Vec2 XLSR-53-German + Faster-Whisper `base` (int8 on CPU) |
| **Scoring** | `hybrid = (wav2vec × w1) + (whisper × w2)`, pass if `≥ threshold` |
| **Concurrency** | ThreadPoolExecutor — 2 models chạy song song per request |
| **Production** | GCP c2-standard-8, 4 Uvicorn workers, ~6GB RAM usage |
| **CI/CD** | GitHub Actions → SSH deploy to GCP VM on push to `main` |
| **File Limits** | Max 10MB, chỉ .wav/.webm/.mp3/.ogg |
