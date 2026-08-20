"""
================================================================================
                    PRONUNCHECK ADVANCED SCORING ENGINE
================================================================================
Kiến trúc Chấm điểm Sơ cấp (Light Tier) kết hợp:
  1. Whisper-Tiny: Nhận diện từ & Độ trọn vẹn (Completeness Factor x_soft).
  2. Wav2Vec2 CTC: Forced Alignment + Phân tích âm vị & Thời lượng nguyên âm.
  3. F0 + FastDTW: So khớp đường cong cao độ (Pitch Contour) với Google TTS Neural2-B.
  4. German Phonetics Engine: Xử lý Ich/Ach-Laut, Auslautverhärtung và sinh feedback.
  5. Dynamic Scoring Specification: Trọng số động Sigmoid kết hợp tuyến tính.
================================================================================
"""

import os
import sys
import difflib
from collections import Counter
from typing import Dict, List, Tuple, Optional, Any

import numpy as np
import torch
import torchaudio.functional as F
import librosa
from fastdtw import fastdtw
from scipy.spatial.distance import euclidean
from scipy.signal import butter, filtfilt
import io
import soundfile as sf
import gtts

try:
    from google.cloud import texttospeech
except ImportError:
    texttospeech = None

# Import config từ thư mục gốc và german_phonetics từ cùng package
try:
    from . import german_phonetics
except ImportError:
    import german_phonetics

try:
    import config
except ImportError:
    from .. import config

# Tự động phát hiện và nạp Service Account Key cho Google Cloud TTS API
base_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.abspath(os.path.join(base_dir, ".."))

potential_keys = [
    os.path.join(base_dir, "google_key.json"),
    os.path.join(parent_dir, "google_key.json"),
    os.path.join(parent_dir, "secret_key", "google_key.json")
]

# Quét thêm các file json secret nếu có ở base_dir, parent_dir, secret_key
for scan_dir in [base_dir, parent_dir, os.path.join(parent_dir, "secret_key")]:
    if os.path.exists(scan_dir):
        for f in os.listdir(scan_dir):
            if f.endswith(".json") and (f.startswith("pronuncheck-") or "key" in f.lower()):
                full_p = os.path.join(scan_dir, f)
                if full_p not in potential_keys:
                    potential_keys.append(full_p)

for kp in potential_keys:
    if os.path.exists(kp):
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = kp
        break


try:
    import noisereduce as nr
except ImportError:
    nr = None


# ==============================================================================
# 0. TIỀN XỬ LÝ KHỬ NHIỄU & TRỪ NỀN TẠP ÂM (SPECTRAL GATING DENOISER)
# ==============================================================================
def highpass_filter(data, cutoff, fs, order=5):
    if cutoff == 0:
        return data
    nyq = 0.5 * fs
    normal_cutoff = cutoff / nyq
    b, a = butter(order, normal_cutoff, btype='high', analog=False)
    y = filtfilt(b, a, data)
    return y

def apply_5_level_denoise(audio_array: np.ndarray, sr: int = 16000, level: int = 1) -> np.ndarray:
    """
    Áp dụng thuật toán khử ồn theo 5 nấc (0 đến 4).
    Do giới hạn trình biên dịch Rust (không cài được DeepFilterNet), chúng ta sử dụng
    thuật toán Spectral Gating cao cấp của noisereduce kết hợp High-Pass Filter để
    mô phỏng kỹ thuật Dry/Wet Mix và tạo ra 5 nấc độ sâu:
    - Nấc 0: Giữ nguyên gốc
    - Nấc 1: HighPass 60Hz (cắt tiếng ù)
    - Nấc 2: HighPass 80Hz + Giảm nhiễu nền tĩnh 40% (Giữ ấm giọng)
    - Nấc 3: HighPass 100Hz + Giảm nhiễu mạnh 75% tĩnh & động (Quán cafe)
    - Nấc 4: HighPass 100Hz + Giảm nhiễu cực đoan 95% + Ép dải âm (Extreme)
    """
    if audio_array is None or len(audio_array) < int(sr * 0.2):
        return audio_array
        
    level = max(0, min(4, int(level)))
    if level == 0:
        return audio_array
        
    y = audio_array.copy()
    
    # 1. High-Pass Filter
    cutoff = {1: 60, 2: 80, 3: 100, 4: 100}.get(level, 0)
    if cutoff > 0:
        y = highpass_filter(y, cutoff, sr)
        
    if level == 1 or nr is None:
        return y
        
    # 2. Denoise parameters based on level
    prop_decrease = {2: 0.40, 3: 0.75, 4: 0.95}.get(level, 0.0)
    stationary = True if level == 2 else False
    
    try:
        y = nr.reduce_noise(
            y=y,
            sr=sr,
            prop_decrease=prop_decrease,
            stationary=stationary,
            n_fft=1024 if level <= 3 else 2048,
            hop_length=256 if level <= 3 else 512
        )
        
        # Nấc 4: Thêm compressor đơn giản (Soft Clipping) để ép dải động
        if level == 4:
            # Tăng gain 20% và soft clip
            y = y * 1.2
            y = np.tanh(y)
            
        return y.astype(np.float32)
    except Exception as e:
        print(f"[Denoise] Error applying noise reduction: {e}")
        return y


