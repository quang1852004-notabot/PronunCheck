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

### Công nghệ Lõi AI V3.5 (Light Tier & German Phonetics Engine)
1. **Chấm điểm theo Ký tự & Luật Âm ngữ học (German Phonetics & Character-level)**: 
   Sử dụng `torchaudio.functional.forced_align` kết hợp với Wav2Vec2 XLSR và bộ luật âm ngữ học tiếng Đức (`german_phonetics.py`):
   - Phân biệt cặp âm **Ich-Laut (/ç/)** vs **Ach-Laut (/x/)** theo ngữ cảnh nguyên âm trước.
   - Cơ chế nới lỏng dung sai cho **Hiện tượng vô thanh hóa phụ âm cuối (Auslautverhärtung)** ($d \to t, b \to p, g \to k$).
   - Đánh giá thời lượng nguyên âm dài vs ngắn (**Vowel Duration Scoring**: $iː$ vs $ɪ$).
2. **Chấm điểm Ngữ điệu qua Đường cong Cao độ (F0 Pitch Contour DTW)**:
   Sử dụng **FastDTW** trên đường cong bán âm tương đối ($\text{Semitones} = 12 \log_2(F_0 / \text{median})$ qua `librosa.pyin`), loại bỏ 100% sai lệch do giới tính/âm sắc giọng đọc.
3. **Độ trọn vẹn $x_{\text{soft}}$ qua Faster-Whisper Tiny**:
   Sử dụng mô hình Tiny int8 siêu nhẹ (~39MB) kiểm tra học viên có nói đủ từ mục tiêu không mà không làm sụt điểm oan do ngắt nghỉ.
4. **Thuật toán Trọng số Động Sigmoid (Dynamic Sigmoid Scoring)**:
   Tự động cân bằng giữa độ chính xác âm vị $y$ (cho từ ngắn $w_{\text{acc}} \to 0.82$) và độ lưu loát ngữ điệu $z$ (cho câu dài $w_{\text{flu}} \to 0.82$).

### Tính năng chính

| Tính năng | Mô tả |
|---|---|
| 🤖 **AI Hybrid Scoring V3.5** | Wav2Vec2 + Whisper Tiny + F0 DTW chạy song song non-blocking |
| 🇩🇪 **German Phonetics Engine** | Xử lý Ich/Ach, Auslautverhärtung, thời lượng nguyên âm dài/ngắn |
| 🎯 **Feedback chi tiết sư phạm** | Chỉ rõ lỗi phát âm, khẩu hình và hướng dẫn sửa chuẩn Đức |
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
| **AI: Forced Alignment** | Wav2Vec2 (`facebook/wav2vec2-large-xlsr-53-german`) + German Phonetics | GCP VM |
| **AI: Transcription & x_soft** | Faster-Whisper (`tiny`, int8) — CTranslate2 | GCP VM |
| **AI: Intonation & Prosody** | FastDTW • Librosa pYIN (F0 Semitones) | GCP VM |
| **TTS (Audio mẫu)** | Google Cloud Text-to-Speech (Neural2-B) | GCP VM |
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
