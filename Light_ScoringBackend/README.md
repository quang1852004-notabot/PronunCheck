# 🎙️ PronunCheck Light Scoring Backend

> Module máy chủ AI phân tích & chấm điểm phát âm tiếng Đức (Sơ cấp - Light Tier) dựa trên FastAPI, Wav2Vec2 CTC Forced Alignment, Faster-Whisper và F0 Semitone FastDTW.

---

## 📂 Cấu trúc Thư mục

```
Light_ScoringBackend/
├── __init__.py               # Khởi tạo Python package
├── main.py                   # FastAPI service, lifespan warm-up & REST API (/api/v1/assess)
├── scoring.py                # Thuật toán Dynamic Sigmoid Scoring V3.5, F0 Pitch DTW & Parallel Execution
├── german_phonetics.py       # Bộ luật ngữ âm tiếng Đức (Ich/Ach-Laut, Auslautverhärtung, Vowel Duration, Normalizer)
├── config.py                 # Toàn bộ thông số cấu hình phần cứng, đa luồng CPU, model weights & thresholds
├── requirements.txt          # Danh sách thư viện Python cần thiết cho AI Backend
├── reference_audio/          # Bộ nhớ đệm cache file audio phát âm chuẩn bản xứ (Google Cloud TTS / gTTS)
└── temp_audio/               # Thư mục lưu trữ file ghi âm tạm thời của học sinh trong lúc phân tích
```

---

## 🧠 Kiến trúc Kỹ thuật (AI V3.5 Engine)

Hệ thống kết hợp song song 3 trụ cột AI trên `ThreadPoolExecutor`:

1. **Wav2Vec2 XLSR German (`facebook/wav2vec2-large-xlsr-53-german`)**:
   - Chạy CTC Forced Alignment qua `torchaudio.functional.forced_align`.
   - Phân tích độ chuẩn xác từng âm vị/ký tự $y_{\text{acc}} \in [0, 100]$.
   - Áp dụng các quy luật âm ngữ học Đức:
     - Phân loại **Ich-Laut (/ç/)** vs **Ach-Laut (/x/)**.
     - Nới lỏng dung sai cho **Hiện tượng vô thanh hóa phụ âm cuối (Auslautverhärtung)**: $d \to t, b \to p, g \to k, -ig \to \text{/ɪç/}$.
     - Phân loại thời lượng nguyên âm dài vs ngắn (**Vowel Duration Scoring**).

2. **So khớp Cao độ Ngữ điệu F0 FastDTW (Intonation & Prosody)**:
   - Trích xuất đường cong cao độ bằng thuật toán `pYIN` (`librosa.pyin`).
   - Chuẩn hóa về **Bán âm tương đối (Relative Semitones)**:
     $$\text{Semitones}(t) = 12 \cdot \log_2\left(\frac{F_0(t)}{\text{median}(F_0)}\right)$$
   - So khớp ma trận khoảng cách qua **FastDTW** với audio chuẩn Google Cloud TTS Neural2-B, triệt tiêu 100% sai khác về cao độ nam/nữ/trẻ em.

3. **Faster-Whisper Tiny (Transcript Match & Normalization)**:
   - Mô hình lượng tử hóa `int8` siêu nhẹ (~39MB).
   - Tích hợp bộ chuẩn hóa chữ số tiếng Đức (`1, 2, 3...` $\leftrightarrow$ `eins, zwei, drei...`).
   - Đánh giá tỷ lệ xuất hiện từ và độ tương đồng chuỗi.

4. **Thuật toán Dynamic Sigmoid Scoring (Không triệt tiêu điểm)**:
   $$\text{Final Score} = w_{\text{acc}}(L) \cdot y_{\text{acc}} + w_{\text{flu}}(L) \cdot z_{\text{flu}}$$
   Trong đó:
   - $w_{\text{acc}}(L) = \frac{1}{1 + e^{k(L - L_0)}}$ với $L_0 = 4.0, k = 0.5$.
   - $w_{\text{flu}}(L) = 1 - w_{\text{acc}}(L)$.
   - $z_{\text{flu}} = 0.6 \cdot z_{\text{pitch}} + 0.4 \cdot c_{\text{whisper}}$.

---

## ⚡ Hướng dẫn Khởi chạy

### 1. Khởi chạy Local (Development)
```bash
# Từ thư mục gốc dự án
cd Light_ScoringBackend
uvicorn main:app --reload --port 8000
```

### 2. Khởi chạy Production trên GCP VM (4 Workers)
```bash
# Chạy script tối ưu Cascade Lake AVX-512 / VNNI
bash ../Excution/run_production.sh
```

---

## 🧪 Kiểm thử Tự động (Unit Tests)
```bash
python -m unittest test/test_light_scoring.py
```