# ==============================================================================
# 1. TỔNG HỢP & QUẢN LÝ AUDIO MẪU (GOOGLE TTS NEURAL2 & GTTS FALLBACK)
# ==============================================================================
def get_reference_audio(expected_text: str) -> Optional[str]:
    """
    Lấy file audio chuẩn bản xứ cho từ hoặc câu mục tiêu.
    Tự động cache vào thư mục REFERENCE_AUDIO_DIR.
    
    Cơ chế dự phòng 2 lớp thông minh:
      - Lớp 1 (Ưu tiên): Google Cloud Text-to-Speech API (de-DE-Neural2-B) - tự động xác thực
        trên GCP VM qua Application Default Credentials (ADC) hoặc qua google_key.json.
      - Lớp 2 (Fallback): Thư viện gTTS (Google Translate TTS) - miễn phí 100%, không cần
        bất kỳ API key hay file JSON cấu hình nào, hoạt động tức thì trên môi trường Local.
    """
    clean_name = "".join(c for c in expected_text.strip().lower() if c.isalnum() or c in ['_', '-'])
    if not clean_name:
        clean_name = "ref_sample"
        
    os.makedirs(config.REFERENCE_AUDIO_DIR, exist_ok=True)
    ref_path = os.path.join(config.REFERENCE_AUDIO_DIR, f"{clean_name}.wav")
    
    if os.path.exists(ref_path):
        return ref_path
        
    # 1. Thử gọi Google Cloud Text-to-Speech API cao cấp (Neural2-B)
    if texttospeech is not None:
        try:
            client = texttospeech.TextToSpeechClient()
            synthesis_input = texttospeech.SynthesisInput(text=expected_text)
            voice = texttospeech.VoiceSelectionParams(language_code="de-DE", name="de-DE-Neural2-B")
            audio_config = texttospeech.AudioConfig(
                audio_encoding=texttospeech.AudioEncoding.LINEAR16, 
                sample_rate_hertz=16000
            )
            
            response = client.synthesize_speech(input=synthesis_input, voice=voice, audio_config=audio_config)
            with open(ref_path, "wb") as out:
                out.write(response.audio_content)
            return ref_path
        except Exception:
            pass  # Tự động chuyển fallback sang gTTS

    # 2. Tự động chuyển sang gTTS (miễn phí, không cần key) nếu không có GCP Key
    try:
        tts = gtts.gTTS(text=expected_text, lang="de")
        mp3_fp = io.BytesIO()
        tts.write_to_fp(mp3_fp)
        mp3_fp.seek(0)
        y, sr = librosa.load(mp3_fp, sr=16000)
        sf.write(ref_path, y, 16000)
        return ref_path
    except Exception as e_gtts:
        print(f"TTS Synthesizer Fallback Error: {e_gtts}", flush=True)
        return None


