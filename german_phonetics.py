"""
================================================================================
                    GERMAN PHONETICS ENGINE (PRONUNCHECK)
================================================================================
Module chuyên trách phân tích và xử lý các quy tắc ngữ âm tiếng Đức đặc thù:
  1. Cặp âm Ich-Laut (/ç/) vs Ach-Laut (/x/).
  2. Hiện tượng vô thanh hóa phụ âm cuối (Auslautverhärtung: d->t, b->p, g->k, ig->iç).
  3. Độ dài nguyên âm (Long vs Short Vowels) và đánh giá thời lượng (Duration Score).
  4. Bộ sinh lời khuyên sư phạm (Pedagogical Feedback Generator).
================================================================================
"""

import re
from typing import List, Dict, Tuple, Optional

# Bảng phân loại nguyên âm tiếng Đức
LONG_VOWEL_PATTERNS = [
    r'ie', r'aa', r'ee', r'oo',                                  # Nguyên âm đôi viết liền
    r'ah', r'eh', r'ih', r'oh', r'uh', r'äh', r'öh', r'üh',       # Đi kèm âm 'h' câm kéo dài
]

SHORT_VOWEL_FOLLOWERS = [
    r'ck', r'tz', r'ss', r'ß',
    r'bb', r'dd', r'ff', r'gg', r'll', r'mm', r'nn', r'pp', r'rr', r'tt' # Phụ âm đôi làm ngắn nguyên âm
]

def count_german_syllables(word: str) -> int:
    """
    Ước tính số âm tiết trong từ hoặc câu tiếng Đức dựa trên số cụm nguyên âm.
    """
    text = word.lower().strip()
    # Loại bỏ ký tự không phải chữ cái và khoảng trắng
    text = re.sub(r'[^a-zäöüß\s]', '', text)
    if not text:
        return 1
        
    words = text.split()
    total_syllables = 0
    
    for w in words:
        # Gom các nguyên âm ghép và nguyên âm đơn
        vowel_clusters = re.findall(r'(?:ae|oe|ue|ie|ei|eu|äu|au|ai|[aeiouyäöü])+', w)
        count = len(vowel_clusters)
        total_syllables += max(1, count)
        
    return max(1, total_syllables)

def calculate_effective_length(expected_text: str) -> Tuple[float, int, int]:
    """
    Tính độ dài hiệu dụng L kết hợp số từ và số âm tiết:
    L = N_words + 0.5 * max(0, N_syllables - 2 * N_words)
    Xử lý thông minh các từ ghép tiếng Đức (Compound words).
    """
    clean_text = expected_text.strip()
    words = [w for w in clean_text.split() if w]
    num_words = max(1, len(words))
    num_syllables = count_german_syllables(clean_text)
    
    # Nếu là từ ghép dài (ví dụ: Krankenhaus = 3 âm tiết, 1 từ) -> L = 1 + 0.5 * (3 - 2) = 1.5
    compound_bonus = 0.5 * max(0, num_syllables - (2 * num_words))
    effective_l = float(num_words + compound_bonus)
    
    return effective_l, num_words, num_syllables

def analyze_ch_allophone(word: str, ch_index: int) -> Dict[str, str]:
    """
    Xác định cụm 'ch' trong từ thuộc dạng Ich-Laut (/ç/) hay Ach-Laut (/x/)
    dựa trên ngữ cảnh nguyên âm/phụ âm đứng trước nó.
    """
    w = word.lower()
    prefix = w[:ch_index]
    
    # Kiểm tra xem có phải 'chs' phát âm là /ks/ không (như sechs, Fuchs)
    if ch_index + 2 < len(w) and w[ch_index + 2] == 's':
        # Ngoại trừ trường hợp đuôi genitive hoặc tiếp vĩ ngữ
        if w in ["sechs", "fuchs", "ochs", "wachsen", "lachs"]:
            return {
                "type": "chs_ks",
                "ipa": "/ks/",
                "name": "Âm /ks/",
                "rule": "Cụm 'chs' trong các từ gốc đọc thành âm /ks/."
            }
            
    # Kiểm tra tiền tố trước 'ch'
    # Ach-Laut: Đứng sau a, o, u, au
    if prefix.endswith("au") or (prefix and prefix[-1] in ['a', 'o', 'u']):
        return {
            "type": "ach_laut",
            "ipa": "/x/",
            "name": "Ach-Laut (/x/)",
            "rule": "Đứng sau nguyên âm sau (a, o, u, au) -> phát âm vòm mềm họng sâu /x/."
        }
    else:
        # Ich-Laut: Đứng sau e, i, ä, ö, ü, ei, eu, äu, l, r, n hoặc ở đầu từ
        return {
            "type": "ich_laut",
            "ipa": "/ç/",
            "name": "Ich-Laut (/ç/)",
            "rule": "Đứng sau nguyên âm trước (e, i, ä, ö, ü, ei, eu) hoặc phụ âm (l, r, n) -> phát âm vòm cứng /ç/."
        }

