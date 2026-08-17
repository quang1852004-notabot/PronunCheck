# 🎤 PronunCheck — Ứng dụng Luyện Phát Âm Tiếng Đức

> Web app kiểm tra và luyện phát âm tiếng Đức cho học sinh, sử dụng **AI Hybrid V3** (Wav2Vec2 Forced Alignment + Faster-Whisper + DTW), với hệ thống lớp học quản lý bởi giáo viên.

![Next.js](https://img.shields.io/badge/Next.js-16.3.0-black?logo=next.js)
![React](https://img.shields.io/badge/React-19.2.8-blue?logo=react)
![FastAPI](https://img.shields.io/badge/FastAPI-v2.1-009688?logo=fastapi)
![Firebase](https://img.shields.io/badge/Firebase-Auth%20%2B%20Firestore%20%2B%20Storage-FFCA28?logo=firebase)
![PyTorch](https://img.shields.io/badge/PyTorch-Wav2Vec2-EE4C2C?logo=pytorch)
![Vercel](https://img.shields.io/badge/Frontend-Vercel-black?logo=vercel)
![GCP](https://img.shields.io/badge/Backend-GCP%20VM-4285F4?logo=googlecloud)

---

## 🏗️ Kiến trúc Triển khai (Deployment Architecture)

Dự án tách biệt hoàn toàn giữa **Frontend (Serverless)** và **Backend (AI Compute Engine)** nhằm tối ưu chi phí và hiệu năng:

```
                          [ Người Dùng (Học sinh / Giáo viên) ]
                                            │
                   ┌────────────────────────┴────────────────────────┐
                   │                                                 │
            (Truy cập Web)                                   (Chấm điểm Audio)
                   ▼                                                 ▼
        ┌─────────────────────┐                           ┌─────────────────────┐
        │  Next.js Frontend   │                           │  FastAPI AI Backend │
        │   (Deploy Vercel)   │                           │    (Deploy GCP VM)  │
        ├─────────────────────┤                           ├─────────────────────┤
        │ • Global Edge CDN   │                           │ • GCP c2-standard-8 │
        │ • Serverless 0đ     │                           │ • PyTorch Wav2Vec2  │
        │ • Auto SSL & Scale  │                           │ • Faster-Whisper    │
        │ • Auto Build Git    │                           │ • FastDTW + TTS     │
        └─────────────────────┘                           └─────────────────────┘
                   │                                                 │
                   └──────────────────┬──────────────────────────────┘
                                      ▼
                        ┌───────────────────────────┐
                        │       Firebase Cloud      │
                        │ • Auth (Email / Role)     │
                        │ • Cloud Firestore (DB)    │
                        │ • Storage (Audio Upload)  │
                        └───────────────────────────┘
```

### 🔄 Luồng Tự động Hóa (CI/CD Workflow)
Khi bạn chạy script `sync_git.bat` (`git push origin main`):
1. **Frontend (Vercel):** Nhận Webhook từ GitHub ➔ Tự động `npm install` & `next build` ➔ Deploy bản mới trong 1 phút.
2. **Backend (GitHub Actions):** Tự động SSH vào GCP VM ➔ `git pull origin main` ➔ `pip install` ➔ Khởi động lại service `pronuncheck-backend`.

---

## 📸 Tổng quan tính năng

### Công nghệ Lõi AI V3
1. **Chấm điểm theo Ký tự (Character-level)**: 
   Sử dụng `torchaudio.functional.forced_align` kết hợp với Wav2Vec2 XLSR để tính điểm phát âm cho *từng chữ cái/âm tiết* trong từ.
2. **Chấm điểm Ngữ điệu (Intonation)**:
   Sử dụng **FastDTW** (Dynamic Time Warping) và MFCC (Mel-frequency cepstral coefficients) qua `librosa` để đo độ lệch ngữ điệu của người dùng so với audio mẫu.
3. **Auto-Generate Audio Mẫu**:
   Tích hợp Google Cloud Text-to-Speech (Neural2-B) tự động sinh và cache file audio chuẩn để làm mốc so sánh DTW.

### Tính năng chính

| Tính năng | Mô tả |
|---|---|
| 🤖 **AI Hybrid Scoring** | Wav2Vec + Whisper + DTW chạy song song, chấm điểm tức thì |
| 🎯 **Feedback chi tiết** | AI chỉ ra học sinh phát âm sai chữ cái nào và sai như thế nào |
| 🔐 **Auth theo vai trò** | Phân vai Học sinh / Giáo viên |
| 🎤 **Ghi âm trực tiếp** | Thu âm qua trình duyệt, nghe lại trước khi nộp |
| 🏫 **Hệ thống lớp học** | GV tạo lớp ➔ HS tham gia bằng mã + mật khẩu |
| 📋 **Giao & làm bài tập** | GV giao bài ➔ HS làm ➔ GV xem kết quả + nghe audio |

---

## 🛠 Tech Stack

| Layer | Công nghệ | Nơi Triển Khai |
|---|---|---|
| **Frontend** | Next.js 16.3 • React 19 • TypeScript • Tailwind CSS 4 | **Vercel** (Serverless) |
| **Backend** | Python FastAPI • Uvicorn (4 Workers) | **GCP VM** (`c2-standard-8`) |
| **AI: Forced Alignment** | Wav2Vec2 (`facebook/wav2vec2-large-xlsr-53-german`) — PyTorch | GCP VM |
| **AI: Transcription** | Faster-Whisper (`base`) — CTranslate2 | GCP VM |
| **AI: Intonation** | FastDTW • Librosa MFCC | GCP VM |
| **TTS (Audio mẫu)** | Google Cloud Text-to-Speech API | GCP VM |
| **Database & Storage** | Firebase Auth • Cloud Firestore • Storage | Firebase Cloud |

---

## 🚀 Hướng dẫn cài đặt & Triển khai

### 1. Cấu hình Frontend trên Vercel
1. Import repository vào Vercel.
2. Tại **Settings ➔ General**: Đặt **Root Directory** là `frontend-pronuncheck`.
3. Thêm các biến môi trường tại **Settings ➔ Environment Variables**:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=xxx
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxx
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=xxx
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=xxx
   NEXT_PUBLIC_FIREBASE_APP_ID=xxx
   NEXT_PUBLIC_API_URL=https://api.thuy-tien.pro
   ```

### 2. Cài đặt Cục bộ (Local Development)

```bash
git clone <repo-url>
cd DT3_PronunCheck

# Backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt

# Frontend
cd frontend-pronuncheck
npm install
```

**Khởi chạy cục bộ (Windows):**
```bash
start_servers.bat
```

---

## 🔌 API Endpoints

### Chấm điểm Phát âm (AI V3)

| Method | Endpoint | Mô tả |
|---|---|---|
| `POST` | `/api/v1/assess` | Trả về điểm chi tiết (Precise, Fluent, DTW) và Char Scores |

**Request**: multipart/form-data (`audio_file`, `expected_word`, `threshold`, v.v.)

**Response**:
```json
{
  "status": "success",
  "word": "Schule",
  "char_scores": [
    {"char": "S", "score": 0.95, "actual": "s"},
    {"char": "C", "score": 0.95, "actual": "c"},
    {"char": "H", "score": 0.92, "actual": "h"},
    {"char": "U", "score": 0.45, "actual": "o"},
    {"char": "L", "score": 0.88, "actual": "l"},
    {"char": "E", "score": 0.90, "actual": "e"}
  ],
  "assessment": {
    "precise_score": 84.17,
    "whisper_score": 92.3,
    "dtw_score": 81.5,
    "fluent_score": 75.22,
    "hybrid_target_score": 80.5,
    "is_passed": true,
    "feedback": "Bạn đang đọc từ 'Schule', nhưng hệ thống nhận thấy bạn phát âm âm 'U' giống với âm 'o'."
  }
}
```

---

## 📄 License
Private project — DT3 Team.