# ==============================================================================
# 2. TRÍCH XUẤT CAO ĐỘ F0 & SO KHỚP NGỮ ĐIỆU (F0 PITCH + FASTDTW)
# ==============================================================================
def extract_f0_semitones(audio_array: np.ndarray, sr: int = 16000) -> np.ndarray:
    """
    Trích xuất đường cong cao độ F0 bằng thuật toán pYIN và chuẩn hóa sang bán âm tương đối:
    Semitones(t) = 12 * log2(F0(t) / median(F0))
    Giúp loại bỏ 100% sự khác biệt về âm vực giọng nam, nữ hay trẻ em.
    """
    if len(audio_array) == 0:
        return np.zeros((1, 1))
        
    try:
        # pYIN: Probabilistic YIN cho độ chính xác cao trên giọng nói
        f0, voiced_flag, voiced_probs = librosa.pyin(
            audio_array,
            fmin=config.F0_FMIN,
            fmax=config.F0_FMAX,
            sr=sr,
            hop_length=config.F0_HOP_LENGTH
        )
        
        # Nếu toàn bộ file là im lặng hoặc không tìm thấy âm hữu thanh
        if f0 is None or np.all(np.isnan(f0)):
            # Fallback dùng YIN
            f0 = librosa.yin(
                audio_array,
                fmin=config.F0_FMIN,
                fmax=config.F0_FMAX,
                sr=sr,
                hop_length=config.F0_HOP_LENGTH
            )
            if np.all(np.isnan(f0)):
                return np.zeros((max(1, len(f0)), 1))

        # Lấy các khung hữu thanh hợp lệ
        valid_mask = ~np.isnan(f0) & (f0 > 0)
        if not np.any(valid_mask):
            return np.zeros((len(f0), 1))
            
        median_f0 = np.median(f0[valid_mask])
        if median_f0 <= 0:
            median_f0 = 150.0

        # Chuyển đổi sang bán âm tương đối (Relative Semitones)
        semitones = np.zeros_like(f0)
        semitones[valid_mask] = 12.0 * np.log2(f0[valid_mask] / median_f0)
        
        # Điền các đoạn vô thanh bằng nội suy tuyến tính hoặc 0
        if not np.all(valid_mask):
            nans, x = np.isnan(semitones), lambda z: z.nonzero()[0]
            if np.any(~nans):
                semitones[nans] = np.interp(x(nans), x(~nans), semitones[~nans])
            else:
                semitones = np.zeros_like(f0)

        # Định dạng mảng 2D cho FastDTW (N, 1)
        return semitones.reshape(-1, 1)
    except Exception as e:
        print(f"F0 Extraction Warning: {e}", flush=True)
        return np.zeros((10, 1))

def calculate_dtw_score(user_audio: np.ndarray, expected_text: str) -> float:
    """
    So khớp đường cong ngữ điệu (Pitch Contour) giữa Audio học sinh và Audio chuẩn Google TTS.
    Trả về điểm số chuẩn hóa trong thang điểm [0, 100].
    """
    ref_path = get_reference_audio(expected_text)
    if not ref_path or not os.path.exists(ref_path):
        return 80.0  # Điểm mặc định nếu không tạo được audio mẫu
        
    try:
        ref_audio, _ = librosa.load(ref_path, sr=16000)
        
        user_f0 = extract_f0_semitones(user_audio, sr=16000)
        ref_f0 = extract_f0_semitones(ref_audio, sr=16000)
        
        if len(user_f0) == 0 or len(ref_f0) == 0:
            return 75.0
            
        distance, path = fastdtw(user_f0, ref_f0, dist=euclidean)
        max_len = max(len(user_f0), len(ref_f0))
        normalized_dist = distance / max(1, max_len)
        
        # Áp dụng hàm suy giảm mũ: score = exp(-decay * distance) * 100
        score_0_1 = np.exp(-config.DTW_PITCH_DECAY * normalized_dist)
        score_100 = float(np.clip(score_0_1 * 100.0, 0.0, 100.0))
        return round(score_100, 2)
    except Exception as e:
        print(f"DTW Pitch Error: {e}", flush=True)
        return 75.0


