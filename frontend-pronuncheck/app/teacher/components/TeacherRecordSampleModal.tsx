'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, RotateCcw, Check, X, Volume2, Timer, Sparkles } from 'lucide-react';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useToast } from '@/app/contexts/ToastContext';
import AudioLevelMeter from '@/app/components/AudioLevelMeter';
import DarkAudioPlayer from '@/app/components/DarkAudioPlayer';

interface TeacherRecordSampleModalProps {
  isOpen: boolean;
  targetWord: string;
  onClose: () => void;
  onApply: (blob: Blob, previewUrl: string) => void;
}

export default function TeacherRecordSampleModal({
  isOpen,
  targetWord,
  onClose,
  onApply
}: TeacherRecordSampleModalProps) {
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
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Timer
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
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isRecording]);

  // Clean up streams when modal closes
  useEffect(() => {
    if (!isOpen) {
      stopAllStreams();
      setRecordedBlob(null);
      setAudioUrl(null);
      setIsRecording(false);
    }
  }, [isOpen]);

  const stopAllStreams = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setActiveStream(null);
  };

  const startRecording = async () => {
    try {
      setRecordedBlob(null);
      setAudioUrl(null);
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      streamRef.current = stream;
      setActiveStream(stream);

      // Choose mime type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stopAllStreams();
      };

      mediaRecorder.start(100);
      setIsRecording(true);
    } catch (err: any) {
      console.error(err);
      toastError(t('recorder.mic_permission_error'));
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleApply = () => {
    if (recordedBlob && audioUrl) {
      onApply(recordedBlob, audioUrl);
      onClose();
    }
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 text-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6 relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-lime-500/20 text-lime-400 flex items-center justify-center border border-lime-500/30">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Thu âm phát âm mẫu</h3>
              <p className="text-xs text-gray-400">Ghi lại giọng đọc chuẩn cho học sinh nghe</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Target Word Display */}
        <div className="bg-gray-950/80 p-4 rounded-2xl border border-gray-800 text-center space-y-1">
          <span className="text-[11px] text-gray-500 font-bold uppercase tracking-wider block">
            Từ / Câu cần đọc
          </span>
          <p className="text-lg sm:text-xl font-black text-lime-400 font-sans tracking-wide">
            {targetWord || 'Chưa nhập từ/câu'}
          </p>
        </div>

        {/* Recording State & Meter */}
        <div className="space-y-4">
          {/* Audio Level Meter while recording */}
          {isRecording && activeStream && (
            <div className="bg-gray-950 p-4 rounded-2xl border border-gray-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span className="flex items-center gap-1.5 text-lime-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                  Đang ghi âm giọng giáo viên...
                </span>
                <span className="font-mono text-white font-bold flex items-center gap-1">
                  <Timer className="w-3.5 h-3.5 text-lime-400" />
                  {formatTimer(recordingSeconds)}
                </span>
              </div>
              <AudioLevelMeter stream={activeStream} isRecording={isRecording} />
            </div>
          )}

          {/* Player after recording */}
          {!isRecording && audioUrl && (
            <div className="space-y-2">
              <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-lime-400" />
                Nghe lại bản thu mẫu của bạn:
              </span>
              <DarkAudioPlayer audioUrl={audioUrl} />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-3 pt-2">
            {!isRecording && !recordedBlob && (
              <button
                type="button"
                onClick={startRecording}
                className="w-full py-3.5 px-6 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold rounded-2xl shadow-xl shadow-red-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 text-sm"
              >
                <Mic className="w-5 h-5" />
                <span>Bắt đầu thu âm</span>
              </button>
            )}

            {isRecording && (
              <button
                type="button"
                onClick={stopRecording}
                className="w-full py-3.5 px-6 bg-yellow-500 hover:bg-yellow-400 text-gray-950 font-black rounded-2xl shadow-xl shadow-yellow-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 text-sm animate-pulse"
              >
                <Square className="w-5 h-5 fill-current" />
                <span>Hoàn tất ghi âm ({formatTimer(recordingSeconds)})</span>
              </button>
            )}

            {!isRecording && recordedBlob && (
              <div className="flex items-center gap-3 w-full">
                <button
                  type="button"
                  onClick={startRecording}
                  className="flex-1 py-3 px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-2xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Thu âm lại</span>
                </button>

                <button
                  type="button"
                  onClick={handleApply}
                  className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl text-xs sm:text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>Áp dụng audio này</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
