"""
Light_ScoringBackend Package
Hệ thống AI chấm điểm phát âm tiếng Đức thứ cấp (Light Tier Engine).
Bao gồm:
  - scoring: Module trích xuất F0 DTW, CTC Forced Alignment và Dynamic Sigmoid Scoring.
  - german_phonetics: Module âm ngữ học tiếng Đức (Ich/Ach, Devoicing, Vowel Duration).
"""

from . import scoring
from . import german_phonetics

__all__ = ["scoring", "german_phonetics"]
