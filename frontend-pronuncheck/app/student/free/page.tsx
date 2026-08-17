'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import AuthGuard from '@/app/components/AuthGuard';
import Navbar from '@/app/components/Navbar';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useToast } from '@/app/contexts/ToastContext';
import AudioRecorder from '@/app/components/AudioRecorder';
import { ArrowLeft, Sparkles, CheckCircle2, XCircle, RefreshCcw } from 'lucide-react';

export default function FreeModePage() {
  const { t } = useLanguage();
  const { error: toastError } = useToast();
  const [word, setWord] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ 
    passed: boolean; 
    feedback: string;
    scores?: {
      phoneme_score?: number;
      dtw_score?: number;
      whisper_score?: number;
      total_score?: number;
    }
  } | null>(null);

  const handleAudioReady = async (blob: Blob) => {
    if (!word.trim()) {
      toastError(t('recorder.enter_word_first'));
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      const filename = blob instanceof File ? blob.name : 'recording.webm';
      formData.append('audio_file', blob, filename);
      formData.append('expected_word', word.trim());
      formData.append('target_phoneme', 'auto');

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.thuy-tien.pro';
      const res = await fetch(`${apiUrl}/api/v1/assess`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error('Lỗi khi chấm điểm từ máy chủ');
      }

      const data = await res.json();
      setResult({
        passed: data.assessment.is_passed,
        feedback: data.assessment.feedback,
        scores: data.scores
      });
    } catch (error: any) {
      console.error(error);
      toastError(error.message || 'Có lỗi xảy ra khi chấm điểm.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthGuard allowedRole="student">
      <main className="min-h-screen bg-gray-900 text-white flex flex-col w-full max-w-full overflow-x-hidden">
        <Navbar currentRole="student" />

        <div className="flex-1 p-4 sm:p-6 md:p-8 max-w-3xl mx-auto w-full space-y-6">
          {/* Header Action Bar */}
          <div className="flex items-center justify-between">
            <Link 
              href="/student"
              className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white bg-gray-800/80 hover:bg-gray-700 px-4 py-2 rounded-xl border border-gray-700 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('common.back')}
            </Link>
            <h1 className="text-xl font-bold text-lime-400 flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              {t('student.free_practice')}
            </h1>
          </div>

          {/* Form Card */}
          <div className="bg-gray-800/90 border border-gray-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div>
              <label className="block text-gray-300 mb-2 font-bold text-sm">
                {t('practice.word_to_practice')}
              </label>
              <input
                type="text"
                value={word}
                onChange={(e) => setWord(e.target.value)}
                placeholder={t('practice.word_placeholder')}
                className="w-full bg-gray-900 border border-gray-700 rounded-2xl px-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:border-lime-400 focus:ring-1 focus:ring-lime-400 text-lg font-bold transition-all"
                disabled={loading}
              />
            </div>

            <div>
              <AudioRecorder onAudioReady={handleAudioReady} disabled={loading || !word.trim()} />
            </div>

            {loading && (
              <div className="flex flex-col items-center justify-center p-8 space-y-3">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-lime-400"></div>
                <p className="text-lime-400 text-sm font-medium animate-pulse">{t('common.processing')}</p>
              </div>
            )}

            {/* Assessment Result Card */}
            {result && !loading && (
              <div className={`p-6 rounded-2xl text-center border animate-in fade-in duration-300 space-y-4 ${
                result.passed 
                  ? 'bg-green-950/40 border-green-500/40 text-green-100 shadow-xl shadow-green-500/10' 
                  : 'bg-red-950/40 border-red-500/40 text-red-100 shadow-xl shadow-red-500/10'
              }`}>
                <div className="flex items-center justify-center gap-2">
                  {result.passed ? (
                    <CheckCircle2 className="w-10 h-10 text-green-400" />
                  ) : (
                    <XCircle className="w-10 h-10 text-red-400" />
                  )}
                  <h3 className={`text-2xl font-black ${result.passed ? 'text-green-400' : 'text-red-400'}`}>
                    {result.passed ? t('practice.status_passed') : t('practice.status_failed')}
                  </h3>
                </div>

                <p className="text-base font-medium text-gray-200">{result.feedback}</p>

                {/* Score Breakdown if available */}
                {result.scores && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-gray-700/60 text-xs">
                    {result.scores.phoneme_score !== undefined && (
                      <div className="bg-gray-900/60 p-2.5 rounded-xl">
                        <span className="text-gray-400 block">{t('practice.score_precise')}</span>
                        <strong className="text-lime-400 text-sm font-bold">{(result.scores.phoneme_score * 100).toFixed(1)}%</strong>
                      </div>
                    )}
                    {result.scores.dtw_score !== undefined && (
                      <div className="bg-gray-900/60 p-2.5 rounded-xl">
                        <span className="text-gray-400 block">{t('practice.score_intonation')}</span>
                        <strong className="text-blue-400 text-sm font-bold">{(result.scores.dtw_score * 100).toFixed(1)}%</strong>
                      </div>
                    )}
                    {result.scores.whisper_score !== undefined && (
                      <div className="bg-gray-900/60 p-2.5 rounded-xl">
                        <span className="text-gray-400 block">{t('practice.score_whisper')}</span>
                        <strong className="text-purple-400 text-sm font-bold">{(result.scores.whisper_score * 100).toFixed(1)}%</strong>
                      </div>
                    )}
                    {result.scores.total_score !== undefined && (
                      <div className="bg-gray-900/60 p-2.5 rounded-xl">
                        <span className="text-gray-400 block">{t('practice.score_total')}</span>
                        <strong className="text-yellow-400 text-sm font-bold">{(result.scores.total_score * 100).toFixed(1)}%</strong>
                      </div>
                    )}
                  </div>
                )}
                
                <button
                  onClick={() => setResult(null)}
                  className="mt-2 inline-flex items-center gap-2 px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-white font-bold text-sm rounded-xl transition-colors cursor-pointer"
                >
                  <RefreshCcw className="w-4 h-4" />
                  {t('practice.try_again')}
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </AuthGuard>
  );
}
