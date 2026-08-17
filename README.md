# 🎤 PronunCheck — Ứng dụng Luyện Phát Âm Tiếng Đức

> Web app kiểm tra và luyện phát âm tiếng Đức toàn diện cho học sinh và giáo viên, sử dụng **AI Hybrid V3.5** (Wav2Vec2 German Phonetics + Faster-Whisper + F0 Semitones FastDTW), với hệ thống quản lý lớp học trực quan.

![Next.js](https://img.shields.io/badge/Next.js-16.3.0-black?logo=next.js)
![React](https://img.shields.io/badge/React-19.2.8-blue?logo=react)
![FastAPI](https://img.shields.io/badge/FastAPI-v3.5-009688?logo=fastapi)
![Firebase](https://img.shields.io/badge/Firebase-Auth%20%2B%20Firestore%20%2B%20Storage-FFCA28?logo=firebase)
![PyTorch](https://img.shields.io/badge/PyTorch-Wav2Vec2-EE4C2C?logo=pytorch)
![Vercel](https://img.shields.io/badge/Frontend-Vercel-black?logo=vercel)
![GCP](https://img.shields.io/badge/Backend-GCP%20VM-4285F4?logo=googlecloud)

---

## 📂 Cấu trúc Dự án (Project Structure)

```
DT3_PronunCheck/
├── main.py                    # 🚪 API Gateway & FastAPI Entry Point (/api/v1/assess)
├── config.py                  # ⚙️ Cấu hình tập trung (Server, CPU đa luồng, mô hình AI)
├── requirements.txt           # 📦 Danh sách dependencies Python chính
│
├── Light_ScoringBackend/      # 🧠 Package AI Chấm điểm Thứ cấp (Light Tier Engine)
│   ├── __init__.py            # Khởi tạo package Python & export scoring, german_phonetics
│   ├── scoring.py             # Thuật toán Dynamic Sigmoid Scoring V3.5, F0 Pitch DTW & Parallel Execution
│   ├── german_phonetics.py    # Bộ luật ngữ âm tiếng Đức (Ich/Ach, Vô thanh hóa, Vowel Duration, Normalizer)
│   └── README.md              # Tài liệu kỹ thuật chi tiết của package Light Backend
│
├── training_pipeline/         # 🚀 Pipeline huấn luyện HuBERT Large IPA (Pro Tier - GPU Training)
│   ├── GCP_HUBERT_TRAINING_PLAYBOOK.md # Sổ tay hướng dẫn huấn luyện HuBERT Large trên GCP L4 GPU
│   └── run_training_v2.py     # Script tiền xử lý & fine-tune mô hình HuBERT sang bảng ký âm IPA
│
├── frontend-pronuncheck/      # 💻 Web Application xây dựng bằng Next.js 16 (App Router)
│   ├── app/                   # Các trang ứng dụng (Student, Teacher, Auth, Dashboard)
│   ├── public/                # Static assets, icons, manifest
│   └── package.json           # Dependencies Next.js, React 19, Tailwind CSS 4
│
├── Excution/                  # 🛠️ Tập lệnh khởi chạy hệ thống (Local & Production Server)
│   ├── check_backend.bat      # Kiểm tra trạng thái kết nối tới máy chủ GCP VM
│   ├── run_production.sh      # Script khởi chạy FastAPI trên GCP VM (4 Workers, OMP 4 luồng)
│   ├── start_servers.bat      # Khởi động đồng thời Backend và Frontend cho môi trường Local
│   └── sync_git.bat           # Đồng bộ mã nguồn lên GitHub tự động kích hoạt CI/CD
│
├── test/                      # 🧪 Bộ kiểm thử tự động (Unit Test Suites)
│   ├── test_light_scoring.py  # 11 unit tests kiểm tra luật ngữ âm Đức & thuật toán chấm điểm
│   └── ElevenLabs_2026-08-Schule.mp3 # File âm thanh mẫu kiểm thử
│
├── README.md                  # Tài liệu tổng quan dự án
└── roadmap.md                 # Kế hoạch phát triển kỹ thuật & kiến trúc dài hạn
```

---

## 🏗️ Kiến trúc Triển khai (Deployment Architecture)

Dự án tách biệt hoàn toàn giữa **Frontend (Serverless Edge)** và **Backend (AI Compute Engine)**:

```
                          [ Người Dùng (Học sinh / Giáo viên) ]
                                            │
                   ┌────────────────────────┴────────────────────────┐
                   │                                                 │
            (Truy cập Web)                                   (Chấm điểm Audio)
                   ▼                                                 ▼
        ┌─────────────────────┐                           ┌─────────────────────┐
        │  Next.js Frontend   │                           │  FastAPI AI Gateway │
        │   (Deploy Vercel)   │                           │    (Deploy GCP VM)  │
        ├─────────────────────┤                           ├─────────────────────┤
        │ • Global Edge CDN   │                           │ • GCP c2-standard-8 │
        │ • Serverless 0đ     │                           │ • Light_Scoring     │
        │ • Auto SSL & Scale  │                           │ • PyTorch Wav2Vec2  │
        │ • Auto Build Git    │                           │ • Faster-Whisper    │
        │ • Tailwind CSS 4    │                           │ • FastDTW + TTS     │
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
Khi thực hiện `git push origin main` (hoặc chạy `Excution/sync_git.bat`):
1. **Frontend (Vercel):** Nhận Webhook từ GitHub ➔ Tự động build và deploy bản mới trên mạng Edge toàn cầu.
2. **Backend (GitHub Actions):** Tự động SSH vào GCP VM (`.github/workflows/deploy.yml`) ➔ `git pull origin main` ➔ `pip install -r requirements.txt` ➔ Khởi động lại service `pronuncheck-backend`.

---

## 🧠 Công nghệ Lõi AI V3.5 (Light Tier & German Phonetics Engine)

1. **Chấm điểm theo Ký tự & Luật Âm ngữ học Đức (German Phonetics & Character-level)**: 
   Sử dụng `torchaudio.functional.forced_align` kết hợp Wav2Vec2 XLSR German và bộ luật chuyên biệt:
   - Phân biệt cặp âm **Ich-Laut (/ç/)** vs **Ach-Laut (/x/)** theo ngữ cảnh nguyên âm đứng trước.
   - Cơ chế nới lỏng dung sai cho **Hiện tượng vô thanh hóa phụ âm cuối (Auslautverhärtung)** ($d \to t, b \to p, g \to k, -ig \to \text{/ɪç/}$).
   - Đánh giá thời lượng nguyên âm dài vs ngắn (**Vowel Duration Scoring**: $iː$ vs $ɪ$).
2. **Chấm điểm Ngữ điệu qua Đường cong Cao độ (F0 Pitch Contour FastDTW)**:
   Sử dụng **FastDTW** trên đường cong bán âm tương đối ($\text{Semitones} = 12 \log_2(F_0 / \text{median})$ qua `librosa.pyin`), loại bỏ 100% sai lệch do giới tính hay độ tuổi giọng đọc.
3. **Faster-Whisper Tiny & Bộ Chuẩn hóa Chữ số**:
   - Sử dụng mô hình Tiny `int8` siêu nhẹ (~39MB).
   - Tự động chuẩn hóa chữ số tiếng Đức (`"1, 2, 3..."` $\leftrightarrow$ `"eins, zwei, drei..."`) loại bỏ hoàn toàn lỗi nhận diện chữ số.
4. **Thuật toán Trọng số Động Sigmoid Tuyến tính (Dynamic Sigmoid Scoring)**:
   - Tự động cân bằng giữa độ chính xác âm vị $y_{\text{acc}}$ (cho từ ngắn $w_{\text{acc}} \to 0.82$) và độ lưu loát ngữ điệu $z_{\text{flu}}$ (cho câu dài $w_{\text{flu}} \to 0.73$).
   - Loại bỏ hoàn toàn các phép nhân triệt tiêu, đảm bảo học sinh không bị mất điểm oan.

---

## 🚀 Hướng dẫn Cài đặt & Khởi chạy

### 1. Khởi chạy Cục bộ (Local Development)

```bash
# Clone repository
git clone https://github.com/quang1852004-notabot/PronunCheck.git
cd DT3_PronunCheck

# Cài đặt môi trường Backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt

# Cài đặt môi trường Frontend
cd frontend-pronuncheck
npm install
cd ..
```

**Khởi chạy nhanh toàn bộ hệ thống bằng 1 click:**
* Nhấp đúp chuột vào file [`Excution/start_servers.bat`](file:///d:/DT3_PronunCheck/Excution/start_servers.bat) trên Windows.

### 2. Chạy Kiểm thử Tự động (Unit Tests)
```bash
python test/test_light_scoring.py
```

---

## 🔌 API Endpoints

### Chấm điểm Phát âm (AI V3.5)

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/` | Kiểm tra trạng thái máy chủ (Health Check) |
| `POST` | `/api/v1/assess` | Đánh giá audio và trả về điểm chi tiết từng âm vị, ngữ điệu, và feedback sư phạm |

**Request**: `multipart/form-data` (`audio_file`, `expected_word`)

**Response**:
```json
{
  "status": "success",
  "word": "Schule",
  "char_scores": [
    { "char": "S", "score": 0.95, "actual": "S", "duration_frames": 18 },
    { "char": "C", "score": 0.92, "actual": "C", "duration_frames": 12 },
    { "char": "H", "score": 0.93, "actual": "H", "duration_frames": 14 },
    { "char": "U", "score": 0.91, "actual": "U", "duration_frames": 35, "duration_multiplier": 1.0 },
    { "char": "L", "score": 0.88, "actual": "L", "duration_frames": 10 },
    { "char": "E", "score": 0.89, "actual": "E", "duration_frames": 15 }
  ],
  "assessment": {
    "precise_score": 91.33,
    "whisper_score": 100.0,
    "dtw_score": 85.4,
    "fluent_score": 91.24,
    "hybrid_target_score": 88.52,
    "is_passed": true,
    "feedback": "Phát âm rất tốt! Bạn đã phát âm chính xác các âm đặc trưng.",
    "weights": {
      "w_acc": 0.818,
      "w_flu": 0.182,
      "effective_length": 1.0,
      "num_words": 1,
      "num_syllables": 2
    }
  }
}
```
