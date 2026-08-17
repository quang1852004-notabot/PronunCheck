'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, RotateCcw, Send, Upload, Timer } from 'lucide-react';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useToast } from '@/app/contexts/ToastContext';
import AudioLevelMeter from '@/app/components/AudioLevelMeter';
import DarkAudioPlayer from '@/app/components/DarkAudioPlayer';

interface AudioRecorderProps {
  onAudioReady: (blob: Blob) => void;
  disabled?: boolean;
}

export default function AudioRecorder({ onAudioReady, disabled = false }: AudioRecorderProps) {
  const { t } = useLanguage();
  const { error: toastError } = useToast();
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
      setRecordedBlob(file);
      setAudioUrl(URL.createObjectURL(file));
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setActiveStream(stream);
      
      // Determine optimal mimeType for recording
      let options = {};
      let mimeType = '';
      if (typeof MediaRecorder.isTypeSupported === 'function') {
        const types = ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/aac'];
        for (const tType of types) {
          if (MediaRecorder.isTypeSupported(tType)) {
            options = { mimeType: tType };
            mimeType = tType;
            break;
          }
        }
      }

      const recorder = new MediaRecorder(stream, options);
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
      };

      recorder.start(100);
      setIsRecording(true);
      setRecordedBlob(null);
      setAudioUrl(null);
    } catch (err) {
      console.error(err);
      toastError(t('recorder.mic_permission_error'));
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
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
      {/* Initial Buttons */}
      {!isRecording && !recordedBlob && (
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

          <span className="text-gray-400 font-medium text-xs sm:text-sm">{t('common.or')}</span>

          <label className={`flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-white shadow-xl transition-all cursor-pointer ${
            disabled ? 'bg-gray-700 cursor-not-allowed opacity-50' : 'bg-gray-800 hover:bg-gray-700 border border-gray-600 active:scale-95'
          }`}>
            <Upload className="w-5 h-5 text-blue-400" />
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
      )}

      {/* Recording in Progress State */}
      {isRecording && (
        <div className="flex flex-col items-center gap-4 w-full animate-in fade-in duration-200">
          {/* Header Recording Badge & Timer */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-red-400 font-bold bg-red-500/15 px-3 py-1 rounded-full border border-red-500/30 text-xs">
              <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping"></span>
              <span>{t('recorder.recording')}</span>
            </div>

            <div className="flex items-center gap-1.5 font-mono text-base font-extrabold text-white bg-gray-950 px-3.5 py-1 rounded-full border border-gray-800 shadow-inner">
              <Timer className="w-4 h-4 text-lime-400" />
              <span>{formatTimer(recordingSeconds)}</span>
            </div>
          </div>

          {/* Real-time Audio Level Meter */}
          <AudioLevelMeter stream={activeStream} isRecording={isRecording} />

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

      {/* Recorded & Ready to Review State */}
      {recordedBlob && audioUrl && (
        <div className="flex flex-col items-center gap-4 w-full animate-in fade-in duration-200">
          {/* Custom Dark Mode Audio Player */}
          <DarkAudioPlayer audioUrl={audioUrl} />

          {/* Bottom Action Buttons */}
          <div className="flex items-center gap-3 w-full justify-end">
            <button
              type="button"
              onClick={resetRecording}
              disabled={disabled}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-gray-700"
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
