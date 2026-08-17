'use client';

import React, { useState, useMemo } from 'react';
import { Sparkles, Info, X, Volume2, CheckCircle2, AlertCircle } from 'lucide-react';
import { CharScoreItem } from './PhonemeDiagnosticCard';

interface PhonemeKaraokeVisualizerProps {
  expectedWord: string;
  charScores?: CharScoreItem[];
  currentTime?: number;
  duration?: number;
  isPlaying?: boolean;
}

export default function PhonemeKaraokeVisualizer({
  expectedWord,
  charScores,
  currentTime = 0,
  duration = 0,
  isPlaying = false
}: PhonemeKaraokeVisualizerProps) {
  const [selectedCharIndex, setSelectedCharIndex] = useState<number | null>(null);

  // Normalize chars list
  const displayItems = useMemo(() => {
    const chars = expectedWord.split('');
    
    // If charScores is provided and matches length, use it
    if (charScores && charScores.length > 0) {
      let scoreIdx = 0;
      return chars.map((char, index) => {
        if (char === ' ') {
          return { char: ' ', score: 1.0, actual: ' ', isSpace: true, index };
        }
        const item = charScores[scoreIdx];
        scoreIdx++;
        return {
          char,
          score: item ? item.score : 0.85,
          actual: item ? item.actual : char,
          duration_feedback: item?.duration_feedback,
          isSpace: false,
          index
        };
      });
    }

    // Fallback if no charScores available (e.g. older recordings)
    return chars.map((char, index) => ({
      char,
      score: 0.85,
      actual: char,
      duration_feedback: null,
      isSpace: char === ' ',
      index
    }));
  }, [expectedWord, charScores]);

  // Determine current active karaoke character index based on playback progress
  const activeCharIndex = useMemo(() => {
    if (!isPlaying || duration <= 0 || currentTime <= 0) return -1;
    const progress = Math.min(1, Math.max(0, currentTime / duration));
    const totalChars = displayItems.length;
    return Math.min(totalChars - 1, Math.floor(progress * totalChars));
  }, [isPlaying, currentTime, duration, displayItems.length]);

  return (
    <div className="w-full bg-gray-950/90 backdrop-blur-md p-6 sm:p-8 rounded-3xl border border-gray-700/80 shadow-2xl space-y-6 select-none relative overflow-hidden">
      {/* Header & Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-lime-400" />
          <h3 className="text-base font-bold text-white">
            Trực quan hóa Âm vị AI (Karaoke Highlight)
          </h3>
        </div>

        {/* Legend Pills */}
        <div className="flex items-center gap-2 text-[11px] font-bold">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/30">
            <span className="w-2 h-2 rounded-full bg-green-400"></span> &ge;80% Chuẩn
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/30">
            <span className="w-2 h-2 rounded-full bg-yellow-400"></span> 50-79% Cần sửa
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30">
            <span className="w-2 h-2 rounded-full bg-red-400"></span> &lt;50% Sai
          </span>
        </div>
      </div>

      {/* Main Karaoke Text Display */}
      <div className="py-6 sm:py-8 px-4 bg-gray-900/90 rounded-2xl border border-gray-800 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 shadow-inner">
        {displayItems.map((item, idx) => {
          if (item.isSpace) {
            return <span key={idx} className="w-4 sm:w-6 inline-block"></span>;
          }

          const scorePercent = Math.round(item.score * 100);
          const isCurrentlyPlaying = activeCharIndex === idx;
          const isSelected = selectedCharIndex === idx;

          let colorStyles = 'text-green-400 bg-green-500/10 border-green-500/30 hover:border-green-400';
          if (scorePercent < 50) {
            colorStyles = 'text-red-400 bg-red-500/15 border-red-500/40 hover:border-red-400';
          } else if (scorePercent < 80) {
            colorStyles = 'text-yellow-400 bg-yellow-500/15 border-yellow-500/40 hover:border-yellow-400';
          }

          return (
            <div key={idx} className="relative inline-flex flex-col items-center group">
              <button
                type="button"
                onClick={() => setSelectedCharIndex(isSelected ? null : idx)}
                className={`w-10 sm:w-14 h-14 sm:h-20 rounded-2xl font-mono text-2xl sm:text-4xl font-black flex items-center justify-center border-2 transition-all duration-200 cursor-pointer shadow-lg ${colorStyles} ${
                  isCurrentlyPlaying 
                    ? 'scale-115 ring-4 ring-lime-400 border-white bg-lime-400 text-gray-950 shadow-lime-400/50 z-20 animate-pulse' 
                    : isSelected 
                    ? 'scale-110 ring-2 ring-blue-400 z-10' 
                    : 'hover:scale-105'
                }`}
                title={`Ký tự: ${item.char} (${scorePercent}%) - Bấm để xem chi tiết`}
              >
                {item.char}
              </button>

              {/* Subtitle Score Badge */}
              <span className={`text-[10px] font-mono font-bold mt-1.5 transition-opacity ${
                scorePercent >= 80 ? 'text-green-400' : scorePercent >= 50 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {scorePercent}%
              </span>
            </div>
          );
        })}
      </div>

      {/* Instruction */}
      <p className="text-center text-xs text-gray-400">
        💡 <em>Bấm vào từng chữ cái để xem âm AI nhận diện và nhận xét độ dài nguyên âm.</em>
      </p>

      {/* Interactive Tooltip Card on Selected Character */}
      {selectedCharIndex !== null && displayItems[selectedCharIndex] && (
        <div className="bg-gray-900 p-4 sm:p-5 rounded-2xl border border-blue-500/40 shadow-xl space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between border-b border-gray-800 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-mono font-black text-lg">
                {displayItems[selectedCharIndex].char}
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Chi tiết âm vị</h4>
                <p className="text-[11px] text-gray-400">Vị trí: #{selectedCharIndex + 1} trong từ</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedCharIndex(null)}
              className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-gray-950 p-3 rounded-xl border border-gray-800">
              <span className="text-gray-400 block text-[10px] uppercase font-bold">Độ chuẩn xác</span>
              <strong className={`text-base font-bold font-mono ${
                displayItems[selectedCharIndex].score >= 0.8 
                  ? 'text-green-400' 
                  : displayItems[selectedCharIndex].score >= 0.5 
                  ? 'text-yellow-400' 
                  : 'text-red-400'
              }`}>
                {Math.round(displayItems[selectedCharIndex].score * 100)}%
              </strong>
            </div>

            <div className="bg-gray-950 p-3 rounded-xl border border-gray-800">
              <span className="text-gray-400 block text-[10px] uppercase font-bold">AI nhận diện</span>
              <strong className="text-base font-bold font-mono text-lime-400">
                {displayItems[selectedCharIndex].actual || displayItems[selectedCharIndex].char}
              </strong>
            </div>

            <div className="col-span-2 sm:col-span-1 bg-gray-950 p-3 rounded-xl border border-gray-800">
              <span className="text-gray-400 block text-[10px] uppercase font-bold">Đánh giá</span>
              <span className="font-bold text-xs text-gray-200">
                {displayItems[selectedCharIndex].score >= 0.8 ? 'Rất tốt' : displayItems[selectedCharIndex].score >= 0.5 ? 'Chấp nhận được' : 'Cần sửa'}
              </span>
            </div>
          </div>

          {displayItems[selectedCharIndex].duration_feedback && (
            <div className="bg-yellow-950/40 p-3 rounded-xl border border-yellow-500/30 text-xs text-yellow-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
              <span>{displayItems[selectedCharIndex].duration_feedback}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
