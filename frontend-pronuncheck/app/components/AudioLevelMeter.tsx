'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, AlertCircle } from 'lucide-react';

interface AudioLevelMeterProps {
  stream: MediaStream | null;
  isRecording: boolean;
}

export default function AudioLevelMeter({ stream, isRecording }: AudioLevelMeterProps) {
  const [level, setLevel] = useState(0); // 0 to 100
  const [frequencies, setFrequencies] = useState<number[]>(new Array(16).fill(5));
  const [noiseStatus, setNoiseStatus] = useState<'quiet' | 'optimal' | 'noisy'>('optimal');
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!stream || !isRecording) {
      setLevel(0);
      setFrequencies(new Array(16).fill(5));
      setNoiseStatus('optimal');
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64; // 32 frequency bins
      analyser.smoothingTimeConstant = 0.7;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateMeter = () => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);

        // Calculate average volume (RMS-like)
        let sum = 0;
        const barValues: number[] = [];
        const binCount = Math.min(16, dataArray.length);

        for (let i = 0; i < binCount; i++) {
          const val = dataArray[i];
          sum += val;
          // Scale bar height between 10% and 100%
          const barHeight = Math.max(10, Math.min(100, Math.round((val / 255) * 100)));
          barValues.push(barHeight);
        }

        const avg = sum / binCount;
        const normalizedLevel = Math.min(100, Math.round((avg / 160) * 100));

        setLevel(normalizedLevel);
        setFrequencies(barValues);

        if (normalizedLevel < 12) {
          setNoiseStatus('quiet');
        } else if (normalizedLevel > 80) {
          setNoiseStatus('noisy');
        } else {
          setNoiseStatus('optimal');
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
  }, [stream, isRecording]);

  if (!isRecording) return null;

  return (
    <div className="w-full max-w-sm bg-gray-950/80 backdrop-blur-md p-3.5 rounded-2xl border border-gray-700/80 shadow-lg space-y-2.5 animate-in fade-in duration-200 select-none">
      {/* Header Info */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 font-bold">
          {level < 5 ? (
            <VolumeX className="w-3.5 h-3.5 text-gray-500" />
          ) : (
            <Volume2 className="w-3.5 h-3.5 text-lime-400 animate-pulse" />
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
              ✓ Âm lượng tốt ({level}%)
            </span>
          )}
          {noiseStatus === 'noisy' && (
            <span className="text-[11px] text-red-400 flex items-center gap-1 font-bold animate-pulse">
              <AlertCircle className="w-3 h-3" /> Môi trường ồn ({level}%)
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
