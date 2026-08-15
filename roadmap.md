# 🗺️ ROADMAP — DT3_PronunCheck

> **Cập nhật lần cuối:** 2026-08-16 03:26

---

## 📋 Tổng quan dự án

| Thuộc tính | Giá trị |
|---|---|
| **Tên dự án** | DT3_PronunCheck |
| **Mô tả** | Web app kiểm tra & luyện phát âm tiếng Đức cho học sinh, đánh giá tới từng ký tự (character-level) |
| **Mục tiêu** | Ghi âm → AI Forced Alignment (Wav2Vec2) + Faster-Whisper + DTW Intonation → Hybrid scoring |
| **Ngôn ngữ mục tiêu** | Tiếng Đức |
| **Production API** | `https://api.thuy-tien.pro` |

### Tech Stack

| Layer | Công nghệ | Phiên bản / Chi tiết |
|---|---|---|
| Frontend | Next.js 16.3 + React 19 + Tailwind CSS 4 | App Router, Server Actions |
| Backend | Python FastAPI + Uvicorn | v2.1, đa luồng |
| **Phát âm từng âm tiết** | **Wav2Vec2 Forced Alignment** (`facebook/wav2vec2-large-xlsr-53-german`) | PyTorch `torchaudio.functional.forced_align` |
| **Phát âm nguyên từ** | **Faster-Whisper** (CTranslate2, model `base`) | Word-level confidence |
| **Ngữ điệu (Intonation)** | **FastDTW + Librosa MFCC** | So sánh khoảng cách ngữ điệu với mẫu gốc |
| Audio Mẫu | Google Cloud Text-to-Speech (Neural2-B) | Tự động sinh audio chuẩn để đối chiếu |
| Database | Firebase Auth + Cloud Firestore + Storage | Lập lịch, chấm điểm, nộp bài |

### Firestore Data Model (Cảnh báo: Hiện đang có sự phân mảnh)

> **⚠️ WARNING:** Hiện tại đang có 2 luồng dữ liệu song song trong mã nguồn:
> 1. Code cũ trong `student/page.tsx` và `teacher/page.tsx` đang dùng root-level collections (`tasks/`, `submissions/`).
> 2. Các trang dynamic routes mới (`class/[classId]`, `lib/firestore.ts`) đang dùng sub-collections (`classes/{id}/assignments`).
> -> **CẦN ĐỒNG NHẤT** (Nên chuyển hẳn sang sub-collections).

---

## ✅ Đã hoàn thành

### Phase 0-3: Core UI & Authentication
- [x] Next.js 16 setup, Tailwind CSS 4, UI Dark Mode
- [x] Firebase Auth (Role-based: Student & Teacher)
- [x] Student Dashboard (Free mode & Class mode)
- [x] Teacher Dashboard (Tạo lớp, tạo bài tập, xem bài nộp)
- [x] Ghi âm qua MediaRecorder, Upload Firebase Storage

### Phase 4: AI Engine v3 — Forced Alignment & DTW (MỚI)
- [x] Tích hợp Wav2Vec2 **Forced Alignment** → tính điểm cho *từng chữ cái/âm tiết*
- [x] Tích hợp **DTW (Dynamic Time Warping)** → chấm điểm *ngữ điệu* (lên xuống giọng) bằng MFCC
- [x] Auto-generate Audio Mẫu: dùng Google Cloud TTS (giọng Neural2-B) sinh file wav gốc để so sánh DTW
- [x] **Hybrid Scoring V3**: `final_score = (precise_score ** w_p) * (fluent_score ** w_f)`
- [x] Feedback động: Nhận diện chính xác học sinh đọc sai chữ cái nào (vd: "phát âm âm 'u' chưa rõ, đọc giống âm 'o'")
- [x] Multi-threading: Chạy song song Wav2Vec2, Whisper, DTW với `ThreadPoolExecutor`

### Phase 5: Infrastructure & Code Cleanup
- [x] Refactor module chấm điểm ra file riêng (`scoring.py`)
- [x] Cập nhật GCP deployment, Docker / Uvicorn configs
- [x] Xóa bỏ code prototype rác (xóa `index.html`)
- [x] Sửa lỗi parse API response do thay đổi cấu trúc trả về

---

## 🔲 Chưa làm (Tiếp theo)

### Phase 6: Đồng bộ UI với AI V3 (Ưu tiên Cao)
- [ ] **UI Hiển thị Character-level Score**: Backend đã trả về `char_scores` cho từng âm tiết. Frontend cần làm component để bôi màu chữ (Xanh = đúng, Đỏ = sai) giống Duolingo.
- [ ] **Sửa Firestore Schema Divergence**: Xóa mã nguồn legacy dùng root collections, migrate hoàn toàn sang sub-collections như thiết kế trong `lib/firestore.ts`.
- [ ] Hiển thị điểm ngữ điệu (DTW Score) và trôi chảy (Whisper Score) độc lập trên UI cho giáo viên.

### Phase 7: Tính năng bổ trợ
- [ ] 🔊 Nghe Audio Mẫu: Backend đã lưu audio mẫu do Google TTS tạo ra tại `reference_audio/`. Frontend cần làm API để fetch và phát file này.
- [ ] 📈 Lịch sử luyện tập cá nhân (Dashboard học sinh)
- [ ] 🔒 Enforce giới hạn số lần nộp bài (Backend validation)
- [ ] 📥 Export Kết quả lớp ra CSV

### Phase 8: Mở rộng
- [ ] Hệ thống Gamification (Streaks, Badges)
- [ ] Push Notifications (FCM)