def is_devoicing_coda_candidate(char: str, pos_in_word: int, word: str) -> Optional[Dict[str, str]]:
    """
    Kiểm tra xem ký tự tại vị trí pos_in_word có thuộc diện vô thanh hóa phụ âm cuối
    (Auslautverhärtung) không.
    Ví dụ: 
      - Hund (d ở cuối từ -> đọc là /t/)
      - Tag (g ở cuối từ -> đọc là /k/)
      - ab (b ở cuối từ -> đọc là /p/)
      - König (-ig ở cuối từ -> đọc là /ɪç/)
    """
    c = char.upper()
    w = word.upper()
    is_word_end = (pos_in_word == len(w) - 1)
    
    # Kiểm tra trường hợp đuôi -IG
    if is_word_end and c == 'G' and pos_in_word >= 1 and w[pos_in_word - 1] == 'I':
        return {
            "original_char": "G",
            "phonetic_target": "CH",
            "ipa": "/ç/",
            "description": "Đuôi '-ig' chuẩn tiếng Đức phát âm là /ɪç/ (giống âm ch nhẹ)."
        }
        
    # Kiểm tra vị trí cuối từ hoặc trước phụ âm khác (coda position)
    if is_word_end or (pos_in_word < len(w) - 1 and w[pos_in_word + 1] not in ['A', 'E', 'I', 'O', 'U', 'Ä', 'Ö', 'Ü']):
        if c == 'D':
            return {
                "original_char": "D",
                "phonetic_target": "T",
                "ipa": "/t/",
                "description": "Hiện tượng vô thanh hóa (Auslautverhärtung): 'd' ở cuối âm tiết đọc thành âm vô thanh /t/."
            }
        elif c == 'B':
            return {
                "original_char": "B",
                "phonetic_target": "P",
                "ipa": "/p/",
                "description": "Hiện tượng vô thanh hóa (Auslautverhärtung): 'b' ở cuối âm tiết đọc thành âm vô thanh /p/."
            }
        elif c == 'G':
            return {
                "original_char": "G",
                "phonetic_target": "K",
                "ipa": "/k/",
                "description": "Hiện tượng vô thanh hóa (Auslautverhärtung): 'g' ở cuối âm tiết đọc thành âm vô thanh /k/."
            }
            
    return None

def classify_vowel_expected_length(word: str, char_idx: int) -> str:
    """
    Xác định nguyên âm tại char_idx được kỳ vọng là nguyên âm DÀI ('long') hay NGẮN ('short').
    """
    w = word.lower()
    if char_idx >= len(w):
        return "normal"
        
    c = w[char_idx]
    if c not in "aeiouäöü":
        return "consonant"
        
    # Kiểm tra nguyên âm dài do 'ie'
    if c == 'i' and char_idx + 1 < len(w) and w[char_idx + 1] == 'e':
        return "long"
    if c == 'e' and char_idx > 0 and w[char_idx - 1] == 'i':
        return "long"
        
    # Kiểm tra nguyên âm đi liền sau bởi 'h' (Dehnungs-h)
    if char_idx + 1 < len(w) and w[char_idx + 1] == 'h':
        return "long"
        
    # Kiểm tra nguyên âm kép (Doppelvokal: aa, ee, oo)
    if char_idx + 1 < len(w) and w[char_idx + 1] == c:
        return "long"
    if char_idx > 0 and w[char_idx - 1] == c:
        return "long"
        
    # Kiểm tra nguyên âm ngắn do đi trước phụ âm đôi (Doppelkonsonanz)
    rest = w[char_idx + 1:]
    for pattern in SHORT_VOWEL_FOLLOWERS:
        if rest.startswith(pattern):
            return "short"
            
    # Mặc định âm tiết mở / 1 phụ âm đơn -> thường là dài hoặc trung bình
    return "long" if len(rest) <= 1 else "normal"

def evaluate_vowel_duration(span_frames: int, expected_type: str, frame_duration_ms: float = 20.0) -> Tuple[float, str]:
    """
    Đánh giá điểm thời lượng nguyên âm (Duration Score) dựa trên số frames từ Forced Alignment:
      - 1 frame ~ 20ms.
      - Nguyên âm dài: kỳ vọng >= 120ms (>= 6 frames).
      - Nguyên âm ngắn: kỳ vọng 40-100ms (2 - 5 frames).
    Trả về (duration_multiplier, message)
    """
    duration_ms = span_frames * frame_duration_ms
    
    if expected_type == "long":
        if duration_ms < 70:  # Quá ngắn (< 70ms)
            return 0.70, "Nguyên âm này là nguyên âm DÀI, bạn đang phát âm hơi ngắn. Hãy kéo dài âm hơn."
        elif duration_ms < 110:
            return 0.90, "Nguyên âm dài chưa đạt đủ độ ngân chuẩn."
        else:
            return 1.0, "Thời lượng nguyên âm dài rất chuẩn xác."
            
    elif expected_type == "short":
        if duration_ms > 220:  # Quá dài (> 220ms)
            return 0.75, "Nguyên âm này là nguyên âm NGẮN, bạn đang ngân quá dài. Cần đọc dứt khoát và ngắn hơn."
        elif duration_ms > 160:
            return 0.90, "Nguyên âm ngắn đọc hơi dài."
        else:
            return 1.0, "Thời lượng nguyên âm ngắn rất dứt khoát."
            
    return 1.0, "Thời lượng đạt chuẩn."

