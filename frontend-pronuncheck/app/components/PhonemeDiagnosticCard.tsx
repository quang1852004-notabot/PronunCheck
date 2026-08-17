'use client';

import React from 'react';
import { AlertTriangle, Sparkles, CheckCircle2, ArrowRight, Lightbulb, Info } from 'lucide-react';

export interface CharScoreItem {
  char: string;
  score: number;
  actual: string;
  duration_frames?: number;
  duration_multiplier?: number;
  duration_feedback?: string | null;
}

export interface WorstCharItem {
  char: string;
  score: number;
  actual: string;
}

interface PhonemeDiagnosticCardProps {
  worstChar?: WorstCharItem | null;
  expectedWord: string;
  feedback?: string;
  isPassed?: boolean;
}

// German phonetics advice database
function getPhoneticTip(targetChar: string, actualChar: string): string {
  const target = targetChar.toUpperCase();
  const actual = actualChar.toUpperCase();

  if (target === 'SCH' || (target === 'S' && actual === 'SCH')) {
    return 'Mẹo phát âm [ʃ] (sch): Chu môi tròn nhẹ về phía trước, mặt lưỡi hơi nâng lên hướng về ngạc cứng và đẩy luồng hơi mạnh ra ngoài.';
  }
  if (target === 'CH') {
    return 'Mẹo phát âm [ç]/[x] (ch): Sau các nguyên âm (i, e, ä, ö, ü) phát âm [ç] nhẹ ở ngạc cứng (Ich-Laut); sau (a, o, u, au) phát âm [x] trầm sâu ở họng (Ach-Laut).';
  }
  if (target === 'R') {
    return 'Mẹo phát âm [ʁ] (r): Rung nhẹ ở cuống họng/lưỡi gà (Zäpfchen-R), không uốn cong đầu lưỡi như tiếng Anh.';
  }
  if (target === 'Z' || target === 'TS') {
    return 'Mẹo phát âm [ts] (z): Bắt đầu bằng vị trí của âm [t] rồi trượt nhanh sang âm [s] thật dứt khoát.';
  }
  if (target === 'V') {
    return 'Mẹo phát âm [f] (v): Trong tiếng Đức phần lớn chữ "V" được phát âm là âm vô thanh [f] (như trong "Vater", "Vogel").';
  }
  if (['B', 'D', 'G'].includes(target)) {
    return 'Quy tắc vô thanh hóa cuối từ (Auslautverhärtung): Các phụ âm b, d, g ở cuối từ/cuối âm tiết được phát âm cứng dứt khoát thành [p], [t], [k].';
  }
  if (['Ä', 'Ö', 'Ü'].includes(target)) {
    return 'Mẹo phát âm biến âm (Umlaut): [ä] mở miệng như "e", [ö] khẩu hình tròn môi phát âm "ê", [ü] chu môi nhọn phát âm "i".';
  }
  return 'Luyện tập phát âm từng âm tiết chậm rãi, chú ý độ mở khẩu hình và luồng hơi dứt khoát.';
}

export default function PhonemeDiagnosticCard({
  worstChar,
  expectedWord,
  feedback,
  isPassed = false
}: PhonemeDiagnosticCardProps) {
  if (!worstChar && !feedback) return null;

  const tip = worstChar ? getPhoneticTip(worstChar.char, worstChar.actual) : null;
  const scorePercent = worstChar ? Math.round(worstChar.score * 100) : 100;

  return (
    <div className={`p-5 sm:p-6 rounded-3xl border shadow-xl space-y-4 animate-in fade-in duration-300 ${
      isPassed 
        ? 'bg-gray-900/90 border-green-500/30' 
        : 'bg-gray-900/90 border-yellow-500/40 shadow-yellow-500/5'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {isPassed ? (
            <div className="w-8 h-8 rounded-xl bg-green-500/20 text-green-400 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-xl bg-yellow-500/20 text-yellow-400 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          )}
          <div>
            <h4 className="text-base font-bold text-white">
              {isPassed ? 'Phân tích Phát âm AI' : 'Chẩn đoán Âm cần cải thiện'}
            </h4>
            <p className="text-xs text-gray-400">Từ mục tiêu: <strong className="text-lime-400 font-mono">{expectedWord}</strong></p>
          </div>
        </div>

        {worstChar && (
          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
            scorePercent >= 80 
              ? 'bg-green-500/20 text-green-400 border-green-500/30' 
              : scorePercent >= 50 
              ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' 
              : 'bg-red-500/20 text-red-400 border-red-500/30'
          }`}>
            Âm yếu nhất: {scorePercent}%
          </span>
        )}
      </div>

      {/* Comparison Box: Target vs Actual */}
      {worstChar && (
        <div className="bg-gray-950/80 p-4 rounded-2xl border border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 w-full sm:w-auto justify-around sm:justify-start">
            {/* Target Phoneme */}
            <div className="text-center">
              <span className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Âm mục tiêu</span>
              <div className="px-4 py-2 bg-gray-800 rounded-xl border border-gray-700 font-mono text-lg font-black text-lime-400 shadow-inner">
                {worstChar.char}
              </div>
            </div>

            <div className="flex flex-col items-center justify-center px-2">
              <ArrowRight className="w-5 h-5 text-gray-500" />
              <span className="text-[10px] text-gray-500 mt-0.5">lệch sang</span>
            </div>

            {/* Actual Phoneme Heard */}
            <div className="text-center">
              <span className="text-[10px] text-gray-400 uppercase font-bold block mb-1">AI nhận diện</span>
              <div className={`px-4 py-2 rounded-xl border font-mono text-lg font-black shadow-inner ${
                scorePercent >= 80
                  ? 'bg-green-950/60 border-green-500/40 text-green-400'
                  : 'bg-red-950/60 border-red-500/40 text-red-400'
              }`}>
                {worstChar.actual || '?'}
              </div>
            </div>
          </div>

          <div className="text-left text-xs text-gray-300 sm:max-w-xs flex-1">
            <p className="font-semibold text-gray-200">
              {scorePercent >= 80 
                ? 'Âm này bạn phát âm khá tốt.' 
                : `Âm [${worstChar.char}] bị biến dạng hoặc đọc chưa rõ ràng.`}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Độ chuẩn xác âm vị CTC: <strong className="text-yellow-400">{scorePercent}%</strong>
            </p>
          </div>
        </div>
      )}

      {/* General Feedback Text */}
      {feedback && (
        <div className="bg-gray-800/60 p-3.5 rounded-xl border border-gray-700/60 text-xs text-gray-200 leading-relaxed flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Phonetic Tip */}
      {tip && (
        <div className="bg-blue-950/30 p-3.5 rounded-xl border border-blue-500/30 text-xs text-blue-200 leading-relaxed flex items-start gap-2.5">
          <Lightbulb className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-yellow-400 font-bold block mb-0.5">Mẹo cải thiện phát âm:</strong>
            <span>{tip}</span>
          </div>
        </div>
      )}
    </div>
  );
}
