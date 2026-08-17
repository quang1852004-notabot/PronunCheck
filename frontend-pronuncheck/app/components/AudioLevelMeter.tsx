'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, AlertCircle, CheckCircle2, Sparkles, X } from 'lucide-react';
import { useLanguage } from '@/app/contexts/LanguageContext';

interface AudioLevelMeterProps {
  stream: MediaStream | null;
  isRecording?: boolean;
  mode?: 'recording' | 'preview';
  onClosePreview?: () => void;
}

export default function AudioLevelMeter({
  stream,
  isRecording = false,
  mode = 'recording',
  onClosePreview,
}: AudioLevelMeterProps) {
  const { t } = useLanguage();
  const [displayedLevel, setDisplayedLevel] = useState(0); // 0 to 100 (Throttled 800ms)
  const barCount = mode === 'preview' ? 24 : 16;
  const [frequencies, setFrequencies] = useState<number[]>(new Array(barCount).fill(6));
  const [noiseStatus, setNoiseStatus] = useState<'quiet' | 'optimal' | 'noisy'>('optimal');

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const smoothedLevelRef = useRef<number>(0);
  const lastThrottleTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!stream) {
      setDisplayedLevel(0);
      smoothedLevelRef.current = 0;
      setFrequencies(new Array(barCount).fill(6));
      setNoiseStatus('optimal');
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = mode === 'preview' ? 128 : 64;
      analyser.smoothingTimeConstant = 0.6;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      lastThrottleTimeRef.current = performance.now();

      const updateMeter = () => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        const barValues: number[] = [];
        const activeBins = Math.min(barCount, dataArray.length);

        for (let i = 0; i < activeBins; i++) {
          const val = dataArray[i];
          sum += val;
          // Scale bar height between 8% and 100%
          const barHeight = Math.max(8, Math.min(100, Math.round((val / 255) * 100)));
          barValues.push(barHeight);
        }

        const avg = sum / activeBins;
        const instantLevel = Math.min(100, Math.round((avg / 135) * 100));

        // Exponential Moving Average (EMA) để làm mịn xung nhiễu
        smoothedLevelRef.current = smoothedLevelRef.current * 0.8 + instantLevel * 0.2;

        // Vạch sóng đồ họa cập nhật mượt mà theo từng frame
        setFrequencies(barValues);

        // Throttle: Chỉ cập nhật con số phần trăm và trạng thái mỗi 800ms một lần
        const now = performance.now();
        if (now - lastThrottleTimeRef.current >= 800) {
          lastThrottleTimeRef.current = now;
          const currentSmooth = Math.round(smoothedLevelRef.current);
          setDisplayedLevel(currentSmooth);

          if (currentSmooth < 15) {
            setNoiseStatus('quiet');
          } else if (currentSmooth > 65) {
            setNoiseStatus('noisy');
          } else {
            setNoiseStatus('optimal');
          }
        }

        animationFrameRef.current = requestAnimationFrame(updateMeter);
      };

      updateMeter();
    } catch (err) {
      console.error('AudioLevelMeter error:', err);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [stream, mode, barCount]);

  if (!stream && !isRecording && mode !== 'preview') return null;

  // ==========================================
  // 1. PRE-FLIGHT TEST MIC & AMBIENT NOISE MODE
  // ==========================================
  if (mode === 'preview') {
    return (
      <div className="w-full bg-gray-950/90 backdrop-blur-md p-4 rounded-2xl border border-gray-700/80 shadow-2xl space-y-3 animate-in fade-in duration-200 select-none">
        {/* Header with Title and Close Button */}
        <div className="flex items-center justify-between border-b border-gray-800/80 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
            </span>
            <span className="text-xs font-bold text-gray-200">Kiểm tra Micro & Độ ồn môi trường</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-[11px] font-semibold text-lime-400 bg-lime-950/60 border border-lime-800/50 px-2 py-0.5 rounded-full">
              <Sparkles className="w-3 h-3 text-lime-400" />
              <span>RNNoise AI Sẵn sàng</span>
            </div>
            {onClosePreview && (
              <button
                type="button"
                onClick={onClosePreview}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer"
                title="Đóng kiểm tra"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Status Banner (Throttled 800ms) */}
        <div className="flex items-center justify-between text-xs px-1">
          <div className="flex items-center gap-1.5 font-bold">
            {displayedLevel < 5 ? (
              <VolumeX className="w-4 h-4 text-gray-500" />
            ) : (
              <Volume2 className="w-4 h-4 text-cyan-400" />
            )}
            <span className="text-gray-300">Tín hiệu vào: <strong className="text-white font-mono text-sm">{displayedLevel}%</strong></span>
          </div>

          <div>
            {noiseStatus === 'quiet' && (
              <span className="text-xs text-emerald-400 font-bold flex items-center gap-1 bg-emerald-950/50 border border-emerald-800/50 px-2.5 py-0.5 rounded-md transition-all">
                <CheckCircle2 className="w-3.5 h-3.5" /> Môi trường yên tĩnh
              </span>
            )}
            {noiseStatus === 'optimal' && (
              <span className="text-xs text-lime-400 font-bold flex items-center gap-1 bg-lime-950/50 border border-lime-800/50 px-2.5 py-0.5 rounded-md transition-all">
                <CheckCircle2 className="w-3.5 h-3.5" /> Âm lượng thu tốt
              </span>
            )}
            {noiseStatus === 'noisy' && (
              <span className="text-xs text-amber-400 font-bold flex items-center gap-1 bg-amber-950/60 border border-amber-700/60 px-2.5 py-0.5 rounded-md transition-all">
                <AlertCircle className="w-3.5 h-3.5" /> Môi trường ồn (Quán cafe/Nhạc)
              </span>
            )}
          </div>
        </div>

        {/* 24 Frequency Waveform Bars */}
        <div className="flex items-end justify-between gap-1 h-14 px-3 bg-gray-900/90 rounded-xl border border-gray-800 py-1.5">
          {frequencies.map((height, idx) => {
            let barColor = 'bg-gradient-to-t from-cyan-500 to-lime-400 shadow-lime-500/20';
            if (height > 75) {
              barColor = 'bg-gradient-to-t from-amber-500 to-red-500 shadow-red-500/20';
            } else if (height > 50) {
              barColor = 'bg-gradient-to-t from-lime-500 to-yellow-400 shadow-yellow-500/20';
            }

            return (
              <div
                key={idx}
                className="flex-1 bg-gray-800/60 rounded-full flex items-end h-full overflow-hidden"
              >
                <div
                  className={`w-full rounded-full transition-all duration-75 shadow-sm ${barColor}`}
                  style={{ height: `${height}%` }}
                />
              </div>
            );
          })}
        </div>

        {/* Helpful Tip */}
        <p className="text-[11px] text-gray-400 text-center leading-relaxed">
          💡 <strong className="text-gray-300">Mẹo:</strong> Hãy nói thử một câu. Khi bạn im lặng, nếu vạch sóng vẫn đỏ cao (&gt;65%), hãy chuyển sang góc yên tĩnh hơn hoặc đeo tai nghe có mic gần miệng.
        </p>
      </div>
    );
  }

  // ==========================================
  // 2. IN-RECORDING METER MODE
  // ==========================================
  return (
    <div className="w-full max-w-sm bg-gray-950/80 backdrop-blur-md p-3.5 rounded-2xl border border-gray-700/80 shadow-lg space-y-2.5 animate-in fade-in duration-200 select-none">
      {/* Header Info */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 font-bold">
          {displayedLevel < 5 ? (
            <VolumeX className="w-3.5 h-3.5 text-gray-500" />
          ) : (
            <Volume2 className="w-3.5 h-3.5 text-lime-400" />
          )}
          <span className="text-gray-300">Tín hiệu Micro:</span>
        </div>

        <div className="flex items-center gap-1">
          {noiseStatus === 'quiet' && (
            <span className="text-[11px] text-yellow-400 flex items-center gap-1 font-medium">
              <AlertCircle className="w-3 h-3" /> Nói gần mic hơn
            </span>
          )}
          {noiseStatus === 'optimal' && (
            <span className="text-[11px] text-green-400 font-bold">
              ✓ Âm lượng tốt ({displayedLevel}%)
            </span>
          )}
          {noiseStatus === 'noisy' && (
            <span className="text-[11px] text-amber-400 flex items-center gap-1 font-bold">
              <AlertCircle className="w-3 h-3" /> Môi trường ồn ({displayedLevel}%)
            </span>
          )}
        </div>
      </div>

      {/* 16 Dynamic Waveform Frequency Bars */}
      <div className="flex items-end justify-between gap-1 h-12 px-2 bg-gray-900/90 rounded-xl border border-gray-800/80 py-1.5">
        {frequencies.map((height, idx) => {
          let barColor = 'bg-lime-400 shadow-lime-500/20';
          if (height > 80) {
            barColor = 'bg-red-500 shadow-red-500/20';
          } else if (height > 60) {
            barColor = 'bg-yellow-400 shadow-yellow-500/20';
          }

          return (
            <div
              key={idx}
              className="flex-1 bg-gray-800/80 rounded-full flex items-end h-full overflow-hidden"
            >
              <div
                className={`w-full rounded-full transition-all duration-75 shadow-sm ${barColor}`}
                style={{ height: `${height}%` }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
