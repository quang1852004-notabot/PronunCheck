'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import AuthGuard from '@/app/components/AuthGuard';
import { useAuth } from '@/app/contexts/AuthContext';
import AudioRecorder from '@/app/components/AudioRecorder';

export default function FreeModePage() {
  const { user, logout } = useAuth();
  const [word, setWord] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ passed: boolean; feedback: string } | null>(null);

  const handleAudioReady = async (blob: Blob) => {
    if (!word.trim()) {
      alert('Vui lòng nhập từ muốn luyện tập trước khi ghi âm!');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('audio_file', blob, 'recording.webm');
      formData.append('expected_word', word.trim());
      formData.append('target_phoneme', 'auto');

      const res = await fetch('http://127.0.0.1:8000/api/v1/assess', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error('Lỗi khi chấm điểm');
      }

      const data = await res.json();
      setResult({
        passed: data.is_passed,
        feedback: data.feedback,
      });
    } catch (error) {
      console.error(error);
      alert('Có lỗi xảy ra khi chấm điểm. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthGuard allowedRole="student">
      <div className="min-h-screen bg-gray-900 text-white p-6">
        <header className="max-w-2xl mx-auto flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <Link 
              href="/student"
              className="text-gray-400 hover:text-white transition-colors"
            >
              ← Quay lại
            </Link>
            <h1 className="text-xl font-bold text-lime-400">Free Mode</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-300 text-sm hidden sm:inline">{user?.email}</span>
            <button 
              onClick={logout}
              className="bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            >
              Đăng xuất
            </button>
          </div>
        </header>

        <main className="max-w-2xl mx-auto bg-gray-800 rounded-2xl p-6 md:p-8 shadow-2xl border border-gray-700">
          <div className="mb-8">
            <label className="block text-gray-400 mb-2 font-medium">Từ muốn luyện tập</label>
            <input
              type="text"
              value={word}
              onChange={(e) => setWord(e.target.value)}
              placeholder="Nhập từ muốn luyện, VD: Schule"
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-lime-400 focus:ring-1 focus:ring-lime-400 text-lg font-bold"
              disabled={loading}
            />
          </div>

          <div className="mb-8">
            <AudioRecorder onAudioReady={handleAudioReady} disabled={loading || !word.trim()} />
          </div>

          {result && (
            <div className={`mt-8 p-6 rounded-2xl text-center border ${result.passed ? 'bg-green-900/20 border-green-500/30' : 'bg-red-900/20 border-red-500/30'}`}>
              <div className="text-6xl mb-4">
                {result.passed ? '✅' : '❌'}
              </div>
              <h3 className={`text-2xl font-bold mb-2 ${result.passed ? 'text-green-400' : 'text-red-400'}`}>
                {result.passed ? 'Đạt!' : 'Chưa đạt'}
              </h3>
              <p className="text-gray-300 text-lg">{result.feedback}</p>
              
              <button
                onClick={() => setResult(null)}
                className="mt-6 px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-xl text-white font-medium transition-colors"
              >
                Thử lại
              </button>
            </div>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
