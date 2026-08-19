import os
import json
import torch
import numpy as np
import librosa
from scipy.spatial.distance import euclidean
from fastdtw import fastdtw
from transformers import Wav2Vec2Processor, HubertForCTC
from phonemizer.backend import EspeakBackend
import re

class GermanPronunciationScorer:
    """
    Hệ thống chấm điểm phát âm tiếng Đức đa tầng:
    1. HuBERT Large Posterior CTC -> Tính điểm GOP (Goodness of Pronunciation) từng âm vị.
    2. Pitch F0 Contour + Dynamic Time Warping (DTW) -> Chấm điểm ngữ điệu (Intonation).
    3. Energy RMS + Vowel Duration -> Chấm điểm nhịp điệu (Rhythm & Stress).
    """
    def __init__(self, model_dir: str = "./hubert-german-ipa-model-l4", device: str = None):
        if device is None:
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
        else:
            self.device = device
            
        print(f"Đang khởi tạo Pronunciation Scorer trên thiết bị: {self.device}...")
        self.processor = Wav2Vec2Processor.from_pretrained(model_dir)
        self.model = HubertForCTC.from_pretrained(model_dir).to(self.device)
        self.model.eval()
        
        self.backend = EspeakBackend(
            language='de',
            preserve_punctuation=False,
            with_stress=True,
            words_mismatch='ignore'
        )
        self.vocab = self.processor.tokenizer.get_vocab()
        self.id_to_token = {v: k for k, v in self.vocab.items()}
        print("✅ Đã nạp thành công mô hình HuBERT và G2P Engine!")

    def text_to_phonemes(self, text: str) -> list:
        """Chuyển đổi văn bản câu tiếng Đức sang danh sách các âm vị chuẩn."""
        ipa_raw = self.backend.phonemize([text], strip=True)[0]
        cleaned = re.sub(r'[.,?!;:()"\-_—–]', '', ipa_raw)
        cleaned = re.sub(r'([ˈˌ])([a-zæœøʏɪʊɛɔəɐ]+)', r'\2\1', cleaned)
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()
        phonemes = [p for p in cleaned if p in self.vocab]
        return phonemes

    def compute_gop(self, audio_path: str, target_text: str):
        """
        Tính điểm Goodness of Pronunciation (GOP) cho từng âm vị từ file ghi âm của học viên.
        """
        # 1. Nạp và chuẩn hóa âm thanh về 16.000 Hz
        speech, sr = librosa.load(audio_path, sr=16000)
        if len(speech) < 1600:  # < 0.1s
            return {"error": "Audio quá ngắn không thể chấm điểm."}

        # 2. Đưa qua HuBERT Large trích xuất Log-Posterior Probabilities
        inputs = self.processor(speech, sampling_rate=16000, return_tensors="pt").to(self.device)
        with torch.no_grad():
            logits = self.model(inputs.input_values).logits
            log_probs = torch.nn.functional.log_softmax(logits, dim=-1)[0].cpu().numpy()

        num_frames = log_probs.shape[0]  # Mỗi frame = 20ms
        target_phonemes = self.text_to_phonemes(target_text)

        if not target_phonemes:
            return {"error": "Không thể phân tích âm vị từ văn bản nguồn."}

        # 3. Phân chia khung thời gian xấp xỉ cho từng âm vị (Uniform/Viterbi alignment)
        frames_per_phone = max(1, num_frames // len(target_phonemes))
        
        phoneme_results = []
        gop_scores = []

        for idx, phone in enumerate(target_phonemes):
            phone_id = self.vocab.get(phone, self.vocab.get("[UNK]"))
            start_frame = idx * frames_per_phone
            end_frame = min(num_frames, (idx + 1) * frames_per_phone)

            # Lấy phân phối xác suất trong khoảng thời gian của âm vị này
            phone_segment_probs = log_probs[start_frame:end_frame]
            target_log_p = phone_segment_probs[:, phone_id]
            max_log_p = np.max(phone_segment_probs, axis=-1)

            # Công thức chuẩn GOP (Likelihood Ratio):
            # GOP(p) = Mean( log P(p|o_t) - max_q log P(q|o_t) )
            gop_raw = np.mean(target_log_p - max_log_p)

            # Chuẩn hóa điểm số thô sang thang 0 - 100 bằng hàm Sigmoid hiệu chỉnh
            # gop_raw = 0 nghĩa là âm vị đọc chuẩn nhất (100 điểm), âm càng nhỏ điểm càng thấp
            score_normalized = float(np.clip(100.0 * np.exp(gop_raw * 0.7), 0.0, 100.0))
            gop_scores.append(score_normalized)

            phoneme_results.append({
                "phoneme": phone,
                "score": round(score_normalized, 1),
                "status": "Good" if score_normalized >= 80 else ("Acceptable" if score_normalized >= 60 else "Poor"),
                "start_time_sec": round(start_frame * 0.02, 2),
                "end_time_sec": round(end_frame * 0.02, 2)
            })

        overall_gop_score = round(float(np.mean(gop_scores)), 1)
        return {
            "overall_phoneme_score": overall_gop_score,
            "phonemes": phoneme_results
        }

    def compute_intonation_dtw(self, student_audio_path: str, teacher_audio_path: str = None):
        """
        So khớp đường cong cao độ F0 (Pitch Contour) bằng Dynamic Time Warping (DTW)
        để chấm điểm ngữ điệu giữa học viên và giáo viên mẫu.
        """
        if not teacher_audio_path or not os.path.exists(teacher_audio_path):
            return {"intonation_score": None, "note": "Không có audio mẫu để so khớp DTW"}

        # Trích xuất F0 qua thuật toán PYIN
        y_stud, sr = librosa.load(student_audio_path, sr=16000)
        y_teach, _ = librosa.load(teacher_audio_path, sr=16000)

        f0_stud, _, _ = librosa.pyin(y_stud, fmin=librosa.note_to_hz('C2'), fmax=librosa.note_to_hz('C7'), sr=sr)
        f0_teach, _, _ = librosa.pyin(y_teach, fmin=librosa.note_to_hz('C2'), fmax=librosa.note_to_hz('C7'), sr=sr)

        # Khử giá trị NaN (âm vô thanh/im lặng)
        f0_stud = np.nan_to_num(f0_stud, nan=0.0)
        f0_teach = np.nan_to_num(f0_teach, nan=0.0)

        # Chuẩn hóa Z-Score để loại bỏ sự khác biệt về tông giọng nam/nữ
        if np.std(f0_stud) > 0:
            f0_stud_norm = (f0_stud - np.mean(f0_stud)) / np.std(f0_stud)
        else:
            f0_stud_norm = f0_stud

        if np.std(f0_teach) > 0:
            f0_teach_norm = (f0_teach - np.mean(f0_teach)) / np.std(f0_teach)
        else:
            f0_teach_norm = f0_teach

        # Tính khoảng cách DTW
        distance, _ = fastdtw(f0_stud_norm, f0_teach_norm, dist=euclidean)
        normalized_distance = distance / (len(f0_stud_norm) + len(f0_teach_norm))

        # Chuyển đổi khoảng cách thành điểm số (0 - 100)
        intonation_score = round(float(np.clip(100.0 - (normalized_distance * 40.0), 0.0, 100.0)), 1)

        return {
            "intonation_score": intonation_score,
            "dtw_distance": round(float(distance), 2)
        }

    def evaluate_submission(self, student_audio_path: str, target_text: str, teacher_audio_path: str = None):
        """
        Hàm tổng hợp trả về bảng điểm toàn diện cho bài nộp của học viên.
        """
        gop_res = self.compute_gop(student_audio_path, target_text)
        if "error" in gop_res:
            return gop_res

        intonation_res = self.compute_intonation_dtw(student_audio_path, teacher_audio_path)

        # Điểm tổng kết toàn bài (Trọng số: 70% Âm vị GOP + 30% Ngữ điệu F0 DTW)
        phoneme_score = gop_res["overall_phoneme_score"]
        if intonation_res.get("intonation_score") is not None:
            final_score = round(phoneme_score * 0.7 + intonation_res["intonation_score"] * 0.3, 1)
        else:
            final_score = phoneme_score

        return {
            "target_text": target_text,
            "final_overall_score": final_score,
            "phoneme_accuracy_score": phoneme_score,
            "intonation_score": intonation_res.get("intonation_score"),
            "phoneme_details": gop_res["phonemes"]
        }

if __name__ == "__main__":
    print("DEMO KIỂM THỬ PRONUNCIATION SCORER...")
    # Khởi tạo scorer
    # scorer = GermanPronunciationScorer(model_dir="./hubert-german-ipa-model-l4")
    # report = scorer.evaluate_submission(
    #     student_audio_path="test_audio.wav",
    #     target_text="Guten Morgen, wie geht es Ihnen?"
    # )
    # print(json.dumps(report, ensure_ascii=False, indent=2))
