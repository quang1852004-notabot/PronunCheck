'use client';

import React, { useState, useMemo } from 'react';
import { X, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
import { CharScoreItem } from './PhonemeDiagnosticCard';

export interface WordTimestampItem {
  word: string;
  start: number;
  end: number;
}

interface PhonemeKaraokeVisualizerProps {
  expectedWord: string;
  charScores?: CharScoreItem[];
  wordTimestamps?: WordTimestampItem[];
  currentTime?: number;
  duration?: number;
  isPlaying?: boolean;
}

interface WordEvaluation {
  word: string;
  score: number; // 0 - 100 integer
  status: 'good' | 'medium' | 'bad';
  startIndex: number;
  endIndex: number;
}

export default function PhonemeKaraokeVisualizer({
  expectedWord,
  charScores,
  wordTimestamps,
  currentTime = 0,
  duration = 0,
  isPlaying = false
}: PhonemeKaraokeVisualizerProps) {
  const [selectedWordIndex, setSelectedWordIndex] = useState<number | null>(null);

  // Group characters into words and calculate average score for each word
  const wordsData: WordEvaluation[] = useMemo(() => {
    const data: WordEvaluation[] = [];
    const regex = /\S+/g;
    let match;

    while ((match = regex.exec(expectedWord)) !== null) {
      const word = match[0];
      const startIndex = match.index;
      const endIndex = startIndex + word.length;
      
      let scoreSum = 0;
      let validCount = 0;

      for (let i = startIndex; i < endIndex; i++) {
        if (charScores && charScores[i]) {
          const rawSc = charScores[i].score;
          // Normalize to [0, 100]
          const sc100 = rawSc <= 1.0 ? rawSc * 100 : rawSc;
          scoreSum += sc100;
          validCount++;
        }
      }

      const avgScore = validCount > 0 ? Math.round(scoreSum / validCount) : 100;
      let status: 'good' | 'medium' | 'bad' = 'good';
      if (avgScore < 50) {
        status = 'bad';
      } else if (avgScore < 80) {
        status = 'medium';
      }

      data.push({
        word,
        score: avgScore,
        status,
        startIndex,
        endIndex
      });
    }

    return data;
  }, [expectedWord, charScores]);

  // Total words count and time allocated per word (fallback when exact wordTimestamps is absent)
  const totalWords = wordsData.length;
  const wordTimeSlot = duration > 0 && totalWords > 0 ? duration / totalWords : 1;

  // Selected word details
  const selectedWord = selectedWordIndex !== null ? wordsData[selectedWordIndex] : null;

  return (
    <div className="w-full bg-gray-950/90 backdrop-blur-md p-5 sm:p-7 rounded-3xl border border-gray-700/80 shadow-2xl space-y-4 select-none">
      {/* Word-Level Karaoke Text Display (Clean & Natural Typography) */}
      <div className="py-6 px-4 bg-gray-900/90 rounded-2xl border border-gray-800 flex flex-wrap items-center justify-center gap-x-4 gap-y-3 shadow-inner">
        {wordsData.map((item, idx) => {
          const isSelected = selectedWordIndex === idx;

          // Word color based on score
          const colorHex = item.status === 'good' ? '#4ade80' : item.status === 'medium' ? '#facc15' : '#f87171';

          // Calculate sweep progress (0% - 100%) using Wav2Vec2 wordTimestamps if available
          let sweepPercent = 0;
          if (isPlaying) {
            let wordStart = idx * wordTimeSlot;
            let wordEnd = (idx + 1) * wordTimeSlot;
            let wordDuration = wordTimeSlot;

            if (wordTimestamps && wordTimestamps[idx]) {
              wordStart = wordTimestamps[idx].start;
              wordEnd = wordTimestamps[idx].end;
              wordDuration = Math.max(0.05, wordEnd - wordStart);
            }

            if (currentTime >= wordEnd) {
              sweepPercent = 100;
            } else if (currentTime >= wordStart) {
              sweepPercent = Math.min(100, Math.max(0, ((currentTime - wordStart) / wordDuration) * 100));
            } else {
              sweepPercent = 0;
            }
          } else {
            // When stopped / paused, show the full evaluated color
            sweepPercent = 100;
          }

          return (
            <button
              key={idx}
              type="button"
              onClick={() => setSelectedWordIndex(isSelected ? null : idx)}
              className={`relative font-sans text-2xl sm:text-4xl font-extrabold tracking-wide transition-all duration-150 cursor-pointer px-2 py-1 rounded-xl group ${
                isSelected 
                  ? 'ring-2 ring-blue-400 bg-gray-800/80 scale-105' 
                  : 'hover:bg-gray-800/40 hover:scale-105'
              }`}
              title={`${item.word}: ${item.score} / 100`}
            >
              {/* Text with Horizontal Sweep Gradient Background */}
              <span
                style={{
                  backgroundImage: `linear-gradient(to right, ${colorHex} ${sweepPercent}%, #4b5563 ${sweepPercent}%)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  display: 'inline-block'
                }}
              >
                {item.word}
              </span>

              {/* Subtle underline indicating quality */}
              <span
                className="block h-1 rounded-full mt-1 transition-all duration-200"
                style={{
                  backgroundColor: colorHex,
                  opacity: sweepPercent > 0 ? 0.9 : 0.2,
                  width: `${sweepPercent}%`
                }}
              />
            </button>
          );
        })}
      </div>

      {/* Selected Word Details Popup Card */}
      {selectedWord && (
        <div className="bg-gray-900 p-4 rounded-2xl border border-blue-500/40 shadow-xl flex items-center justify-between gap-4 animate-in fade-in duration-200">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
              selectedWord.status === 'good' 
                ? 'bg-green-500/20 text-green-400' 
                : selectedWord.status === 'medium' 
                ? 'bg-yellow-500/20 text-yellow-400' 
                : 'bg-red-500/20 text-red-400'
            }`}>
              {selectedWord.status === 'good' ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : selectedWord.status === 'medium' ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-base font-extrabold text-white font-mono">{selectedWord.word}</h4>
                <span className="text-xs text-gray-400">
                  (Điểm: <strong className={selectedWord.status === 'good' ? 'text-green-400 font-mono' : selectedWord.status === 'medium' ? 'text-yellow-400 font-mono' : 'text-red-400 font-mono'}>{selectedWord.score}</strong> / 100)
                </span>
              </div>
              <p className="text-xs text-gray-300 mt-0.5">
                {selectedWord.status === 'good' 
                  ? 'Phát âm chuẩn xác, rõ ràng.' 
                  : selectedWord.status === 'medium' 
                  ? 'Phát âm ở mức khá, cần chú ý khẩu hình thêm một chút.' 
                  : 'Phát âm chưa chuẩn, hãy nghe lại audio mẫu và luyện lại từ này.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSelectedWordIndex(null)}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
