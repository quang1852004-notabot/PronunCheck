'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw, Volume2, Gauge } from 'lucide-react';

interface DarkAudioPlayerProps {
  audioUrl: string;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  className?: string;
  autoPlay?: boolean;
}

export default function DarkAudioPlayer({
  audioUrl,
  onTimeUpdate,
  onEnded,
  className = '',
  autoPlay = false
}: DarkAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);

  // Generate fixed aesthetic waveform heights
  const waveformHeights = useRef<number[]>([
    25, 45, 70, 85, 95, 60, 40, 75, 90, 80, 55, 35, 65, 90, 100, 85,
    70, 45, 60, 80, 95, 75, 50, 65, 85, 70, 40, 60, 75, 50, 30, 20
  ]).current;

  // Resolve true duration using Web Audio API decodeAudioData (Fixes Infinity:NaN bug on WebM recording)
  const resolveRealDuration = useCallback(async (url: string) => {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      const realDur = audioBuffer.duration;
      if (isFinite(realDur) && realDur > 0) {
        setDuration(realDur);
      }
      audioCtx.close().catch(() => {});
    } catch (err) {
      // Fallback to normal duration handling
    }
  }, []);

  useEffect(() => {
    if (audioUrl) {
      resolveRealDuration(audioUrl);
    }
  }, [audioUrl, resolveRealDuration]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.playbackRate = playbackRate;

    const handleLoadedMetadata = () => {
      const d = audio.duration;
      if (isFinite(d) && !isNaN(d) && d > 0) {
        setDuration(d);
      }
    };

    const handleDurationChange = () => {
      const d = audio.duration;
      if (isFinite(d) && !isNaN(d) && d > 0) {
        setDuration(d);
      }
    };

    const handleTimeUpdate = () => {
      const cTime = audio.currentTime;
      setCurrentTime(cTime);
      
      // Update duration if it became available
      const d = audio.duration;
      const effectiveDuration = isFinite(d) && d > 0 ? d : duration;
      
      if (onTimeUpdate) {
        onTimeUpdate(cTime, effectiveDuration);
      }
    };

    const handleAudioEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      if (onEnded) {
        onEnded();
      }
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleAudioEnded);

    if (autoPlay) {
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    }

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleAudioEnded);
    };
  }, [audioUrl, onTimeUpdate, onEnded, autoPlay, playbackRate, duration]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(err => {
        console.error('Audio play error:', err);
      });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const newTime = Number(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleRewind5s = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const target = Math.max(0, audio.currentTime - 5);
    audio.currentTime = target;
    setCurrentTime(target);
  };

  const togglePlaybackRate = () => {
    const rates = [0.75, 1.0, 1.25];
    const currentIndex = rates.indexOf(playbackRate);
    const nextRate = rates[(currentIndex + 1) % rates.length];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const formatTime = (secs: number) => {
    if (!isFinite(secs) || isNaN(secs) || secs < 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercentage = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className={`w-full bg-gray-950/90 backdrop-blur-md p-4 sm:p-5 rounded-3xl border border-gray-700/80 shadow-2xl space-y-3.5 select-none ${className}`}>
      <audio ref={audioRef} src={audioUrl} preload="auto" />

      {/* Waveform Scrubber Visualizer */}
      <div className="relative w-full h-12 flex items-center gap-1 px-2 bg-gray-900/90 rounded-2xl border border-gray-800/80 overflow-hidden cursor-pointer group">
        {waveformHeights.map((h, i) => {
          const barProgress = (i / waveformHeights.length) * 100;
          const isPassed = barProgress <= progressPercentage;

          return (
            <div
              key={i}
              className="flex-1 h-full flex items-center justify-center pointer-events-none"
            >
              <div
                className={`w-full rounded-full transition-all duration-100 ${
                  isPassed
                    ? 'bg-lime-400 shadow-sm shadow-lime-400/40'
                    : 'bg-gray-700/60 group-hover:bg-gray-600/70'
                }`}
                style={{ height: `${h}%` }}
              />
            </div>
          );
        })}

        {/* Transparent Seek Input Overlay */}
        <input
          type="range"
          min={0}
          max={duration > 0 ? duration : 100}
          step={0.05}
          value={currentTime}
          onChange={handleSeek}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />
      </div>

      {/* Controls Bar */}
      <div className="flex items-center justify-between gap-3 text-xs">
        {/* Left: Play/Pause & Rewind */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePlay}
            className="w-10 h-10 rounded-2xl bg-gradient-to-br from-lime-400 to-green-500 hover:from-lime-300 hover:to-green-400 text-gray-950 flex items-center justify-center shadow-lg shadow-lime-500/20 active:scale-95 transition-transform cursor-pointer"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={handleRewind5s}
            className="px-2.5 py-2 bg-gray-900 hover:bg-gray-800 text-gray-300 hover:text-white rounded-xl border border-gray-700/80 transition-colors flex items-center gap-1 font-mono text-[11px] cursor-pointer"
            title="Rewind 5s"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>-5s</span>
          </button>
        </div>

        {/* Center: Timestamp Display (Never Infinity:NaN) */}
        <div className="font-mono text-gray-300 font-bold text-xs tracking-wider bg-gray-900/80 px-3.5 py-1.5 rounded-xl border border-gray-800">
          <span className="text-lime-400">{formatTime(currentTime)}</span>
          <span className="text-gray-500 mx-1.5">/</span>
          <span className="text-gray-400">{formatTime(duration)}</span>
        </div>

        {/* Right: Playback Speed Selector */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePlaybackRate}
            className="px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-blue-400 hover:text-blue-300 rounded-xl border border-blue-500/30 transition-all font-mono text-xs font-bold flex items-center gap-1 cursor-pointer active:scale-95"
            title="Playback Speed"
          >
            <Gauge className="w-3.5 h-3.5" />
            <span>{playbackRate}x</span>
          </button>
        </div>
      </div>
    </div>
  );
}
