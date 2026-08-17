'use client';

import React, { useState, useRef } from 'react';
import { Mic, Square, RotateCcw, Send, Upload } from 'lucide-react';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useToast } from '@/app/contexts/ToastContext';

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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      };

      recorder.start();
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
  };

  const handleSubmit = () => {
    if (recordedBlob) {
      onAudioReady(recordedBlob);
      resetRecording();
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-5 bg-gray-900/60 rounded-2xl border border-gray-700/80">
      {!isRecording && !recordedBlob && (
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            onClick={startRecording}
            disabled={disabled}
            className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold text-white shadow-lg transition-all cursor-pointer ${
              disabled
                ? 'bg-gray-700 cursor-not-allowed opacity-50'
                : 'bg-red-500 hover:bg-red-600 active:scale-95 shadow-red-500/20'
            }`}
          >
            <Mic className="w-5 h-5" /> {t('recorder.start')}
          </button>

          <span className="text-gray-400 font-medium text-xs sm:text-sm">{t('common.or')}</span>

          <label className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold text-white shadow-lg transition-all cursor-pointer ${
            disabled ? 'bg-gray-700 cursor-not-allowed opacity-50' : 'bg-blue-600 hover:bg-blue-500 active:scale-95 shadow-blue-500/20'
          }`}>
            <Upload className="w-5 h-5" /> {t('recorder.upload_file')}
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

      {isRecording && (
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 text-red-400 font-semibold animate-pulse text-sm">
            <span className="w-3 h-3 bg-red-500 rounded-full animate-ping"></span>
            {t('recorder.recording')}
          </div>
          <button
            type="button"
            onClick={stopRecording}
            className="flex items-center gap-2 px-6 py-3 rounded-full font-bold text-white bg-gray-800 hover:bg-gray-700 active:scale-95 transition-all border border-gray-600 shadow-xl cursor-pointer"
          >
            <Square className="w-4 h-4 text-red-400 fill-current" /> {t('recorder.stop')}
          </button>
        </div>
      )}

      {recordedBlob && audioUrl && (
        <div className="flex flex-col items-center gap-4 w-full">
          <audio src={audioUrl} controls className="w-full max-w-sm rounded-xl" />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={resetRecording}
              disabled={disabled}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" /> {t('recorder.re_record')}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={disabled}
              className="flex items-center gap-1.5 px-6 py-2.5 bg-lime-400 hover:bg-lime-300 text-gray-950 font-extrabold rounded-xl text-xs shadow-lg shadow-lime-500/20 transition-all active:scale-95 cursor-pointer"
            >
              <Send className="w-4 h-4" /> {t('recorder.submit_grade')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
