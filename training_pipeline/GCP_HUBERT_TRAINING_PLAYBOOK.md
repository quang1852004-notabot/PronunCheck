# Cẩm Nang Kỹ Thuật: Huấn Luyện HuBERT IPA Trên GCP GPU VM (NVIDIA L4)

Tài liệu này tổng hợp toàn bộ kiến thức, kinh nghiệm thực chiến và các giải pháp phòng tránh lỗi khi huấn luyện/fine-tune các mô hình nhận diện giọng nói (HuBERT, Wav2Vec2) sang bảng phiên âm quốc tế (IPA) trên Google Cloud Platform.

---

## 1. Tối Ưu Hóa Dữ Liệu & Pipeline (Audio vs Text)

### 1.1. Tránh giải nén Audio hàng loạt trên CPU
- **Vấn đề:** Khi dùng `dataset.map()` trên cột `Audio`, nếu truy cập `batch["audio"]["array"]`, HuggingFace sẽ giải nén toàn bộ tệp âm thanh dạng nén (FLAC/WAV) thành mảng float 32-bit trong RAM. Với tập dữ liệu lớn (300.000 files ~ 500-1000 giờ), điều này tiêu tốn hơn 100GB RAM và làm sập tiến trình.
- **Nguyên tắc vàng:** 
  - **CPU:** Chỉ làm nhiệm vụ dịch văn bản sang IPA (`Text -> IPA` qua G2P backend như `espeak-ng`). Tác vụ này siêu nhẹ và đạt tốc độ **900+ câu/giây**.
  - **GPU / PyTorch DataLoader:** Để nguyên file âm thanh nén. Việc giải nén âm thanh sẽ diễn ra theo từng batch tức thời (on-the-fly) trong `DataCollator` khi nạp vào GPU trong lúc huấn luyện.

### 1.2. Đánh giá chất lượng tập dữ liệu (Domain & SNR)
- **Mozilla Common Voice (Thu âm cộng đồng):** Chất lượng không đồng đều (lẫn tiếng ồn, quạt, mic rè). Cần lọc SNR ở mức vừa phải (`SNR > 5.0 dB`) để loại bỏ file hỏng nhưng vẫn giữ được độ phong phú của môi trường thực tế (tránh hiện tượng Domain Mismatch).
- **Multilingual LibriSpeech (Sách nói Audiobook):** 100% đã được thu âm trong phòng studio tĩnh lặng (SNR mặc định 20–30 dB). **Tuyệt đối không cần chạy bước đo SNR trên CPU** để tránh lãng phí tài nguyên và thời gian.

### 1.3. "Cái bẫy" của `dataset.filter` và giải pháp `input_columns`
- **Vấn đề:** Khi gọi `dataset.filter(lambda x: len(x["ipa"]) > 1)`, mặc dù hàm lambda chỉ kiểm tra text, Hugging Face mặc định vẫn tự động giải nén cột `x["audio"]` cho từng dòng. Điều này khiến tốc độ lọc bị tụt dốc thê thảm xuống **17 câu/giây** (mất gần 2 tiếng cho 120.000 mẫu).
- **Giải pháp:** Luôn chỉ định `input_columns=["ipa"]` để cấm Hugging Face đụng vào cột audio:
  ```python
  # Tốc độ vọt lên 340.000+ câu/giây (xong 120.000 mẫu trong 0.35 giây)
  dataset = dataset.filter(lambda ipa: len(ipa) > 1, input_columns=["ipa"])
  ```

---

## 2. Phòng Chống Lỗi Đa Luồng (Multiprocessing & Fork-Safety)

### 2.1. Lỗi Subprocess Abruptly Died với thư viện C++
- **Nguyên nhân:** Các thư viện như `phonemizer` giao tiếp ngầm với binary C++ (`espeak-ng`). Nếu khởi tạo đối tượng `EspeakBackend` ở phạm vi toàn cục (Global) rồi truyền vào `dataset.map(num_proc > 1)`, việc phân nhánh tiến trình (fork) sẽ làm gãy các ống dẫn (Broken Pipe / Segmentation Fault), dẫn đến lỗi:
  `RuntimeError: One of the subprocesses has abruptly died during map operation.`
- **Khắc phục:**
  1. Khởi tạo đối tượng backend bên trong hàm mapper:
     ```python
     def convert_to_ipa(batch):
         backend = EspeakBackend(language='de', preserve_punctuation=True, with_stress=True)
         ...
     ```
  2. Hoặc nếu chỉ xử lý văn bản, chạy đơn luồng với `batched=True, batch_size=1000` là đủ nhanh (120.000 câu xong trong 90 giây) mà đảm bảo 100% không bao giờ sập.

---

## 3. Tương Thích Hugging Face Transformers & Kiến Trúc CTC

