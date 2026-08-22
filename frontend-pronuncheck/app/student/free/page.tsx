'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import AuthGuard from '@/app/components/AuthGuard';
import Navbar from '@/app/components/Navbar';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useToast } from '@/app/contexts/ToastContext';
import AudioRecorder from '@/app/components/AudioRecorder';
import DarkAudioPlayer from '@/app/components/DarkAudioPlayer';
import PhonemeKaraokeVisualizer from '@/app/components/PhonemeKaraokeVisualizer';
import PhonemeDiagnosticCard, { CharScoreItem, WorstCharItem } from '@/app/components/PhonemeDiagnosticCard';
import ErrorBoundary from '@/app/components/ErrorBoundary';
import { startAiTimer, endAiTimer, captureAppError } from '@/app/lib/monitoring';
import { track } from '@vercel/analytics';
import { ArrowLeft, Sparkles, CheckCircle2, XCircle, RefreshCcw, Volume2, AlertTriangle } from 'lucide-react';
import { playGermanSpeech } from '@/app/lib/tts';

export default function FreeModePage() {
  const { t } = useLanguage();
  const { success, error: toastError } = useToast();
  const [word, setWord] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [isPlayingTts, setIsPlayingTts] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const handleTestTts = async () => {
    if (!word.trim()) {
      toastError(t('recorder.enter_word_first'));
      return;
    }
    setIsPlayingTts(true);
    try {
      await playGermanSpeech(word.trim(), 1.0);
    } catch (err) {
      console.error(err);
    } finally {
      setIsPlayingTts(false);
    }
  };

  const [result, setResult] = useState<{ 
    passed: boolean; 
    feedback: string;
    charScores?: CharScoreItem[];
    worstChar?: WorstCharItem;
    audioUrl?: string;
    scores?: {
      phoneme_score?: number;
      dtw_score?: number;
      whisper_score?: number;
      total_score?: number;
    }
  } | null>(null);

  // Playback sync for Karaoke
  const [karaokeCurrentTime, setKaraokeCurrentTime] = useState(0);
  const [karaokeDuration, setKaraokeDuration] = useState(0);
  const [isKaraokePlaying, setIsKaraokePlaying] = useState(false);

  const handleAudioReady = async (blob: Blob) => {
    if (!word.trim()) {
      toastError(t('recorder.enter_word_first'));
      return;
    }

    setLoading(true);
    setResult(null);
    setServerError(null);
    const startTime = startAiTimer('free-mode-assess');

    try {
      const localAudioUrl = URL.createObjectURL(blob);
      const formData = new FormData();
      const filename = blob instanceof File ? blob.name : 'recording.webm';
      formData.append('audio_file', blob, filename);
      formData.append('expected_word', word.trim());
      formData.append('target_phoneme', 'auto');

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.thuy-tien.pro';
      
      let res;
      let data;
      let attempt = 0;
      const maxAttempts = 3;

      while (attempt < maxAttempts) {
        try {
          res = await fetch(`${apiUrl}/api/v1/assess`, {
            method: 'POST',
            body: formData,
          });

          if (res.ok) {
            data = await res.json();
            break; 
          }

          if (res.status === 502 || res.status === 503) {
            attempt++;
            if (attempt >= maxAttempts) {
              setServerError('Máy chủ AI đang khởi động/bảo trì. Vui lòng chờ 10-15 giây và thử lại.');
              setLoading(false);
              return;
            }
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }

          throw new Error(`Máy chủ trả về mã lỗi ${res.status}`);
        } catch (fetchErr: any) {
          attempt++;
          if (attempt >= maxAttempts) {
            setServerError('Máy chủ AI đang khởi động/bảo trì. Vui lòng chờ 10-15 giây và thử lại.');
            setLoading(false);
            return;
          }
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      if (!data) return;
      const durationMs = endAiTimer(word.trim(), startTime, 'free-mode-assess');
      
      // Theo dõi số liệu Custom Event trên Vercel Analytics
      track('ai_assessment_completed', {
        mode: 'free',
        word: word.trim(),
        duration_ms: durationMs,
        is_passed: data.assessment?.is_passed ? 1 : 0,
      });

      const assessment = data.assessment;
      const charScores: CharScoreItem[] = data.char_scores || [];
      const worstChar: WorstCharItem | undefined = assessment.worst_char_detail || (charScores.length > 0 ? charScores.reduce((min, c) => c.score < min.score ? c : min, charScores[0]) : undefined);

      const phonemeScore = assessment.phoneme_score ?? assessment.precise_score ?? 0;
      const dtwScore = assessment.dtw_score ?? 0;
      const whisperScore = assessment.whisper_score ?? 0;
      const totalScore = assessment.total_score ?? assessment.hybrid_target_score ?? 0;

      setResult({
        passed: Boolean(assessment.is_passed),
        feedback: assessment.feedback || '',
        charScores,
        worstChar,
        audioUrl: localAudioUrl,
        scores: {
          phoneme_score: phonemeScore,
          dtw_score: dtwScore,
          whisper_score: whisperScore,
          total_score: totalScore,
        }
      });

      if (assessment.is_passed) {
        success('Đạt phát âm chuẩn! 🎉');
      } else {
        toastError('Chưa đạt. Hãy xem phân tích âm vị bên dưới nhé!');
      }

    } catch (error: any) {
      captureAppError(error, { word: word.trim(), mode: 'free' });
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
          <ErrorBoundary fallbackTitle="Lỗi trong quá trình luyện tập">
            <div className="bg-gray-800/90 border border-gray-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
              <div>
                <label className="block text-gray-300 mb-2 font-bold text-sm">
                  {t('practice.word_to_practice')}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={word}
                    onChange={(e) => setWord(e.target.value)}
                    placeholder={t('practice.word_placeholder')}
                    className="w-full bg-gray-900 border border-gray-700 rounded-2xl pl-4 pr-14 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:border-lime-400 focus:ring-1 focus:ring-lime-400 text-lg font-bold transition-all font-mono"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={handleTestTts}
                    disabled={isPlayingTts || !word.trim() || loading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-emerald-400 rounded-xl transition-all cursor-pointer shadow-sm"
                    title="Nghe phát âm mẫu"
                  >
                    <Volume2 className={`w-5 h-5 ${isPlayingTts ? 'animate-pulse text-emerald-300' : ''}`} />
                  </button>
                </div>
              </div>

              <div>
                <AudioRecorder onAudioReady={handleAudioReady} disabled={loading || !word.trim()} />
              </div>

              {serverError && !loading && (
                <div className="bg-orange-950/40 border border-orange-500/40 rounded-2xl p-5 flex items-start gap-3 animate-in fade-in">
                  <AlertTriangle className="w-6 h-6 text-orange-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-orange-400 text-base mb-1">Không thể kết nối Máy chủ AI</h4>
                    <p className="text-sm text-orange-200">{serverError}</p>
                  </div>
                </div>
              )}

              {loading && (
                <div className="space-y-4 pt-6 border-t border-gray-700/80 relative overflow-hidden">
                  {/* Animated overlay text */}
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gray-900/40 backdrop-blur-[2px] rounded-3xl">
                    <div className="flex items-center gap-3 bg-gray-900/90 px-6 py-3 rounded-full border border-indigo-500/30 shadow-xl shadow-indigo-500/20">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-indigo-500 border-t-transparent"></div>
                      <span className="text-sm font-bold text-indigo-400 animate-pulse">🤖 AI đang phân tích âm thanh...</span>
                    </div>
                  </div>
                  
                  {/* Shimmering Skeleton */}
                  <div className="relative z-0 space-y-4 opacity-50 animate-pulse">
                    <div className="h-32 bg-gray-800 rounded-3xl border border-gray-700/50"></div>
                    <div className="h-12 bg-gray-800 rounded-xl border border-gray-700/50"></div>
                    <div className="h-24 bg-gray-800 rounded-2xl border border-gray-700/50"></div>
                    <div className="h-32 bg-gray-800 rounded-3xl border border-gray-700/50"></div>
                  </div>
                </div>
              )}

              {/* Assessment Result & AI Visualizer Suite */}
              {result && !loading && (
                <div className="space-y-6 pt-4 border-t border-gray-700/80 animate-in fade-in duration-300">
                  {/* Result Status Card */}
                  <div className={`p-6 rounded-3xl text-center border space-y-4 ${
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

                    {/* Score Breakdown (Clean Integers 0 - 100) */}
                    {result.scores && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-gray-700/60 text-xs">
                        {result.scores.phoneme_score !== undefined && (
                          <div className="bg-gray-900/80 p-3 rounded-2xl border border-gray-800">
                            <span className="text-gray-400 block text-[10px] uppercase font-bold">{t('practice.score_phonetics')}</span>
                            <strong className="text-lime-400 font-mono text-xl font-black">
                              {Math.round(result.scores.phoneme_score <= 1.0 ? result.scores.phoneme_score * 100 : result.scores.phoneme_score)}
                            </strong>
                          </div>
                        )}
                        {result.scores.dtw_score !== undefined && (
                          <div className="bg-gray-900/80 p-3 rounded-2xl border border-gray-800">
                            <span className="text-gray-400 block text-[10px] uppercase font-bold">{t('practice.score_intonation')}</span>
                            <strong className="text-blue-400 font-mono text-xl font-black">
                              {Math.round(result.scores.dtw_score <= 1.0 ? result.scores.dtw_score * 100 : result.scores.dtw_score)}
                            </strong>
                          </div>
                        )}
                        {result.scores.whisper_score !== undefined && (
                          <div className="bg-gray-900/80 p-3 rounded-2xl border border-gray-800">
                            <span className="text-gray-400 block text-[10px] uppercase font-bold">{t('practice.score_completeness')}</span>
                            <strong className="text-purple-400 font-mono text-xl font-black">
                              {Math.round(result.scores.whisper_score <= 1.0 ? result.scores.whisper_score * 100 : result.scores.whisper_score)}
                            </strong>
                          </div>
                        )}
                        {result.scores.total_score !== undefined && (
                          <div className="bg-gray-900/80 p-3 rounded-2xl border border-gray-800">
                            <span className="text-gray-400 block text-[10px] uppercase font-bold">{t('practice.score_overall')}</span>
                            <strong className="text-yellow-400 font-mono text-xl font-black">
                              {Math.round(result.scores.total_score <= 1.0 ? result.scores.total_score * 100 : result.scores.total_score)}
                            </strong>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Dark Audio Player for Playback */}
                  {result.audioUrl && (
                    <DarkAudioPlayer
                      audioUrl={result.audioUrl}
                      onTimeUpdate={(cTime, dur) => {
                        setKaraokeCurrentTime(cTime);
                        setKaraokeDuration(dur);
                        setIsKaraokePlaying(true);
                      }}
                      onEnded={() => {
                        setIsKaraokePlaying(false);
                        setKaraokeCurrentTime(0);
                      }}
                    />
                  )}

                  {/* Word-Level Karaoke Visualizer */}
                  <PhonemeKaraokeVisualizer
                    expectedWord={word}
                    charScores={result.charScores}
                    currentTime={karaokeCurrentTime}
                    duration={karaokeDuration}
                    isPlaying={isKaraokePlaying}
                  />

                  {/* Character-Level Diagnostic Card */}
                  <PhonemeDiagnosticCard
                    worstChar={result.worstChar}
                    expectedWord={word}
                    feedback={result.feedback}
                    isPassed={result.passed}
                  />

                  <div className="text-center pt-2">
                    <button
                      onClick={() => {
                        setResult(null);
                        setKaraokeCurrentTime(0);
                      }}
                      className="inline-flex items-center gap-2 px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-white font-bold text-sm rounded-xl transition-colors cursor-pointer border border-gray-700"
                    >
                      <RefreshCcw className="w-4 h-4" />
                      <span>{t('practice.try_again')}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </ErrorBoundary>
        </div>
      </main>
    </AuthGuard>
  );
}
