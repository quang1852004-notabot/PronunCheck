import os
import numpy as np
import torch
import torchaudio.functional as F
import librosa
from fastdtw import fastdtw
from scipy.spatial.distance import euclidean
from google.cloud import texttospeech
from collections import Counter
import config

# Khai báo trực tiếp đường dẫn file json chứa key trong thư mục gốc của dự án.
KEY_PATH = os.path.join(os.path.dirname(__file__), "google_key.json")
if os.path.exists(KEY_PATH):
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = KEY_PATH

def get_reference_audio(expected_word: str):
    word_clean = expected_word.strip().lower()
    ref_path = os.path.join(config.REFERENCE_AUDIO_DIR, f"{word_clean}.wav")
    
    if os.path.exists(ref_path):
        return ref_path
        
    try:
        client = texttospeech.TextToSpeechClient()
        synthesis_input = texttospeech.SynthesisInput(text=expected_word)
        voice = texttospeech.VoiceSelectionParams(language_code="de-DE", name="de-DE-Neural2-B")
        audio_config = texttospeech.AudioConfig(audio_encoding=texttospeech.AudioEncoding.LINEAR16, sample_rate_hertz=16000)
        
        response = client.synthesize_speech(input=synthesis_input, voice=voice, audio_config=audio_config)
        with open(ref_path, "wb") as out:
            out.write(response.audio_content)
        return ref_path
    except Exception as e:
        print(f"TTS Error (Check Google Credentials): {e}")
        return None

def analyze_precise_score(audio_array: np.ndarray, expected_word: str, w2v_model, w2v_processor, vocab_dict):
    if not w2v_model or not w2v_processor:
        return 0.5, [], None
    
    try:
        inputs = w2v_processor(audio_array, sampling_rate=16000, return_tensors="pt").to(config.DEVICE)
        with torch.inference_mode():
            logits = w2v_model(**inputs).logits
            
        emissions = torch.log_softmax(logits, dim=-1)
        greedy_indices = torch.argmax(logits, dim=-1)[0].cpu().numpy()
        greedy_chars = [w2v_processor.tokenizer.convert_ids_to_tokens(int(idx)) for idx in greedy_indices]
        
        tokens = []
        chars_list = []
        for char in expected_word.upper():
            c = char if char != ' ' else '|'
            if c in vocab_dict:
                tokens.append(vocab_dict[c])
                chars_list.append(char)
                
        if not tokens:
            return 0.5, [], None

        targets = torch.tensor([tokens], dtype=torch.int32)
        blank_id = w2v_processor.tokenizer.pad_token_id
        
        alignments, scores = F.forced_align(emissions, targets, blank=blank_id)
        alignments = alignments[0].tolist()
        probs = torch.exp(scores[0]).tolist()
        
        token_spans = []
        current_token = None
        start_frame = 0
        current_scores = []
        
        for i, (token_id, prob) in enumerate(zip(alignments, probs)):
            if token_id == blank_id:
                if current_token is not None:
                    token_spans.append({"token_id": current_token, "score": sum(current_scores)/len(current_scores), "start": start_frame, "end": i-1})
                    current_token = None
            else:
                if token_id != current_token:
                    if current_token is not None:
                        token_spans.append({"token_id": current_token, "score": sum(current_scores)/len(current_scores), "start": start_frame, "end": i-1})
                    current_token = token_id
                    current_scores = [prob]
                    start_frame = i
                else:
                    current_scores.append(prob)
        if current_token is not None:
            token_spans.append({"token_id": current_token, "score": sum(current_scores)/len(current_scores), "start": start_frame, "end": len(alignments)-1})
            
        char_scores = []
        if len(token_spans) == len(chars_list):
            for i, span in enumerate(token_spans):
                c = chars_list[i]
                if c != ' ':
                    g_chars = [greedy_chars[idx] for idx in range(span["start"], span["end"]+1) if greedy_chars[idx] not in ['<pad>', '<s>', '</s>', '|']]
                    actual_c = Counter(g_chars).most_common(1)[0][0] if g_chars else "?"
                    char_scores.append({
                        "char": c, 
                        "score": span["score"],
                        "actual": actual_c
                    })
        
        if not char_scores:
            return 0.5, [], None
            
        avg_gop = sum(x["score"] for x in char_scores) / len(char_scores)
        worst_char_info = min(char_scores, key=lambda x: x["score"])
        
        return avg_gop, char_scores, worst_char_info
    except Exception as e:
        print(f"Forced Alignment Error: {e}", flush=True)
        return 0.5, [], None

