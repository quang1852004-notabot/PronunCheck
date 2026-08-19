'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, RotateCcw, Send, Upload, Timer, Sparkles, Activity } from 'lucide-react';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useToast } from '@/app/contexts/ToastContext';
import AudioLevelMeter from '@/app/components/AudioLevelMeter';
import DarkAudioPlayer from '@/app/components/DarkAudioPlayer';
import NoiseReductionSlider from '@/app/components/NoiseReductionSlider';

interface AudioRecorderProps {
  onAudioReady: (denoisedBlob: Blob, rawBlob?: Blob) => void;
  disabled?: boolean;
}

export default function AudioRecorder({ onAudioReady, disabled = false }: AudioRecorderProps) {
  const { t } = useLanguage();
  const { error: toastError, success: toastSuccess } = useToast();
  
  const [isRecording, setIsRecording] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isDenoising, setIsDenoising] = useState(false);
  const [recordedDenoisedBlob, setRecordedDenoisedBlob] = useState<Blob | null>(null);
  const [recordedRawBlob, setRecordedRawBlob] = useState<Blob | null>(null);
  
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [rawAudioUrl, setRawAudioUrl] = useState<string | null>(null);
  
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // Noise Reduction Level (0: Off, 1: Low (Default), 2: Medium, 3: High, 4: Extreme)
  const [noiseLevel, setNoiseLevel] = useState<number>(1);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load initial noise level from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('pronuncheck_noise_level');
        if (saved !== null) {
          const parsed = Number(saved);
          if (parsed >= 0 && parsed <= 4) setNoiseLevel(parsed);
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
    return () => stopPreviewStream();
  }, []);

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

  const processDenoiseBackend = async (rawBlob: Blob) => {
    setIsDenoising(true);
    try {
      const formData = new FormData();
      formData.append('audio_file', rawBlob, 'raw_audio.webm');
      formData.append('noise_level', noiseLevel.toString());

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.thuy-tien.pro';
      const response = await fetch(`${apiUrl}/api/v1/denoise`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Denoise API error: ${response.statusText}`);
      }

      const denoisedBlob = await response.blob();
      setRecordedRawBlob(rawBlob);
      setRecordedDenoisedBlob(denoisedBlob);
      
      setRawAudioUrl(URL.createObjectURL(rawBlob));
      setAudioUrl(URL.createObjectURL(denoisedBlob));
      
    } catch (err: any) {
      console.error('Denoise failed:', err);
      toastError('Khử ồn thất bại. Trả về âm thanh gốc.');
      // Fallback to raw if denoise fails
      setRecordedRawBlob(rawBlob);
      setRecordedDenoisedBlob(rawBlob);
      setRawAudioUrl(URL.createObjectURL(rawBlob));
      setAudioUrl(URL.createObjectURL(rawBlob));
    } finally {
      setIsDenoising(false);
    }
  };

  const startRecording = async () => {
    try {
      stopPreviewStream();
      setAudioUrl(null);
      setRawAudioUrl(null);
      setRecordedDenoisedBlob(null);
      setRecordedRawBlob(null);
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: false, // Let backend handle it
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 48000
        }
      });
      
      streamRef.current = stream;
      setActiveStream(stream);

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const rawBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
          setActiveStream(null);
        }
        
        if (noiseLevel === 0) {
          // No denoise requested
          setRecordedRawBlob(rawBlob);
          setRecordedDenoisedBlob(rawBlob);
          const url = URL.createObjectURL(rawBlob);
          setRawAudioUrl(url);
          setAudioUrl(url);
        } else {
          await processDenoiseBackend(rawBlob);
        }
      };

      mediaRecorder.start(250);
      setIsRecording(true);
    } catch (err) {
      console.error('Lỗi truy cập microphone:', err);
      toastError(t('practice.error_mic_access'));
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
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
      setRecordedRawBlob(file);
      setRecordedDenoisedBlob(file);
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
      setRawAudioUrl(url);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const togglePreview = async () => {
    if (isPreviewing) {
      stopPreviewStream();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setPreviewStream(stream);
      setIsPreviewing(true);
    } catch (err) {
      console.error(err);
      toastError(t('recorder.mic_permission_error'));
    }
  };

  const resetRecording = () => {
    setRecordedDenoisedBlob(null);
    setRecordedRawBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    if (rawAudioUrl) {
      URL.revokeObjectURL(rawAudioUrl);
    }
    setAudioUrl(null);
    setRawAudioUrl(null);
    setRecordingSeconds(0);
  };

  const handleSubmit = () => {
    if (recordedDenoisedBlob) {
      onAudioReady(recordedDenoisedBlob, recordedRawBlob || undefined);
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
      {!isRecording && !recordedDenoisedBlob && !isDenoising && (
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
        <div className="flex flex-col items-center gap-6 w-full animate-in fade-in zoom-in-95 duration-200">
          <div className="font-mono text-4xl font-bold tracking-tight text-white flex flex-col items-center gap-2">
            <span className="flex items-center gap-3">
              <span className="w-3.5 h-3.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]"></span>
              {formatTimer(recordingSeconds)}
            </span>
            <span className="text-xs font-sans font-medium text-red-400 tracking-wider uppercase">
              {t('practice.recording')}
            </span>
          </div>

          <button
            type="button"
            onClick={stopRecording}
            className="w-20 h-20 rounded-3xl bg-red-500/10 hover:bg-red-500/20 border-2 border-red-500/30 text-red-500 flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg shadow-red-500/10"
          >
            <Square className="w-8 h-8 fill-current" />
          </button>
          
          <div className="w-full max-w-xs mt-2">
            <AudioLevelMeter stream={activeStream} />
          </div>
        </div>
      )}

      {/* Processing State */}
      {isDenoising && (
        <div className="flex flex-col items-center gap-4 w-full py-8">
          <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
          <span className="text-gray-400 font-medium">Đang khử ồn AI...</span>
        </div>
      )}

      {/* 4. Recorded & Ready to Review State */}
      {recordedDenoisedBlob && audioUrl && !isDenoising && (
        <div className="flex flex-col items-center gap-4 w-full animate-in fade-in duration-200">
          <DarkAudioPlayer audioUrl={audioUrl} rawAudioUrl={rawAudioUrl || undefined} />

          {/* Bottom Action Buttons */}
          <div className="flex items-center gap-3 w-full justify-end">
            <button
              type="button"
              onClick={resetRecording}
              className="px-4 py-2.5 rounded-xl text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 transition-colors flex items-center gap-2 font-medium text-sm border border-gray-700"
            >
              <RotateCcw className="w-4 h-4" />
              {t('practice.record_again')}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold flex items-center gap-2 hover:shadow-lg hover:shadow-indigo-500/25 transition-all hover:scale-[1.02] active:scale-95 text-sm"
            >
              <Send className="w-4 h-4" />
              {t('practice.submit_audio')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
