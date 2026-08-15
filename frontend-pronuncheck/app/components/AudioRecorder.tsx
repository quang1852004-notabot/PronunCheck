'use client';

import React, { useState, useRef } from 'react';
import { Mic, Square, Play, RotateCcw, Send, Upload } from 'lucide-react';

interface AudioRecorderProps {
  onAudioReady: (blob: Blob) => void;
  disabled?: boolean;
}

export default function AudioRecorder({ onAudioReady, disabled = false }: AudioRecorderProps) {
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
        alert('File quá lớn. Vui lòng chọn file nhỏ hơn 10MB.');
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
      
      // Xác định định dạng hỗ trợ tốt nhất cho trình duyệt (Chrome vs Safari/iOS)
      let options = {};
      let mimeType = '';
      if (typeof MediaRecorder.isTypeSupported === 'function') {
        const types = ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/aac'];
        for (const t of types) {
          if (MediaRecorder.isTypeSupported(t)) {
            options = { mimeType: t };
            mimeType = t;
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
        // Sử dụng đúng mimeType đã record thay vì hardcode audio/webm
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
      alert('Không thể truy cập Microphone. Vui lòng cấp quyền micro cho trình duyệt.');
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
    <div className="flex flex-col items-center gap-4 p-4 bg-gray-800 rounded-xl border border-gray-700">
      {!isRecording && !recordedBlob && (
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <button
            type="button"
            onClick={startRecording}
            disabled={disabled}
            className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold text-white shadow-lg transition-all ${
              disabled
                ? 'bg-gray-600 cursor-not-allowed opacity-50'
                : 'bg-red-500 hover:bg-red-600 hover:scale-105'
            }`}
          >
            <Mic className="w-5 h-5" /> Bắt đầu ghi âm
          </button>

          <span className="text-gray-400 font-medium">hoặc</span>

          <label className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold text-white shadow-lg transition-all cursor-pointer ${
            disabled ? 'bg-gray-600 cursor-not-allowed opacity-50' : 'bg-blue-500 hover:bg-blue-600 hover:scale-105'
          }`}>
            <Upload className="w-5 h-5" /> Tải file lên
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
          <div className="flex items-center gap-2 text-red-400 font-semibold animate-pulse">
            <span className="w-3 h-3 bg-red-500 rounded-full animate-ping"></span>
            Đang ghi âm...
          </div>
          <button
            type="button"
            onClick={stopRecording}
            className="flex items-center gap-2 px-6 py-3 rounded-full font-bold text-white bg-gray-700 hover:bg-gray-600 transition-all border border-gray-600"
          >
            <Square className="w-5 h-5 text-red-400 fill-current" /> Dừng ghi âm
          </button>
        </div>
      )}

      {recordedBlob && audioUrl && (
        <div className="flex flex-col items-center gap-4 w-full">
          <audio src={audioUrl} controls className="w-full max-w-sm rounded-lg" />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={resetRecording}
              disabled={disabled}
              className="flex items-center gap-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
            >
              <RotateCcw className="w-4 h-4" /> Ghi âm lại
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={disabled}
              className="flex items-center gap-1 px-6 py-2 bg-lime-500 hover:bg-lime-600 text-gray-900 font-bold rounded-lg text-sm shadow-md transition-colors"
            >
              <Send className="w-4 h-4" /> Chấm điểm ngay
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