def generate_german_feedback(
    expected_word: str,
    char_scores: List[Dict],
    whisper_score: float,
    dtw_pitch_score: float,
    is_passed: bool
) -> str:
    """
    Bộ sinh nhận xét sư phạm chi tiết và chuẩn ngôn ngữ học tiếng Đức.
    """
    if is_passed and whisper_score >= 0.85 and dtw_pitch_score >= 0.80:
        return "Tuyệt vời! Bạn phát âm rất rõ ràng, chuẩn xác các âm vị và ngữ điệu tự nhiên như người bản xứ."
        
    # 1. Nếu Whisper không nhận diện ra từ mục tiêu
    if whisper_score < 0.35:
        return f"Hệ thống không nhận diện rõ từ '{expected_word}'. Hãy kiểm tra lại micro, đọc to, tròn vành rõ chữ hơn nhé."
        
    # 2. Tìm ký tự có điểm thấp nhất
    if not char_scores:
        return "Vui lòng thu âm lại để hệ thống phân tích chi tiết."
        
    worst_item = min(char_scores, key=lambda x: x.get("score", 1.0))
    worst_char = worst_item.get("char", "")
    worst_score = worst_item.get("score", 1.0)
    actual_char = worst_item.get("actual", "?")
    
    # 3. Phân tích ngữ cảnh sư phạm cho âm lỗi nhất
    word_upper = expected_word.upper()
    
    # Kiểm tra nếu lỗi ở âm CH
    if worst_char in ['C', 'H'] and "CH" in word_upper:
        ch_pos = word_upper.find("CH")
        allophone = analyze_ch_allophone(expected_word, ch_pos)
        if allophone["type"] == "ach_laut":
            return f"Trong từ '{expected_word}', cụm 'ch' đứng sau nguyên âm sau nên phải phát âm là Ach-Laut {allophone['ipa']} (âm ma sát họng sâu), không đọc thành 'k' hay 's'."
        elif allophone["type"] == "ich_laut":
            return f"Trong từ '{expected_word}', cụm 'ch' là Ich-Laut {allophone['ipa']} (âm vòm cứng nhẹ nhàng như trong 'ich'), hãy đặt lưỡi chạm nhẹ vòm họng trên."
            
    # Kiểm tra nếu lỗi ở âm R (âm rung lưỡi / cuống họng)
    if worst_char == 'R' and worst_score < 0.6:
        return f"Âm 'R' trong '{expected_word}' chưa rõ. Trong tiếng Đức, 'R' thường rung cuống họng (hoặc rung đầu lưỡi) ở đầu từ, và phát âm nhẹ như âm /ɐ/ ở đuôi từ."
        
    # Kiểm tra nếu có feedback độ dài nguyên âm
    if worst_item.get("duration_feedback") and worst_item.get("duration_multiplier", 1.0) < 0.9:
        return f"Lỗi độ dài âm '{worst_char}' trong từ '{expected_word}': {worst_item['duration_feedback']}"
        
    # Phản hồi chung về ký tự bị phát âm lệch
    if worst_score < 0.60:
        if actual_char and actual_char != "?" and actual_char.upper() != worst_char:
            return f"Trong từ '{expected_word}', âm '{worst_char}' đang bị phát âm gần giống âm '{actual_char}'. Hãy chú ý khẩu hình miệng để phát âm chuẩn hơn."
        else:
            return f"Âm '{worst_char}' trong từ '{expected_word}' phát âm chưa dứt khoát. Hãy nghe lại audio mẫu và thử lại nhé."
            
    # 4. Nếu âm vị tương đối tốt nhưng ngữ điệu/nhịp điệu chưa đạt
    if dtw_pitch_score < 0.65:
        return "Các âm bạn đọc khá chính xác, nhưng đường cong cao độ (ngữ điệu) và độ ngắt nghỉ chưa tự nhiên. Hãy nghe audio mẫu để bắt chước ngữ điệu chuẩn xác hơn."
        
    return "Phát âm khá tốt! Tiếp tục duy trì luyện tập để hoàn thiện hơn nữa nhé."
