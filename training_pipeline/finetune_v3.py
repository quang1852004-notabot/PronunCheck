import os
import re
import json
import torch
import numpy as np
import evaluate
import dataclasses
from typing import Dict, List, Union
from datasets import load_dataset
from phonemizer.backend import EspeakBackend
from transformers import (
    Wav2Vec2CTCTokenizer,
    Wav2Vec2FeatureExtractor,
    Wav2Vec2Processor,
    HubertForCTC,
    TrainingArguments,
    Trainer,
    EarlyStoppingCallback
)

# ==========================
# 1. CẤU HÌNH CƠ BẢN
# ==========================
MODEL_ID = "facebook/hubert-large-ls960-ft"
DATASET_ID = "q1805/german-pronuncheck-mega-dataset"
OUTPUT_DIR = "./hubert-german-ipa-model-v2"

print("1. Đang tải Mega Dataset (Train & Eval) từ Hugging Face...")
dataset = load_dataset(DATASET_ID)

print("2. Chuyển đổi Văn bản sang IPA (Sử dụng kiến trúc Fork-Safe)...")
# TUYỆT ĐỐI TUÂN THỦ GCP SKILL: Khởi tạo EspeakBackend BÊN TRONG hàm để tránh sập RAM & SegFault
def convert_to_ipa(batch):
    backend = EspeakBackend(language='de', preserve_punctuation=True, with_stress=True)
    ipas = backend.phonemize(batch["text"], strip=True)
    clean_ipas = []
    for ipa in ipas:
        ipa = re.sub(r'[.,?!;:()"-]', '', ipa)
        ipa = re.sub(r'([ˈˌ])([a-zæœøʏɪʊɛɔəɐ]+)', r'\2\1', ipa)
        ipa = re.sub(r'\s+', ' ', ipa).strip()
        clean_ipas.append(ipa)
    return {"ipa": clean_ipas}
# --- CHÈN THÊM DÒNG NÀY ---
print("Đang quét và loại bỏ các dòng bị lỗi null/trống...")
dataset = dataset.filter(lambda x: x["text"] is not None and isinstance(x["text"], str) and len(x["text"].strip()) > 0, num_proc=4)

# Map song song chỉ trên Text, cách ly hoàn toàn Audio
dataset = dataset.map(convert_to_ipa, batched=True, batch_size=1000, num_proc=4)

# Dùng input_columns=["ipa"] để ép Hugging Face không bung file Audio lúc filter
dataset = dataset.filter(lambda ipa: len(ipa) > 1, input_columns=["ipa"], num_proc=4)

print("3. Khởi tạo Ma trận Từ vựng IPA (Tokenizer)...")
all_chars = set()
for text in dataset["train"]["ipa"]:
    all_chars.update(list(text))

vocab_dict = {c: i for i, c in enumerate(sorted(list(all_chars)))}
vocab_dict["|"] = vocab_dict.get(" ", len(vocab_dict))
vocab_dict["[UNK]"] = len(vocab_dict)
vocab_dict["[PAD]"] = len(vocab_dict)

with open("vocab.json", "w", encoding="utf-8") as f:
    json.dump(vocab_dict, f)

tokenizer = Wav2Vec2CTCTokenizer("vocab.json", unk_token="[UNK]", pad_token="[PAD]", word_delimiter_token="|")
feature_extractor = Wav2Vec2FeatureExtractor(feature_size=1, sampling_rate=16000, padding_value=0.0, do_normalize=True, return_attention_mask=True)
processor = Wav2Vec2Processor(feature_extractor=feature_extractor, tokenizer=tokenizer)


print("4. Chuẩn bị DataCollator & Cấu hình Evaluate (Tính điểm PER)...")
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
        # Bắt buộc thay đệm padding bằng -100 để CTC Loss loại bỏ sai số
        labels = labels_batch["input_ids"].masked_fill(labels_batch.attention_mask.ne(1), -100)
        batch["labels"] = labels
        return batch

data_collator = DataCollatorCTCWithPadding(processor=processor, padding=True)

# Khởi tạo mô đun WER nhưng áp dụng lên Token Âm vị => Biến thành PER
per_metric = evaluate.load("wer")
def compute_metrics(pred):
    pred_logits = pred.predictions
    pred_ids = np.argmax(pred_logits, axis=-1)
    # Loại bỏ nhãn -100 trước khi decode
    pred.label_ids[pred.label_ids == -100] = processor.tokenizer.pad_token_id
    
    pred_str = processor.batch_decode(pred_ids)
    label_str = processor.batch_decode(pred.label_ids, group_tokens=False)
    
    per = per_metric.compute(predictions=pred_str, references=label_str)
    return {"per": per}


print("5. Khởi tạo Kiến trúc Acoustic Model...")
model = HubertForCTC.from_pretrained(
    MODEL_ID, 
    ctc_loss_reduction="mean", 
    pad_token_id=processor.tokenizer.pad_token_id,
    vocab_size=len(processor.tokenizer),
    # BẮT BUỘC: Khởi tạo lại lm_head vì Bảng IPA (60 nhãn) to hơn Bảng tiếng Anh (32 nhãn)
    ignore_mismatched_sizes=True 
)
model.freeze_feature_encoder()


print("6. Nạp cấu hình TrainingArguments & EarlyStopping (Patience = 5)...")
training_args = TrainingArguments(
    output_dir=OUTPUT_DIR,
    per_device_train_batch_size=8,
    per_device_eval_batch_size=8,
    gradient_accumulation_steps=4,
    remove_unused_columns=False, # BẮT BUỘC để tránh sập Forward Propagation
    evaluation_strategy="epoch", # Thi thử sau mỗi Epoch
    save_strategy="epoch",
    num_train_epochs=10, 
    fp16=True, 
    logging_steps=100,
    learning_rate=1e-4,
    warmup_steps=1000,
    save_total_limit=2,
    load_best_model_at_end=True, # Tự động lục lại Checkpoint đỉnh nhất khi kết thúc
    metric_for_best_model="per", # Tiêu chí chốt model là sai số âm vị (PER) thấp nhất
    greater_is_better=False,
)

trainer = Trainer(
    model=model,
    data_collator=data_collator,
    args=training_args,
    train_dataset=dataset["train"],
    eval_dataset=dataset["test"],
    processing_class=processor.tokenizer,
    compute_metrics=compute_metrics,
    callbacks=[EarlyStoppingCallback(early_stopping_patience=5)], # Đạp phanh khẩn cấp
)

print("7. BẮT ĐẦU HUẤN LUYỆN TRÊN GPU L4...")
trainer.train()

print("8. Nén Model và Tokenizer xuất chuồng...")
trainer.save_model(OUTPUT_DIR)
processor.save_pretrained(OUTPUT_DIR)
print(" FINETUNE HOÀN TẤT 100%! ")