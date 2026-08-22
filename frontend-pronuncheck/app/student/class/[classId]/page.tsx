'use client';

import React, { useState, use } from 'react';
import Link from 'next/link';
import AuthGuard from '@/app/components/AuthGuard';
import Navbar from '@/app/components/Navbar';
import { useAuth } from '@/app/contexts/AuthContext';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useToast } from '@/app/contexts/ToastContext';
import AudioRecorder from '@/app/components/AudioRecorder';
import DarkAudioPlayer from '@/app/components/DarkAudioPlayer';
import PhonemeKaraokeVisualizer from '@/app/components/PhonemeKaraokeVisualizer';
import PhonemeDiagnosticCard, { CharScoreItem, WorstCharItem } from '@/app/components/PhonemeDiagnosticCard';
import StudentProgressChart from '@/app/components/StudentProgressChart';
import ErrorBoundary from '@/app/components/ErrorBoundary';
import { startAiTimer, endAiTimer, captureAppError } from '@/app/lib/monitoring';
import { track } from '@vercel/analytics';
import { 
  createSubmission,
  joinClass,
  SubmissionData
} from '@/app/lib/firestore';
import { uploadAudio, uploadDualAudio } from '@/app/lib/storage';
import { getGoogleTtsUrl } from '@/app/lib/tts';
import { ArrowLeft, BookOpen, KeyRound, CheckCircle2, XCircle, ChevronDown, Volume2 } from 'lucide-react';
import { useClassData, useClassMembership, useStudentAssignmentsWithSubmissions } from '@/app/lib/hooks';

