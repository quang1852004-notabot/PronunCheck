'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw, Volume2, Gauge, Ear, EarOff } from 'lucide-react';

interface DarkAudioPlayerProps {
  audioUrl: string;       // Denoised/Main Audio
  rawAudioUrl?: string;   // Optional Raw Audio
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  className?: string;
  autoPlay?: boolean;
}

export default function DarkAudioPlayer({
  audioUrl,
  rawAudioUrl,
  onTimeUpdate,
  onEnded,
  className = '',
  autoPlay = false
}: DarkAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rawAudioRef = useRef<HTMLAudioElement | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [isRaw, setIsRaw] = useState(false);

  // Generate fixed aesthetic waveform heights
  const waveformHeights = useRef<number[]>([
    25, 45, 70, 85, 95, 60, 40, 75, 90, 80, 55, 35, 65, 90, 100, 85,
    70, 45, 60, 80, 95, 75, 50, 65, 85, 70, 40, 60, 75, 50, 30, 20
  ]).current;

  // Resolve true duration
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
    } catch (err) {}
  }, []);

  useEffect(() => {
    if (audioUrl) {
      resolveRealDuration(audioUrl);
    }
  }, [audioUrl, resolveRealDuration]);

  // Sync settings when components mount
  useEffect(() => {
    const main = audioRef.current;
    const raw = rawAudioRef.current;
    
    if (main) main.playbackRate = playbackRate;
    if (raw) raw.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    // Only listen to events on the main audio element to avoid double events
    const main = audioRef.current;
    if (!main) return;

    const handleLoadedMetadata = () => {
      const d = main.duration;
      if (isFinite(d) && !isNaN(d) && d > 0) setDuration(d);
    };

    const handleDurationChange = () => {
      const d = main.duration;
      if (isFinite(d) && !isNaN(d) && d > 0) setDuration(d);
    };

    const handleTimeUpdate = () => {
      const cTime = main.currentTime;
      setCurrentTime(cTime);
      
      const d = main.duration;
      const effectiveDuration = isFinite(d) && d > 0 ? d : duration;
      
      if (onTimeUpdate) {
        onTimeUpdate(cTime, effectiveDuration);
      }
      
      // Periodically sync raw audio if it drifts too far
      const raw = rawAudioRef.current;
      if (raw && !raw.paused && Math.abs(raw.currentTime - cTime) > 0.2) {
        raw.currentTime = cTime;
      }
    };

    const handleAudioEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      if (rawAudioRef.current) {
        rawAudioRef.current.currentTime = 0;
        rawAudioRef.current.pause();
      }
      if (onEnded) onEnded();
    };

    main.addEventListener('loadedmetadata', handleLoadedMetadata);
    main.addEventListener('durationchange', handleDurationChange);
    main.addEventListener('timeupdate', handleTimeUpdate);
    main.addEventListener('ended', handleAudioEnded);

    return () => {
      main.removeEventListener('loadedmetadata', handleLoadedMetadata);
      main.removeEventListener('durationchange', handleDurationChange);
      main.removeEventListener('timeupdate', handleTimeUpdate);
      main.removeEventListener('ended', handleAudioEnded);
    };
  }, [duration, onTimeUpdate, onEnded]);

  useEffect(() => {
    if (autoPlay && audioRef.current) {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        if (rawAudioRef.current) rawAudioRef.current.play().catch(()=>{});
      }).catch((e) => console.log('Autoplay prevented:', e));
    }
  }, [autoPlay, audioUrl, rawAudioUrl]);

  const togglePlay = () => {
    if (isPlaying) {
      audioRef.current?.pause();
      rawAudioRef.current?.pause();
      setIsPlaying(false);
    } else {
      audioRef.current?.play();
      rawAudioRef.current?.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) audioRef.current.currentTime = newTime;
    if (rawAudioRef.current) rawAudioRef.current.currentTime = newTime;
  };

  const handleRewind5s = () => {
    const newTime = Math.max(0, currentTime - 5);
    setCurrentTime(newTime);
    if (audioRef.current) audioRef.current.currentTime = newTime;
    if (rawAudioRef.current) rawAudioRef.current.currentTime = newTime;
  };

  const togglePlaybackRate = () => {
    const rates = [1.0, 1.25, 1.5, 0.75];
    const currentIndex = rates.indexOf(playbackRate);
    const nextRate = rates[(currentIndex + 1) % rates.length];
    setPlaybackRate(nextRate);
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
      <audio ref={audioRef} src={audioUrl} preload="auto" muted={isRaw} />
      {rawAudioUrl && (
        <audio ref={rawAudioRef} src={rawAudioUrl} preload="auto" muted={!isRaw} />
      )}

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
                    ? isRaw ? 'bg-orange-400 shadow-sm shadow-orange-400/40' : 'bg-lime-400 shadow-sm shadow-lime-400/40'
                    : 'bg-gray-700/60 group-hover:bg-gray-600/70'
                }`}
                style={{ height: `${h}%` }}
              />
            </div>
          );
        })}

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        {/* Left: Play/Pause & Rewind */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePlay}
            className={`w-10 h-10 rounded-2xl text-gray-950 flex items-center justify-center shadow-lg transition-transform cursor-pointer active:scale-95 ${
              isRaw 
                ? 'bg-gradient-to-br from-orange-400 to-amber-500 shadow-orange-500/20 hover:from-orange-300 hover:to-amber-400' 
                : 'bg-gradient-to-br from-lime-400 to-green-500 shadow-lime-500/20 hover:from-lime-300 hover:to-green-400'
            }`}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>

          <button
            type="button"
            onClick={handleRewind5s}
            className="px-2.5 py-2 bg-gray-900 hover:bg-gray-800 text-gray-300 hover:text-white rounded-xl border border-gray-700/80 transition-colors flex items-center gap-1 font-mono text-[11px] cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>-5s</span>
          </button>
        </div>

        {/* Center: Timestamp Display */}
        <div className="font-mono text-gray-300 font-bold text-xs tracking-wider bg-gray-900/80 px-3.5 py-1.5 rounded-xl border border-gray-800 self-center">
          <span className={isRaw ? "text-orange-400" : "text-lime-400"}>{formatTime(currentTime)}</span>
          <span className="text-gray-500 mx-1.5">/</span>
          <span className="text-gray-400">{formatTime(duration)}</span>
        </div>

        {/* Right: Dual Audio Toggle & Speed */}
        <div className="flex items-center gap-2 justify-end">
          {rawAudioUrl && (
            <button
              type="button"
              onClick={() => setIsRaw(!isRaw)}
              className={`px-3 py-1.5 flex items-center gap-1.5 font-bold rounded-xl border transition-all cursor-pointer active:scale-95 ${
                isRaw 
                  ? 'bg-orange-900/40 text-orange-400 border-orange-500/40 hover:bg-orange-800/40' 
                  : 'bg-lime-900/40 text-lime-400 border-lime-500/40 hover:bg-lime-800/40'
              }`}
            >
              {isRaw ? <EarOff className="w-3.5 h-3.5" /> : <Ear className="w-3.5 h-3.5" />}
              <span>{isRaw ? 'Âm gốc' : 'Khử ồn'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={togglePlaybackRate}
            className="px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-blue-400 hover:text-blue-300 rounded-xl border border-blue-500/30 transition-all font-mono text-xs font-bold flex items-center gap-1 cursor-pointer active:scale-95"
          >
            <Gauge className="w-3.5 h-3.5" />
            <span>{playbackRate}x</span>
          </button>
        </div>
      </div>
    </div>
  );
}