# ==============================================================================
# 3. NHẬN DIỆN TỪ & ĐỘ TRỌN VẸN (WHISPER-TINY & ROBUST NORMALIZATION)
# ==============================================================================
def analyze_with_whisper(audio_array: np.ndarray, expected_text: str, whisper_model) -> Tuple[float, str]:
    """
    Sử dụng Faster-Whisper (Tiny) để kiểm tra:
      - Học viên có thực sự nói các từ mục tiêu không?
      - Chuẩn hóa chữ số tiếng Đức (1, 2, 3... -> eins, zwei, drei...).
      - Tính toán điểm hoàn thành nội dung c_whisper in [0, 100].
    Trả về (c_whisper_100, transcribed_text)
    """
    if whisper_model is None:
        return 85.0, expected_text
        
    try:
        segments_gen, info = whisper_model.transcribe(
            audio_array,
            beam_size=5,
            language="de",
            word_timestamps=False,
            condition_on_previous_text=False,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=400),
            initial_prompt=f"Ausspracheübung auf Deutsch: {expected_text}"
        )
        
        raw_transcription = " ".join([seg.text.strip() for seg in segments_gen]).strip()
        transcribed_norm = german_phonetics.normalize_german_transcript(raw_transcription)
        expected_norm = german_phonetics.normalize_german_transcript(expected_text)
        
        # Nếu Whisper không nghe thấy gì
        if not transcribed_norm:
            # Đo năng lượng âm thanh RMS
            rms = float(np.sqrt(np.mean(audio_array ** 2))) if len(audio_array) > 0 else 0.0
            if rms < 0.003:
                return 0.0, ""  # Thực sự là audio im lặng
            return 50.0, raw_transcription  # Có tiếng nói nhưng ASR không nhận diện được trọn vẹn
            
        expected_words = [w for w in expected_norm.split() if w]
        transcribed_words = [w for w in transcribed_norm.split() if w]
        
        if not expected_words:
            return 100.0, raw_transcription

        # 1. Trùng khớp hoàn toàn chuỗi đã chuẩn hóa
        if expected_norm in transcribed_norm or transcribed_norm in expected_norm:
            return 100.0, raw_transcription
            
        # 2. Tính tỷ lệ số từ xuất hiện (Word Recall với hỗ trợ so khớp gần đúng)
        matched_words = 0.0
        for w in expected_words:
            if w in transcribed_words:
                matched_words += 1.0
            elif w in transcribed_norm:
                matched_words += 0.9
            else:
                # Fuzzy match cho từng từ
                best_sub_match = max([difflib.SequenceMatcher(None, w, tw).ratio() for tw in transcribed_words], default=0.0)
                if best_sub_match >= 0.75:
                    matched_words += best_sub_match
                
        word_recall = matched_words / len(expected_words)
        
        # 3. Tính độ tương đồng chuỗi ký tự Levenshtein
        seq_ratio = difflib.SequenceMatcher(None, expected_norm, transcribed_norm).ratio()
        
        # Điểm hoàn thành là giá trị tốt nhất giữa Word Recall và Sequence Ratio
        score = max(word_recall, seq_ratio)
        score_100 = float(np.clip(score * 100.0, 0.0, 100.0))
        return round(score_100, 2), raw_transcription
    except Exception as e:
        print(f"Whisper Exception: {e}", flush=True)
        return 75.0, expected_text

# Giữ tên hàm analyze_with_whisperx để tương thích hoàn toàn
def analyze_with_whisperx(audio_array: np.ndarray, expected_word: str, whisper_model) -> float:
    score, _ = analyze_with_whisper(audio_array, expected_word, whisper_model)
    return score / 100.0