export default function StudentClassPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = use(params);
  const { user } = useAuth();
  const { t } = useLanguage();
  const { success, error: toastError } = useToast();
  
  // --- SWR Hooks for Parallel Data Fetching ---
  const { data: classData, error: classErrorRaw, mutate: mutateClass } = useClassData(classId);
  const { data: isMemberData, mutate: mutateMembership } = useClassMembership(classId, user?.uid || null);
  
  const isPublic = classData && !classData.password;
  const isMember = isMemberData || isPublic;
  
  const { data: assignments = [], mutate: mutateAssignments } = useStudentAssignmentsWithSubmissions(
    isMember ? classId : null,
    user?.uid || null
  );

  const loading = classData === undefined;
  const error = classErrorRaw ? 'Có lỗi xảy ra khi tải dữ liệu lớp học.' : null;
  
  // Password prompt state if not a member yet
  const [passwordInput, setPasswordInput] = useState('');
  const [joiningLoading, setJoiningLoading] = useState(false);

  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  // Latest Assessment Result for Active Assignment
  const [assessmentResult, setAssessmentResult] = useState<{
    passed: boolean;
    feedback: string;
    charScores?: CharScoreItem[];
    worstChar?: WorstCharItem;
    audioUrl?: string;
    rawAudioUrl?: string;
    scores?: {
      phoneme_score?: number;
      dtw_score?: number;
      whisper_score?: number;
      total_score?: number;
    };
  } | null>(null);

  // Playback sync for Karaoke
  const [karaokeCurrentTime, setKaraokeCurrentTime] = useState(0);
  const [karaokeDuration, setKaraokeDuration] = useState(0);
  const [isKaraokePlaying, setIsKaraokePlaying] = useState(false);

  // Selected Submission from History
  const [selectedHistorySub, setSelectedHistorySub] = useState<SubmissionData | null>(null);

  const handleVerifyPasswordAndJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !classData) return;
    setJoiningLoading(true);
    try {
      if (classData.password && classData.password !== passwordInput.trim()) {
        toastError(t('student.wrong_password'));
        return;
      }

      await joinClass(classId, user.uid, user.email || '');
      success(t('student.join_success'));
      setPasswordInput('');
      await Promise.all([mutateClass(), mutateMembership(), mutateAssignments()]);
    } catch (err: any) {
      console.error(err);
      toastError(err.message || 'Lỗi khi tham gia lớp học.');
    } finally {
      setJoiningLoading(false);
    }
  };

  const handleAudioReady = async (assignmentId: string, expectedWord: string, targetPhoneme: string, denoisedBlob: Blob, rawBlob?: Blob) => {
    if (!user || !classData) return;
    
    setSubmittingId(assignmentId);
    setAssessmentResult(null);
    setSelectedHistorySub(null);
    setServerError(null);
    const startTime = startAiTimer(`class-assess-${assignmentId}`);

    try {
      const assignment = assignments.find(a => a.id === assignmentId);
      const subs = assignment?.submissions || [];
      const maxAttempts = assignment?.maxAttempts || 1;

      if (subs.length >= maxAttempts) {
        toastError(t('practice.max_attempts_reached'));
        return;
      }

      // 1. Upload audio to Firebase Storage (Dual Storage)
      const { denoisedUrl, rawUrl } = await uploadDualAudio({
        classId,
        assignmentId,
        studentId: user.uid,
        denoisedBlob,
        rawBlob
      });

      // 2. Send to AI API
      const formData = new FormData();
      const filename = denoisedBlob instanceof File ? denoisedBlob.name : 'recording.webm';
      formData.append('audio_file', denoisedBlob, filename);
      formData.append('expected_word', expectedWord);
      formData.append('target_phoneme', targetPhoneme);

      // Prioritize Assignment-level scoring config, fallback to default standard config
      const effectiveConfig = assignment?.scoringConfig || {
        threshold: 0.6,
        passing_threshold: 0.6,
        mode: 'auto',
        L0: 4.5,
        k: 0.85
      };
      if (effectiveConfig) {
        const thresholdVal = effectiveConfig.threshold ?? effectiveConfig.passing_threshold;
        if (thresholdVal !== undefined) {
          formData.append('passing_threshold', thresholdVal.toString());
        }
        if (effectiveConfig.mode) {
          formData.append('mode', effectiveConfig.mode);
        }
        if (effectiveConfig.L0 !== undefined) {
          formData.append('L0', effectiveConfig.L0.toString());
        }
        if (effectiveConfig.k !== undefined) {
          formData.append('k', effectiveConfig.k.toString());
        }
        if (effectiveConfig.weights) {
          formData.append('weights', JSON.stringify(effectiveConfig.weights));
        }
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.thuy-tien.pro';
      
      let res;
      let data;
      let attempt = 0;
      const maxAttemptsFetch = 3;

      while (attempt < maxAttemptsFetch) {
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
            if (attempt >= maxAttemptsFetch) {
              setServerError('Máy chủ AI đang khởi động/bảo trì. Vui lòng chờ 10-15 giây và thử lại.');
              setSubmittingId(null);
              return;
            }
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }

          throw new Error(`Máy chủ chấm điểm AI trả về mã lỗi ${res.status}`);
        } catch (fetchErr: any) {
          attempt++;
          if (attempt >= maxAttemptsFetch) {
            setServerError('Máy chủ AI đang khởi động/bảo trì. Vui lòng chờ 10-15 giây và thử lại.');
            setSubmittingId(null);
            return;
          }
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      if (!data) return;
      const durationMs = endAiTimer(expectedWord, startTime, `class-assess-${assignmentId}`);

      // Theo dõi custom event trên Vercel Analytics
      track('class_assignment_assessed', {
        classId,
        assignmentId,
        word: expectedWord,
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

      // 3. Save submission to Firestore
      const newSubmissionData: Omit<SubmissionData, 'id' | 'createdAt'> = {
        assignmentId,
        studentId: user.uid,
        studentEmail: user.email || '',
        word: expectedWord,
        targetPhoneme,
        attemptNumber: subs.length + 1,
        audioUrl: denoisedUrl,
        rawAudioUrl: rawUrl,
        audioStoragePath: '', 
        isPassed: Boolean(assessment.is_passed),
        scores: {
          phoneme_score: phonemeScore,
          dtw_score: dtwScore,
          whisper_score: whisperScore,
          total_score: totalScore,
        },
        charScores,
        ...(worstChar ? { worstChar } : {}),
        feedback: assessment.feedback || '',
      };

      await createSubmission(classId, newSubmissionData);

      setAssessmentResult({
        passed: Boolean(assessment.is_passed),
        feedback: assessment.feedback || '',
        charScores,
        worstChar,
        audioUrl: denoisedUrl,
        rawAudioUrl: rawUrl,
        scores: {
          phoneme_score: phonemeScore,
          dtw_score: dtwScore,
          whisper_score: whisperScore,
          total_score: totalScore,
        }
      });

      if (assessment.is_passed) {
        success(t('practice.completed_congrats'));
      } else {
        toastError(t('practice.status_failed'));
      }

      // Reload assignments to refresh attempts count and history
      await mutateAssignments();

    } catch (err: any) {
      captureAppError(err, { classId, assignmentId, expectedWord });
      toastError(err.message || 'Có lỗi xảy ra khi nộp bài.');
    } finally {
      setSubmittingId(null);
    }
  };

  const skeletonUI = (
    <main className="min-h-screen bg-gray-900 text-white flex flex-col w-full max-w-full overflow-x-hidden">
      <Navbar currentRole="student" />
      <div className="flex-1 p-4 sm:p-6 md:p-8 max-w-4xl mx-auto w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-800/80 p-5 rounded-3xl border border-gray-700/80 animate-pulse">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-gray-700 rounded-xl" />
             <div className="space-y-2">
               <div className="h-6 bg-gray-700 rounded w-48" />
               <div className="h-3 bg-gray-700 rounded w-32" />
             </div>
          </div>
        </div>
        <div className="space-y-6">
          <div className="h-6 bg-gray-700 rounded w-40 mb-4 animate-pulse" />
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-gray-800/90 rounded-3xl p-5 sm:p-6 h-32 border border-gray-700/80 animate-pulse flex flex-col justify-between">
              <div className="space-y-2">
                <div className="h-6 bg-gray-700 rounded w-1/3" />
                <div className="h-4 bg-gray-700 rounded w-1/4" />
              </div>
              <div className="h-4 bg-gray-700 rounded w-20 self-end" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );

  if (loading) {
    return skeletonUI;
  }

  if (error || !classData) {
    return (
      <main className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
        <div className="bg-gray-800 p-8 rounded-3xl max-w-md w-full text-center border border-gray-700 space-y-4">
          <p className="text-red-400 text-base">{error || t('student.class_not_found')}</p>
          <Link 
            href="/student" 
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-xl text-white font-medium text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> {t('common.back')}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <AuthGuard allowedRole="student" fallback={skeletonUI}>
      <main className="min-h-screen bg-gray-900 text-white flex flex-col w-full max-w-full overflow-x-hidden">
        <Navbar currentRole="student" />

        <div className="flex-1 p-4 sm:p-6 md:p-8 max-w-4xl mx-auto w-full space-y-6">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-800/80 p-5 rounded-3xl border border-gray-700/80">
            <div className="flex items-center gap-3">
              <Link 
                href="/student"
                className="p-2 bg-gray-700/80 hover:bg-gray-700 text-gray-300 hover:text-white rounded-xl transition-colors cursor-pointer"
                title={t('common.back')}
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white truncate">
                  {classData.className || classData.name}
                </h1>
                <p className="text-xs text-gray-400 mt-0.5">
                  ID: <span className="font-mono text-lime-400">{classData.id}</span> • {classData.teacherEmail}
                </p>
              </div>
            </div>
          </div>

          {/* If NOT member yet: Show Password Verification Form */}
          {!isMember ? (
            <div className="bg-gray-800/90 border border-gray-700/80 rounded-3xl p-6 sm:p-8 max-w-md mx-auto text-center space-y-5 shadow-2xl">
              <div className="w-14 h-14 bg-blue-500/15 text-blue-400 rounded-2xl flex items-center justify-center mx-auto">
                <KeyRound className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Mật khẩu lớp học</h2>
                <p className="text-xs text-gray-400">Lớp học này được bảo vệ bằng mật khẩu. Vui lòng nhập mật khẩu để tham gia.</p>
              </div>

              <form onSubmit={handleVerifyPasswordAndJoin} className="space-y-4">
                <input
                  type="password"
                  required
                  value={passwordInput}
                  onChange={e => setPasswordInput(e.target.value)}
                  placeholder={t('student.class_password_placeholder')}
                  className="w-full bg-gray-900 border border-gray-700 rounded-2xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-400 text-sm text-center"
                />

                <button
                  type="submit"
                  disabled={joiningLoading}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl text-sm transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {joiningLoading ? t('common.processing') : t('student.join_submit')}
                </button>
              </form>
            </div>
          ) : (
            /* Member Mode: Render Assigned Exercises */
            <ErrorBoundary fallbackTitle="Lỗi hiển thị bài tập lớp">
              <div className="space-y-6">
                <h2 className="text-lg font-bold text-gray-200 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-lime-400" />
                  {t('practice.assignments_to_do')} ({assignments.length})
                </h2>

                {assignments.length === 0 ? (
                  <div className="bg-gray-800/60 rounded-3xl p-8 sm:p-12 text-center text-gray-400 border border-gray-700/70">
                    {t('practice.no_assignments')}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {assignments.map((assignment) => {
                      const remainingAttempts = Math.max(0, assignment.maxAttempts - assignment.attemptsUsed);
                      const isDeadlinePassed = assignment.deadline ? new Date() > assignment.deadline.toDate() : false;
                      const isMaxAttemptsReached = assignment.attemptsUsed >= assignment.maxAttempts;

                      let statusBadge = (
                        <span className="bg-yellow-900/40 text-yellow-400 px-3 py-1 rounded-full text-xs font-bold border border-yellow-500/30 whitespace-nowrap">
                          ⏳ {t('practice.status_pending')}
                        </span>
                      );

                      if (assignment.isPassed) {
                        statusBadge = (
                          <span className="bg-green-900/40 text-green-400 px-3 py-1 rounded-full text-xs font-bold border border-green-500/30 whitespace-nowrap flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> {t('practice.status_passed')}
                          </span>
                        );
                      } else if (assignment.attemptsUsed > 0 && !assignment.isPassed) {
                        statusBadge = (
                          <span className="bg-red-900/40 text-red-400 px-3 py-1 rounded-full text-xs font-bold border border-red-500/30 whitespace-nowrap flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" /> {t('practice.status_failed')}
                          </span>
                        );
                      }

                      const isOpen = activeAssignmentId === assignment.id;

                      // Determine active data to show (either from selected history or latest assessment)
                      const activeViewSub = selectedHistorySub?.assignmentId === assignment.id ? selectedHistorySub : null;
                      const displayCharScores = activeViewSub?.charScores || (assessmentResult && activeAssignmentId === assignment.id ? assessmentResult.charScores : undefined);
                      const displayWorstChar = activeViewSub?.worstChar || (assessmentResult && activeAssignmentId === assignment.id ? assessmentResult.worstChar : undefined);
                      const displayFeedback = activeViewSub?.feedback || (assessmentResult && activeAssignmentId === assignment.id ? assessmentResult.feedback : undefined);
                      const displayAudioUrl = activeViewSub?.audioUrl || (assessmentResult && activeAssignmentId === assignment.id ? assessmentResult.audioUrl : undefined);
                      const displayRawAudioUrl = activeViewSub?.rawAudioUrl || (assessmentResult && activeAssignmentId === assignment.id ? assessmentResult.rawAudioUrl : undefined);
                      const displayIsPassed = activeViewSub ? activeViewSub.isPassed : (assessmentResult && activeAssignmentId === assignment.id ? assessmentResult.passed : assignment.isPassed);

                      return (
                        <div 
                          key={assignment.id} 
                          className={`bg-gray-800/90 rounded-3xl p-5 sm:p-6 border transition-all duration-200 ${
                            isOpen ? 'border-lime-400/60 shadow-2xl shadow-lime-500/5' : 'border-gray-700/80 hover:border-gray-600'
                          }`}
                        >
                          <div 
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer select-none"
                            onClick={() => {
                              setActiveAssignmentId(isOpen ? null : (assignment.id || null));
                              if (!isOpen) {
                                setAssessmentResult(null);
                                setSelectedHistorySub(null);
                              }
                            }}
                          >
                            <div className="space-y-1">
                              {assignment.title ? (
                                <>
                                  <h3 className="text-xl sm:text-2xl font-extrabold text-white font-sans">{assignment.title}</h3>
                                  <p className="text-base font-sans text-lime-400 font-bold tracking-wide">{assignment.word}</p>
                                </>
                              ) : (
                                <h3 className="text-2xl font-bold text-white font-sans">{assignment.word}</h3>
                              )}
                              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-gray-400 pt-1">
                                <span className="bg-gray-900/80 px-2.5 py-1 rounded-lg border border-gray-700/60">
                                  {t('practice.target_phoneme')}: <strong className="text-lime-400">{assignment.targetPhoneme}</strong>
                                </span>
                                <span className="bg-gray-900/80 px-2.5 py-1 rounded-lg border border-gray-700/60">
                                  {t('practice.attempts_left')}: <strong className="text-white">{remainingAttempts}/{assignment.maxAttempts}</strong>
                                </span>
                                {assignment.deadline && (
                                  <span className="bg-gray-900/80 px-2.5 py-1 rounded-lg border border-gray-700/60">
                                    {t('practice.deadline')}: {assignment.deadline.toDate().toLocaleString('vi-VN')}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-700/60">
                              {statusBadge}
                              <div className={`p-1.5 rounded-lg bg-gray-900 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-lime-400' : ''}`}>
                                <ChevronDown className="w-4 h-4" />
                              </div>
                            </div>
                          </div>

                          {/* Dropdown Recording & History Area */}
                          {isOpen && (
                            <div className="mt-6 pt-6 border-t border-gray-700/80 space-y-6 animate-in fade-in duration-200">
                              {/* Reference Sample Audio Player (if enabled) */}
                              {assignment.enableSampleAudio && (
                                <div className="p-4 bg-emerald-950/30 rounded-2xl border border-emerald-500/30 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5 uppercase tracking-wide">
                                      <Volume2 className="w-4 h-4 text-emerald-400" />
                                      {assignment.sampleAudioType === 'teacher_record' 
                                        ? '🎧 Phát âm mẫu của Giáo viên:' 
                                        : '🎧 Phát âm mẫu chuẩn Google TTS (de-DE):'}
                                    </span>
                                    <span className="text-[11px] text-gray-400 hidden sm:inline">
                                      Nghe và luyện theo trước khi thu âm
                                    </span>
                                  </div>
                                  <DarkAudioPlayer 
                                    audioUrl={assignment.sampleAudioUrl || getGoogleTtsUrl(assignment.word)} 
                                  />
                                </div>
                              )}

                              {isDeadlinePassed ? (
                                <p className="text-sm text-red-400 font-bold text-center py-2">{t('practice.deadline_passed')}</p>
                              ) : isMaxAttemptsReached ? (
                                <p className="text-sm text-yellow-400 font-bold text-center py-2">{t('practice.max_attempts_reached')}</p>
                              ) : (
                                <div className="space-y-4">
                                  <AudioRecorder 
                                    onAudioReady={(denoisedBlob, rawBlob) => handleAudioReady(assignment.id || '', assignment.word, assignment.targetPhoneme, denoisedBlob, rawBlob)}
                                    disabled={submittingId === assignment.id}
                                  />
                                  
                                  {serverError && submittingId !== assignment.id && (
                                    <div className="bg-orange-950/40 border border-orange-500/40 rounded-2xl p-4 flex items-start gap-3 animate-in fade-in mt-4">
                                      <div className="mt-0.5 text-orange-400">⚠️</div>
                                      <div>
                                        <h4 className="font-bold text-orange-400 text-sm mb-1">Không thể kết nối Máy chủ AI</h4>
                                        <p className="text-xs text-orange-200">{serverError}</p>
                                      </div>
                                    </div>
                                  )}

                                  {submittingId === assignment.id && (
                                    <div className="space-y-4 pt-6 border-t border-gray-700/80 mt-4 relative overflow-hidden">
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
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Assessment Feedback & Diagnostics Area */}
                              {(activeViewSub || (assessmentResult && activeAssignmentId === assignment.id)) && (
                                <div className="space-y-6 pt-4 border-t border-gray-700/80">
                                  {/* Result Summary Card */}
                                  <div className={`p-5 rounded-2xl text-center border space-y-3 ${
                                    displayIsPassed 
                                      ? 'bg-green-950/40 border-green-500/40 text-green-100' 
                                      : 'bg-red-950/40 border-red-500/40 text-red-100'
                                  }`}>
                                    <div className="flex items-center justify-center gap-2">
                                      {displayIsPassed ? (
                                        <CheckCircle2 className="w-7 h-7 text-green-400" />
                                      ) : (
                                        <XCircle className="w-7 h-7 text-red-400" />
                                      )}
                                      <h4 className={`text-xl font-bold ${displayIsPassed ? 'text-green-400' : 'text-red-400'}`}>
                                        {displayIsPassed ? t('practice.status_passed') : t('practice.status_failed')}
                                      </h4>
                                    </div>

                                    {displayFeedback && (
                                      <p className="text-sm font-medium text-gray-200">{displayFeedback}</p>
                                    )}
                                  </div>

                                  {/* Playback Audio for this assignment */}
                                  {displayAudioUrl && (
                                    <DarkAudioPlayer
                                      audioUrl={displayAudioUrl}
                                      rawAudioUrl={displayRawAudioUrl}
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

                                  {/* AI Phonetic Karaoke Visualizer */}
                                  <PhonemeKaraokeVisualizer
                                    expectedWord={assignment.word}
                                    charScores={displayCharScores}
                                    currentTime={karaokeCurrentTime}
                                    duration={karaokeDuration}
                                    isPlaying={isKaraokePlaying}
                                  />
                                  
                                  {/* Character-Level Diagnostic Card */}
                                  <PhonemeDiagnosticCard
                                    worstChar={displayWorstChar}
                                    expectedWord={assignment.word}
                                    feedback={displayFeedback || ''}
                                    isPassed={displayIsPassed}
                                  />
                                </div>
                              )}

                              {/* Student Progress History Timeline with In-place Playback & Karaoke */}
                              {assignment.submissions && assignment.submissions.length > 0 && (
                                <div className="pt-4 border-t border-gray-700/80">
                                  <StudentProgressChart
                                    submissions={assignment.submissions}
                                    expectedWord={assignment.word}
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </ErrorBoundary>
          )}
        </div>
      </main>
    </AuthGuard>
  );
}