### 3.1. Thay đổi Vocabulary Size (`ignore_mismatched_sizes=True`)
Khi fine-tune từ model có sẵn (ví dụ: `facebook/hubert-large-ls960-ft` với 32 ký tự tiếng Anh) sang bảng IPA (48–60 ký tự), kích thước của lớp phân loại `lm_head` sẽ bị lệch. Bắt buộc phải khai báo:
```python
model = HubertForCTC.from_pretrained(
    MODEL_ID,
    ctc_loss_reduction="mean",
    pad_token_id=processor.tokenizer.pad_token_id,
    vocab_size=len(processor.tokenizer),
    ignore_mismatched_sizes=True  # Bắt buộc để khởi tạo lại lm_head
)
```

### 3.2. Cập nhật API Transformers mới (>= 4.46)
- Không dùng `tokenizer=` trong `Trainer.__init__`, thay bằng `processing_class=processor.tokenizer`.
- Bỏ các tham số cũ hoặc gây lỗi nếu có `TypeError` (ví dụ `group_by_length=True`, `eval_strategy="no"`).

### 3.3. Chuẩn bị DataCollator cho CTC
Tạo class `DataCollatorCTCWithPadding` để pad dynamic cho cả mảng âm thanh và nhãn IPA, đồng thời gán nhãn padding bằng `-100` để CTC Loss bỏ qua:
```python
@dataclasses.dataclass
class DataCollatorCTCWithPadding:
    processor: Wav2Vec2Processor
    padding: Union[bool, str] = True
    
    def __call__(self, features: List[Dict]) -> Dict[str, torch.Tensor]:
        input_features = [{"input_values": feature["audio"]["array"]} for feature in features]
        label_features = [{"input_ids": self.processor.tokenizer(feature["ipa"]).input_ids} for feature in features]

        batch = self.processor.feature_extractor.pad(
            input_features, padding=self.padding, return_tensors="pt"
        )
        labels_batch = self.processor.tokenizer.pad(
            label_features, padding=self.padding, return_tensors="pt"
        )
        labels = labels_batch["input_ids"].masked_fill(labels_batch.attention_mask.ne(1), -100)
        batch["labels"] = labels
        return batch
```

### 3.4. BẮT BUỘC đặt `remove_unused_columns=False`
Khi dùng Custom DataCollator, Hugging Face `Trainer` mặc định sẽ quét chữ ký hàm của `model.forward()` và xóa sạch các cột không khớp tên (`audio`, `transcript`, `ipa`), dẫn đến lỗi:
`ValueError: No columns in the dataset match the model's forward method signature...`
👉 Bắt buộc phải khai báo trong `TrainingArguments`:
```python
training_args = TrainingArguments(
    output_dir=OUTPUT_DIR,
    remove_unused_columns=False,  # Ngăn Trainer tự ý xóa cột dữ liệu
    ...
)
```

---

## 4. Vận Hành GCP Deep Learning VM, Chi Phí & Giám Sát

### 4.1. Daemon Tự Tắt Máy Tiết Kiệm Chi Phí (Auto-shutdown Guard)
Gài tiến trình giám sát PID của script Python. Khi script kết thúc (hoặc sập do lỗi), VM sẽ tự tắt máy ngay lập tức để không bị trừ tiền oan:
```bash
nohup bash -c 'tail --pid=<PID> -f /dev/null; sudo shutdown -h now' > /dev/null 2>&1 &
```

### 4.2. Khởi chạy Background Bền Vững
Luôn sử dụng `nohup` kèm cờ `-u` (unbuffered log) và dấu `&` ở cuối để tiến trình tiếp tục chạy khi tắt máy tính / đóng tab SSH:
```bash
nohup python3 -u run_training_v2.py > training_v2.log 2>&1 &
```

### 4.3. Chuyển File Lên VM Không Bị Lỗi
- **Hạn chế:** Không dùng Copy-Paste các đoạn mã lớn trực tiếp vào Web SSH Terminal (dễ bị nuốt ký tự dẫn đến `SyntaxError`).
- **Khuyến nghị:** Dùng tính năng **UPLOAD FILE** trên thanh công cụ của Google Cloud Web SSH để tải file `.py` trực tiếp lên máy ảo.

### 4.4. Giám Sát Tiến Trình & Hiểu Chỉ Số Huấn Luyện
- **Chỉ số `s/it` (Seconds per Iteration):** Số giây hoàn thành 1 bước tính toán (batch). Ví dụ: `5.39s/it` với batch hiệu dụng 32 mẫu nghĩa là GPU xử lý xong 32 câu sau mỗi 5.39 giây.
- **Công thức tính tổng bước (Total Steps):**
  $$\text{Total Steps} = \frac{\text{Tổng số mẫu}}{\text{per\_device\_batch\_size} \times \text{gradient\_accumulation\_steps}} \times \text{Epochs}$$
  *Ví dụ:* $\frac{120.000}{8 \times 4} \times 10 = 37.500 \text{ steps}$.
- **Ước tính thời gian & chi phí trên NVIDIA L4:**
  - 37.500 steps $\times$ 5.39s $\approx$ 56 giờ ($\sim 2.3$ ngày).
  - Chi phí VM L4 $\sim 0.75\$/\text{h} \times 56\text{h} \approx 42\$$ ($\sim 1.050.000$ VNĐ).