# ==============================================================================
# 4. FORCED ALIGNMENT & BỘ LUẬT NGỮ ÂM TIẾNG ĐỨC (WAV2VEC2 + GERMAN RULES)
# ==============================================================================
def analyze_precise_score(
    audio_array: np.ndarray,
    expected_word: str,
    w2v_model,
    w2v_processor,
    vocab_dict: Dict[str, int]
) -> Tuple[float, List[Dict[str, Any]], Optional[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Phân tích độ chuẩn xác từng âm vị/ký tự qua Wav2Vec2 CTC Forced Alignment,
    đồng thời áp dụng bộ luật ngữ âm tiếng Đức (Auslautverhärtung, Vowel Duration, Ich/Ach-Laut).
    Trả về: (avg_gop, char_scores, worst_char_info, word_timestamps)
    """
    raw_words = expected_word.strip().split()
    fallback_word_timestamps = []
    if raw_words and len(audio_array) > 0:
        total_duration = round(len(audio_array) / 16000.0, 2)
        step = total_duration / max(1, len(raw_words))
        for idx, rw in enumerate(raw_words):
            fallback_word_timestamps.append({
                "word": rw,
                "start": round(idx * step, 2),
                "end": round((idx + 1) * step, 2)
            })

    if not w2v_model or not w2v_processor or not vocab_dict:
        return 0.5, [], None, fallback_word_timestamps
        
    try:
        # Chuẩn bị input cho Wav2Vec2
        inputs = w2v_processor(audio_array, sampling_rate=16000, return_tensors="pt").to(config.DEVICE)
        with torch.inference_mode():
            logits = w2v_model(**inputs).logits
            
        emissions = torch.log_softmax(logits, dim=-1)
        greedy_indices = torch.argmax(logits, dim=-1)[0].cpu().numpy()
        greedy_chars = [w2v_processor.tokenizer.convert_ids_to_tokens(int(idx)) for idx in greedy_indices]
        
        # Tạo danh sách tokens mục tiêu
        tokens = []
        chars_list = []
        for char in expected_word.upper():
            c = char if char != ' ' else '|'
            if c in vocab_dict:
                tokens.append(vocab_dict[c])
                chars_list.append(char)
                
        if not tokens:
            return 0.5, [], None, fallback_word_timestamps

        targets = torch.tensor([tokens], dtype=torch.int32)
        blank_id = w2v_processor.tokenizer.pad_token_id
        
        # Thực hiện CTC Forced Alignment
        alignments, scores = F.forced_align(emissions, targets, blank=blank_id)
        alignments = alignments[0].tolist()
        probs = torch.exp(scores[0]).tolist()
        
        # Gom các frame liên tiếp thành token spans
        token_spans = []
        current_token = None
        start_frame = 0
        current_scores = []
        
        for i, (token_id, prob) in enumerate(zip(alignments, probs)):
            if token_id == blank_id:
                if current_token is not None:
                    token_spans.append({
                        "token_id": current_token,
                        "score": sum(current_scores)/len(current_scores),
                        "start": start_frame,
                        "end": i - 1
                    })
                    current_token = None
            else:
                if token_id != current_token:
                    if current_token is not None:
                        token_spans.append({
                            "token_id": current_token,
                            "score": sum(current_scores)/len(current_scores),
                            "start": start_frame,
                            "end": i - 1
                        })
                    current_token = token_id
                    current_scores = [prob]
                    start_frame = i
                else:
                    current_scores.append(prob)
                    
        if current_token is not None:
            token_spans.append({
                "token_id": current_token,
                "score": sum(current_scores)/len(current_scores),
                "start": start_frame,
                "end": len(alignments) - 1
            })
            
        char_scores = []
        word_timestamps = []
        
        if len(token_spans) == len(chars_list):
            for i, span in enumerate(token_spans):
                c = chars_list[i]
                if c != ' ':
                    # Lấy ký tự phổ biến nhất trong frame span
                    g_chars = [
                        greedy_chars[idx] for idx in range(span["start"], span["end"] + 1)
                        if greedy_chars[idx] not in ['<pad>', '<s>', '</s>', '|']
                    ]
                    actual_c = Counter(g_chars).most_common(1)[0][0] if g_chars else "?"
                    raw_score = float(span["score"])
                    
                    # -------------------------------------------------------------
                    # ÁP DỤNG LUẬT 1: VÔ THANH HÓA PHỤ ÂM CUỐI (Auslautverhärtung)
                    # -------------------------------------------------------------
                    devoice_rule = german_phonetics.is_devoicing_coda_candidate(c, i, expected_word)
                    if devoice_rule:
                        target_unvoiced = devoice_rule["phonetic_target"]
                        # Nếu học viên phát âm thành âm vô thanh tương ứng (ví dụ d->t, b->p, g->k)
                        if actual_c.upper() == target_unvoiced or (c == 'G' and actual_c.upper() in ['K', 'C', 'H']):
                            raw_score = max(raw_score, 0.95)
                            actual_c = f"{actual_c} ({devoice_rule['ipa']})"
                    
                    # -------------------------------------------------------------
                    # ÁP DỤNG LUẬT 2: ĐỘ DÀI NGUYÊN ÂM (Vowel Duration)
                    # -------------------------------------------------------------
                    vowel_expected_type = german_phonetics.classify_vowel_expected_length(expected_word, i)
                    span_frames = max(1, span["end"] - span["start"] + 1)
                    duration_mult, duration_msg = german_phonetics.evaluate_vowel_duration(
                        span_frames, vowel_expected_type
                    )
                    
                    final_char_score = float(np.clip(raw_score * duration_mult, 0.05, 1.0))
                    
                    start_sec = round(span["start"] * 0.02, 3)
                    end_sec = round((span["end"] + 1) * 0.02, 3)
                    
                    char_scores.append({
                        "char": c,
                        "score": round(final_char_score, 3),
                        "actual": actual_c,
                        "duration_frames": span_frames,
                        "duration_multiplier": duration_mult,
                        "duration_feedback": duration_msg if duration_mult < 1.0 else None,
                        "start_time": start_sec,
                        "end_time": end_sec
                    })

            # Trích xuất Word-level Timestamps cho Karaoke Visualizer
            current_word_chars = []
            current_spans = []
            
            for i, span in enumerate(token_spans):
                c = chars_list[i]
                if c == ' ' or c == '|':
                    if current_word_chars and current_spans:
                        w_start = round(current_spans[0]["start"] * 0.02, 2)
                        w_end = round((current_spans[-1]["end"] + 1) * 0.02, 2)
                        word_timestamps.append({
                            "word": "".join(current_word_chars),
                            "start": w_start,
                            "end": max(w_end, round(w_start + 0.05, 2))
                        })
                        current_word_chars = []
                        current_spans = []
                else:
                    current_word_chars.append(c)
                    current_spans.append(span)
                    
            if current_word_chars and current_spans:
                w_start = round(current_spans[0]["start"] * 0.02, 2)
                w_end = round((current_spans[-1]["end"] + 1) * 0.02, 2)
                word_timestamps.append({
                    "word": "".join(current_word_chars),
                    "start": w_start,
                    "end": max(w_end, round(w_start + 0.05, 2))
                })
                
            # Chuẩn hóa lại text nguyên bản của từng từ (bảo toàn Casing)
            if len(word_timestamps) == len(raw_words):
                for idx, rw in enumerate(raw_words):
                    word_timestamps[idx]["word"] = rw
                    
        if not word_timestamps:
            word_timestamps = fallback_word_timestamps
                    
        if not char_scores:
            return 0.5, [], None, word_timestamps
            
        avg_gop = float(sum(x["score"] for x in char_scores) / len(char_scores))
        worst_char_info = min(char_scores, key=lambda x: x["score"])
        
        return avg_gop, char_scores, worst_char_info, word_timestamps
    except Exception as e:
        print(f"Forced Alignment Error: {e}", flush=True)
        return 0.5, [], None, fallback_word_timestamps


# ==============================================================================
# 5. THUẬT TOÁN CHẤM ĐIỂM ĐỘNG MỚI (DYNAMIC SIGMOID LINEAR COMBINATION)
# ==============================================================================
def calculate_dynamic_score(
    precise_score: float,        # GOP Accuracy [0.0 - 1.0] hoặc [0 - 100]
    whisper_score: float,        # Whisper completeness [0.0 - 1.0] hoặc [0 - 100]
    dtw_score: float,            # F0 DTW pitch score [0.0 - 1.0] hoặc [0 - 100]
    expected_text: str,
    worst_char_info: Optional[Dict[str, Any]] = None,
    char_scores: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    Thuật toán chấm điểm phát âm toàn diện (Non-Destructive Dynamic Scoring):
    Final Score = w_acc(L) * y_acc + w_flu(L) * z_flu
    
    Trong đó:
      - y_acc: Điểm độ chuẩn xác âm vị GOP (Wav2Vec2 + German Phonetics) [0 - 100].
      - z_pitch: Điểm so khớp cao độ ngữ điệu F0 DTW [0 - 100].
      - c_whisper: Điểm nhận diện trọn vẹn từ ngữ Whisper (đã chuẩn hóa số/chữ) [0 - 100].
      - z_flu = (0.60 * z_pitch) + (0.40 * c_whisper): Điểm ngữ điệu & lưu loát.
      - w_acc(L) = 1 / (1 + exp(k * (L - L0))): Trọng số Sigmoid theo độ dài hiệu dụng.
      - w_flu(L) = 1 - w_acc(L).
    """
    # Chuẩn hóa các thang điểm về [0, 100]
    y_acc = float(precise_score * 100.0 if precise_score <= 1.0 else precise_score)
    z_pitch = float(dtw_score * 100.0 if dtw_score <= 1.0 else dtw_score)
    c_whisper = float(whisper_score * 100.0 if whisper_score <= 1.0 else whisper_score)
    
    # 1. Kiểm tra im lặng tuyệt đối (Silent audio check)
    if y_acc < 15.0 and c_whisper < 15.0:
        return {
            "phoneme_score": 0.0,
            "precise_score": 0.0,
            "whisper_score": 0.0,
            "dtw_score": 0.0,
            "fluent_score": 0.0,
            "total_score": 0.0,
            "hybrid_target_score": 0.0,
            "is_passed": False,
            "feedback": "Không phát hiện thấy tiếng nói rõ ràng. Vui lòng kiểm tra lại micro và thu âm lại.",
            "weights": {
                "w_acc": 0.5,
                "w_flu": 0.5,
                "effective_length": 1.0,
                "num_words": 1,
                "num_syllables": 1
            }
        }
        
    # 2. Tính độ dài hiệu dụng L (kết hợp số từ và số âm tiết)
    eff_l, num_words, num_syllables = german_phonetics.calculate_effective_length(expected_text)
    
    # 3. Tính trọng số động Sigmoid
    # w_acc: Từ ngắn (L nhỏ) -> w_acc cao (~0.82); Câu dài -> w_acc thấp (~0.27)
    exponent = config.SCORING_K * (eff_l - config.SCORING_L0)
    exponent_clamped = max(-20.0, min(20.0, exponent))
    w_acc = float(1.0 / (1.0 + np.exp(exponent_clamped)))
    w_flu = float(1.0 - w_acc)
    
    # 4. Điểm lưu loát & tự nhiên (Prosody & Fluency Score z):
    # Kết hợp giữa Đường cong Cao độ F0 (60%) và Nhận diện ngữ cảnh Whisper (40%)
    z_flu = (0.60 * z_pitch) + (0.40 * c_whisper)
    
    # 5. Điểm tổng hợp tuyến tính KHÔNG TRIỆT TIÊU (Linear Combination)
    final_score = (w_acc * y_acc) + (w_flu * z_flu)
    final_score_clamped = float(np.clip(final_score, 0.0, 100.0))
    
    is_passed = bool(final_score_clamped >= config.PASSING_THRESHOLD)
    
    # 6. Sinh nhận xét sư phạm tiếng Đức chi tiết
    all_chars = char_scores if char_scores is not None else ([worst_char_info] if worst_char_info else [])
    feedback = german_phonetics.generate_german_feedback(
        expected_word=expected_text,
        char_scores=all_chars,
        whisper_score=c_whisper / 100.0,
        dtw_pitch_score=z_pitch / 100.0,
        is_passed=is_passed
    )
    
    return {
        "phoneme_score": round(y_acc, 2),
        "precise_score": round(y_acc, 2),
        "whisper_score": round(c_whisper, 2),
        "dtw_score": round(z_pitch, 2),
        "fluent_score": round(z_flu, 2),
        "total_score": round(final_score_clamped, 2),
        "hybrid_target_score": round(final_score_clamped, 2),
        "is_passed": is_passed,
        "feedback": feedback,
        "weights": {
            "w_acc": round(w_acc, 3),
            "w_flu": round(w_flu, 3),
            "effective_length": round(eff_l, 2),
            "num_words": num_words,
            "num_syllables": num_syllables
        }
    }
