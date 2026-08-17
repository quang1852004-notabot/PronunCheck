import os
import re
import json
import torch
import numpy as np
from datasets import load_dataset, Audio
from phonemizer.backend import EspeakBackend
import dataclasses
from typing import Dict, List, Union
from transformers import (
    Wav2Vec2CTCTokenizer,
    Wav2Vec2FeatureExtractor,
    Wav2Vec2Processor,
    HubertForCTC,
    TrainingArguments,
    Trainer
)

MODEL_ID = "facebook/hubert-large-ls960-ft"
OUTPUT_DIR = "./hubert-german-ipa-model-v2"
MAX_SAMPLES = 120000  # Tuong duong ~500 gio am thanh LibriSpeech (TB 15s/file)

print("1. Khoi tao G2P Backend (Espeak)...")
backend = EspeakBackend(language='de', preserve_punctuation=True, with_stress=True)

print("2. Dang tai Dataset LibriSpeech German (Audiobook chuan Studio)...")
dataset = load_dataset("facebook/multilingual_librispeech", "german", split="train", streaming=False)
dataset = dataset.cast_column("audio", Audio(sampling_rate=16000))

# Lay dung ~500 gio
num_samples = min(MAX_SAMPLES, len(dataset))
print(f"3. Chon loc {num_samples} mau (~500 gio) de huan luyen...")
dataset = dataset.shuffle(seed=42).select(range(num_samples))

print("4. Chuyen doi Van ban sang IPA (Sieu toc)...")
def convert_to_ipa(batch):
    ipas = backend.phonemize(batch["transcript"], strip=True)
    clean_ipas = []
    for ipa in ipas:
        ipa = re.sub(r'[.,?!;:()"-]', '', ipa)
        ipa = re.sub(r'([ˈˌ])([a-zæœøʏɪʊɛɔəɐ]+)', r'\2\1', ipa)
        ipa = re.sub(r'\s+', ' ', ipa).strip()
        clean_ipas.append(ipa)
    return {"ipa": clean_ipas}

# Xu ly Text cuc ky nhanh va nhe, khong lo tran RAM
dataset = dataset.map(convert_to_ipa, batched=True, batch_size=1000)

# Loc bo cac cau qua ngan hoac rong (Chi doc cot 'ipa', khong decode Audio -> chay trong 0.1 giay)
dataset = dataset.filter(lambda ipa: len(ipa) > 1, input_columns=["ipa"])

print("5. Khoi tao Ma tran Tu vung IPA (Tokenizer)...")
all_chars = set()
for text in dataset["ipa"]:
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

print("6. Nap Mo hinh & Dong goi DataCollator...")
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

data_collator = DataCollatorCTCWithPadding(processor=processor, padding=True)

model = HubertForCTC.from_pretrained(
    MODEL_ID, 
    ctc_loss_reduction="mean", 
    pad_token_id=processor.tokenizer.pad_token_id,
    vocab_size=len(processor.tokenizer),
    ignore_mismatched_sizes=True
)
model.freeze_feature_encoder()

training_args = TrainingArguments(
    output_dir=OUTPUT_DIR,
    per_device_train_batch_size=8,
    gradient_accumulation_steps=4,
    remove_unused_columns=False,
    num_train_epochs=10, 
    fp16=True, 
    save_steps=2000,
    logging_steps=100,
    learning_rate=1e-4,
    warmup_steps=1000,
    save_total_limit=2,
)

trainer = Trainer(
    model=model,
    data_collator=data_collator,
    args=training_args,
    train_dataset=dataset,
    processing_class=processor.tokenizer,
)

print("7. BAT DAU HUAN LUYEN TREN GPU L4...")
trainer.train()
trainer.save_model(OUTPUT_DIR)
processor.save_pretrained(OUTPUT_DIR)
print("🎉🎉🎉 HUAN LUYEN HOAN TAT 100%! 🎉🎉🎉")
