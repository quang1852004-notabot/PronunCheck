'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, RotateCcw, Send, Upload, Timer, Sparkles, Activity } from 'lucide-react';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useToast } from '@/app/contexts/ToastContext';
import AudioLevelMeter from '@/app/components/AudioLevelMeter';
import DarkAudioPlayer from '@/app/components/DarkAudioPlayer';
import NoiseReductionSlider from '@/app/components/NoiseReductionSlider';
import { createRnnoiseNode } from '@/app/lib/rnnoise';

interface AudioRecorderProps {
  onAudioReady: (blob: Blob) => void;
  disabled?: boolean;
}

export default function AudioRecorder({ onAudioReady, disabled = false }: AudioRecorderProps) {
  const { t } = useLanguage();
  const { error: toastError } = useToast();
  
  const [isRecording, setIsRecording] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // Noise Reduction Level (0: Off, 1: Low (Default), 2: Medium, 3: High, 4: Extreme)
  const [noiseLevel, setNoiseLevel] = useState<number>(1);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load initial noise level from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('pronuncheck_noise_level');
        if (saved !== null) {
          const parsed = Number(saved);
          if (parsed >= 0 && parsed <= 4) {
            setNoiseLevel(parsed);
          }
        }
      } catch (_) {}
    }
  }, []);

  // Recording Timer
  useEffect(() => {
    if (isRecording) {
      setRecordingSeconds(0);
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPreviewStream();
      cleanupAudioContext();
    };
  }, []);

  const cleanupAudioContext = () => {
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  };

  const stopPreviewStream = () => {
    if (previewStream) {
      previewStream.getTracks().forEach(track => track.stop());
      setPreviewStream(null);
    }
    setIsPreviewing(false);
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toastError(t('recorder.file_too_large'));
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      stopPreviewStream();
      setRecordedBlob(file);
      setAudioUrl(URL.createObjectURL(file));
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Build WebRTC constraints according to noiseLevel
  const getMediaConstraints = (lvl: number): MediaStreamConstraints => {
    if (lvl === 0) {
      return {
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        }
      };
    }

    if (lvl === 1) {
      return {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
          channelCount: 1,
        }
      };
    }

    // Levels 2, 3, 4
    return {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      }
    };
  };

  // Pre-flight Mic Check
  const togglePreview = async () => {
    if (isPreviewing) {
      stopPreviewStream();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia(getMediaConstraints(noiseLevel));
      setPreviewStream(stream);
      setIsPreviewing(true);
    } catch (err) {
      console.error(err);
      toastError(t('recorder.mic_permission_error'));
    }
  };

  const startRecording = async () => {
    try {
      // 1. Kích hoạt stream theo đúng mức độ khử ồn đã chọn
      let stream = previewStream;
      if (!stream || !stream.active) {
        stream = await navigator.mediaDevices.getUserMedia(getMediaConstraints(noiseLevel));
      }
      
      streamRef.current = stream;
      setActiveStream(stream);
      stopPreviewStream(); // Tắt preview độc lập để chuyển sang ghi âm

      let recordStream = stream;

      // 2. Thiết lập Web Audio DSP Graph theo 5 nấc khử ồn
      if (noiseLevel > 0) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioCtx = new AudioCtx();
        audioContextRef.current = audioCtx;

        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }

        const sourceNode = audioCtx.createMediaStreamSource(stream);
        const destination = audioCtx.createMediaStreamDestination();

        // Cấu hình tần số cắt High-Pass Filter theo nấc
        const highPassCutoff = noiseLevel === 1 ? 60 : noiseLevel === 2 ? 80 : 100;
        const highPassQ = noiseLevel >= 3 ? 0.707 : 0.5;

        const highPassFilter = audioCtx.createBiquadFilter();
        highPassFilter.type = 'highpass';
        highPassFilter.frequency.value = highPassCutoff;
        highPassFilter.Q.value = highPassQ;

        if (noiseLevel === 1 || noiseLevel === 2) {
          // Nấc 1 & 2: Transparent High-Pass
          sourceNode.connect(highPassFilter);
          highPassFilter.connect(destination);
        } else if (noiseLevel === 3) {
          // Nấc 3: High-Pass + RNNoise AI Worklet (nếu hỗ trợ)
          const rnnoiseNode = await createRnnoiseNode(audioCtx);
          if (rnnoiseNode) {
            sourceNode.connect(rnnoiseNode);
            rnnoiseNode.connect(highPassFilter);
          } else {
            sourceNode.connect(highPassFilter);
          }
          highPassFilter.connect(destination);
        } else if (noiseLevel === 4) {
          // Nấc 4 (Cực đoan): High-Pass + RNNoise AI + Dynamics Compressor
          const rnnoiseNode = await createRnnoiseNode(audioCtx);
          const compressor = audioCtx.createDynamicsCompressor();
          compressor.threshold.value = -18;
          compressor.knee.value = 20;
          compressor.ratio.value = 4;
          compressor.attack.value = 0.003;
          compressor.release.value = 0.15;

          if (rnnoiseNode) {
            sourceNode.connect(rnnoiseNode);
            rnnoiseNode.connect(highPassFilter);
          } else {
            sourceNode.connect(highPassFilter);
          }
          highPassFilter.connect(compressor);
          compressor.connect(destination);
        }

        if (destination.stream && destination.stream.getAudioTracks().length > 0) {
          recordStream = destination.stream;
        }
      }

      // Xác định định dạng ghi âm chất lượng cao (128kbps)
      let options: MediaRecorderOptions = {};
      let mimeType = '';
      if (typeof MediaRecorder.isTypeSupported === 'function') {
        const types = [
          'audio/webm;codecs=opus',
          'audio/webm',
          'audio/mp4',
          'audio/mpeg',
          'audio/aac'
        ];
        for (const tType of types) {
          if (MediaRecorder.isTypeSupported(tType)) {
            options = { mimeType: tType, audioBitsPerSecond: 128000 };
            mimeType = tType;
            break;
          }
        }
      }

      const recorder = new MediaRecorder(recordStream, options);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blobType = mimeType || recorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: blobType });
        setRecordedBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setActiveStream(null);
        cleanupAudioContext();
      };

      recorder.start(100);
      setIsRecording(true);
      setRecordedBlob(null);
      setAudioUrl(null);
    } catch (err) {
      console.error(err);
      cleanupAudioContext();
      toastError(t('recorder.mic_permission_error'));
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      setIsRecording(false);
    }
  };

  const resetRecording = () => {
    setRecordedBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
    setRecordingSeconds(0);
  };

  const handleSubmit = () => {
    if (recordedBlob) {
      onAudioReady(recordedBlob);
      resetRecording();
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-5 bg-gray-900/80 rounded-3xl border border-gray-700/80 shadow-xl w-full">
      {/* 1. Pre-flight Waveform Preview (Kiểm tra micro trước) */}
      {isPreviewing && previewStream && (
        <AudioLevelMeter
          stream={previewStream}
          mode="preview"
          onClosePreview={stopPreviewStream}
        />
      )}

      {/* 2. Initial Buttons */}
      {!isRecording && !recordedBlob && (
        <div className="flex flex-col items-center gap-4 w-full">
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
            <button
              type="button"
              onClick={startRecording}
              disabled={disabled}
              className={`flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl font-bold text-white shadow-xl transition-all cursor-pointer ${
                disabled
                  ? 'bg-gray-700 cursor-not-allowed opacity-50'
                  : 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 active:scale-95 shadow-red-500/25'
              }`}
            >
              <Mic className="w-5 h-5 animate-pulse" />
              <span>{t('recorder.start')}</span>
            </button>

            {/* Nút Kiểm tra Micro trước (Pre-flight Test) */}
            <button
              type="button"
              onClick={togglePreview}
              disabled={disabled}
              className={`flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl font-semibold transition-all cursor-pointer border text-xs sm:text-sm ${
                isPreviewing
                  ? 'bg-cyan-950 text-cyan-400 border-cyan-700 shadow-cyan-500/20'
                  : 'bg-gray-800 hover:bg-gray-750 text-gray-300 border-gray-700 hover:border-gray-600'
              }`}
            >
              <Activity className={`w-4 h-4 ${isPreviewing ? 'animate-spin text-cyan-400' : 'text-cyan-400'}`} />
              <span>{isPreviewing ? 'Dừng kiểm tra' : 'Kiểm tra Micro'}</span>
            </button>

            <span className="text-gray-500 font-medium text-xs hidden sm:inline">•</span>

            <label className={`flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl font-semibold text-white shadow-md transition-all cursor-pointer text-xs sm:text-sm ${
              disabled ? 'bg-gray-700 cursor-not-allowed opacity-50' : 'bg-gray-800 hover:bg-gray-750 border border-gray-700 active:scale-95'
            }`}>
              <Upload className="w-4 h-4 text-blue-400" />
              <span>{t('recorder.upload_file')}</span>
              <input 
                type="file" 
                accept="audio/*" 
                className="hidden" 
                onChange={handleFileUpload} 
                disabled={disabled}
                ref={fileInputRef}
              />
            </label>
          </div>

          {/* Thanh trượt 5 nấc khử ồn tùy chỉnh */}
          <NoiseReductionSlider
            value={noiseLevel}
            onChange={(lvl) => setNoiseLevel(lvl)}
            disabled={disabled}
          />
        </div>
      )}

      {/* 3. Recording in Progress State */}
      {isRecording && (
        <div className="flex flex-col items-center gap-4 w-full animate-in fade-in duration-200">
          {/* Header Recording Badge & Timer */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-red-400 font-bold bg-red-500/15 px-3 py-1 rounded-full border border-red-500/30 text-xs">
              <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping"></span>
              <span>{t('recorder.recording')}</span>
            </div>

            <div className="flex items-center gap-1 text-[11px] font-semibold text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-2.5 py-1 rounded-full">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>Khử ồn Mức {noiseLevel}</span>
            </div>

            <div className="flex items-center gap-1.5 font-mono text-base font-extrabold text-white bg-gray-950 px-3.5 py-1 rounded-full border border-gray-800 shadow-inner">
              <Timer className="w-4 h-4 text-lime-400" />
              <span>{formatTimer(recordingSeconds)}</span>
            </div>
          </div>

          {/* Real-time Audio Level Meter */}
          <AudioLevelMeter stream={activeStream} isRecording={isRecording} mode="recording" />

          {/* Stop Recording Button */}
          <button
            type="button"
            onClick={stopRecording}
            className="flex items-center gap-2 px-8 py-3.5 rounded-2xl font-extrabold text-white bg-gray-800 hover:bg-gray-750 active:scale-95 transition-all border border-gray-600 shadow-2xl cursor-pointer"
          >
            <Square className="w-4 h-4 text-red-400 fill-current" />
            <span>{t('recorder.stop')}</span>
          </button>
        </div>
      )}

      {/* 4. Recorded & Ready to Review State */}
      {recordedBlob && audioUrl && (
        <div className="flex flex-col items-center gap-4 w-full animate-in fade-in duration-200">
          <DarkAudioPlayer audioUrl={audioUrl} />

          {/* Bottom Action Buttons */}
          <div className="flex items-center gap-3 w-full justify-end">
            <button
              type="button"
              onClick={resetRecording}
              disabled={disabled}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-800 hover:bg-gray-750 text-gray-300 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-gray-700"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{t('recorder.re_record')}</span>
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={disabled}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-lime-400 to-green-500 hover:from-lime-300 hover:to-green-400 text-gray-950 font-extrabold rounded-xl text-xs shadow-lg shadow-lime-500/20 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{t('recorder.submit_grade')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