def extract_mfcc(y, sr=16000):
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    return mfcc.T

def calculate_dtw_score(user_audio: np.ndarray, expected_word: str):
    ref_path = get_reference_audio(expected_word)
    if not ref_path: return 1.0 
        
    try:
        ref_audio, _ = librosa.load(ref_path, sr=16000)
        user_mfcc = extract_mfcc(user_audio)
        ref_mfcc = extract_mfcc(ref_audio)
        
        distance, path = fastdtw(user_mfcc, ref_mfcc, dist=euclidean)
        max_len = max(len(user_mfcc), len(ref_mfcc))
        normalized_dist = distance / max_len
        
        score = np.exp(-0.05 * normalized_dist)
        return float(np.clip(score, 0.0, 1.0))
    except Exception as e:
        print(f"DTW Error: {e}")
        return 1.0

def analyze_with_whisperx(audio_array: np.ndarray, expected_word: str, whisper_model) -> float:
    if not whisper_model: return 0.5
    try:
        segments, _ = whisper_model.transcribe(audio_array, beam_size=5, language="de", word_timestamps=True)
        word_confidence = 0.0
        for segment in segments:
            for word in segment.words:
                if expected_word.lower() in word.word.lower():
                    word_confidence = word.probability
                    break
            if word_confidence > 0.0: break
        return float(word_confidence)
    except: return 0.5

def calculate_dynamic_score(precise_score, whisper_score, dtw_score, expected_word, worst_char_info):
    L = len(expected_word.replace(" ", ""))
    L_clamped = max(5, min(L, 30))
    
    w_p = 0.8 - (0.4 * (L_clamped - 5) / 25)
    w_p = max(0.4, min(0.8, w_p))
    w_f = 1.0 - w_p
    
    fluent_score = whisper_score * dtw_score
    final_score = (precise_score ** w_p) * (fluent_score ** w_f)
    final_100 = round(final_score * 100, 2)
    is_passed = final_score >= 0.55
    
    feedback = "Phát âm rất rõ ràng, ngữ điệu tự nhiên!"
    if not is_passed:
        if whisper_score < 0.3:
            feedback = f"Hệ thống không nghe rõ từ '{expected_word}'. Vui lòng đọc to và rõ hơn."
        elif worst_char_info and worst_char_info["score"] < 0.5:
            expected_c = worst_char_info["char"]
            actual_c = worst_char_info.get("actual", "?")
            if actual_c and actual_c != "?":
                feedback = f"Bạn đang đọc từ '{expected_word}', nhưng hệ thống nhận thấy bạn phát âm âm '{expected_c}' giống với âm '{actual_c}'. Hãy chú ý điều chỉnh nhé."
            else:
                feedback = f"Bạn phát âm âm '{expected_c}' chưa được rõ ràng. Hãy nghe lại audio mẫu và thử lại."
        elif dtw_score < 0.6:
            feedback = "Các âm bạn đọc khá đúng, nhưng ngữ điệu và nhịp điệu chưa giống bản xứ. Hãy đọc dứt khoát hơn."
            
    return {
        "precise_score": round(precise_score * 100, 2),
        "whisper_score": round(whisper_score * 100, 2),
        "dtw_score": round(dtw_score * 100, 2),
        "fluent_score": round(fluent_score * 100, 2),
        "hybrid_target_score": final_100,
        "is_passed": is_passed,
        "feedback": feedback
    }
