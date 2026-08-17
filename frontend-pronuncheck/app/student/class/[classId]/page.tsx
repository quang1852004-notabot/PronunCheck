'use client';

import React, { useEffect, useState, use, useCallback } from 'react';
import Link from 'next/link';
import AuthGuard from '@/app/components/AuthGuard';
import Navbar from '@/app/components/Navbar';
import { useAuth } from '@/app/contexts/AuthContext';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useToast } from '@/app/contexts/ToastContext';
import AudioRecorder from '@/app/components/AudioRecorder';
import { 
  getClass, 
  getAssignments, 
  getSubmissionsByStudent, 
  createSubmission,
  joinClass,
  isClassMember,
  ClassData,
  AssignmentData,
  SubmissionData
} from '@/app/lib/firestore';
import { uploadAudio } from '@/app/lib/storage';
import { ArrowLeft, BookOpen, KeyRound, CheckCircle2, XCircle, ChevronDown, Award } from 'lucide-react';

export default function StudentClassPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = use(params);
  const { user } = useAuth();
  const { t } = useLanguage();
  const { success, error: toastError } = useToast();
  
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [isMember, setIsMember] = useState<boolean>(false);
  const [assignments, setAssignments] = useState<(AssignmentData & { 
    submissions: SubmissionData[];
    attemptsUsed: number;
    isPassed: boolean;
  })[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Password prompt state if not a member yet
  const [passwordInput, setPasswordInput] = useState('');
  const [joiningLoading, setJoiningLoading] = useState(false);

  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [assessmentResult, setAssessmentResult] = useState<{ passed: boolean; feedback: string } | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getClass(classId);
      if (!data) {
        setError(t('student.class_not_found'));
        return;
      }
      setClassData(data);

      // Check if user is already a member or class is open
      const hasJoined = await isClassMember(classId, user.uid);
      const isPublic = !data.password;

      if (hasJoined || isPublic) {
        setIsMember(true);
        if (!hasJoined && isPublic) {
          await joinClass(classId, user.uid, user.email || '');
        }

        // Load assignments & submissions
        const assignmentsData = await getAssignments(classId);
        const assignmentsWithSubmissions = await Promise.all(
          assignmentsData.map(async (assign) => {
            const subs = await getSubmissionsByStudent(classId, user.uid, assign.id!);
            const isPassed = subs.some(s => s.isPassed);
            return {
              ...assign,
              submissions: subs,
              attemptsUsed: subs.length,
              isPassed
            };
          })
        );
        setAssignments(assignmentsWithSubmissions);
      } else {
        setIsMember(false);
      }
    } catch (err: any) {
      console.error(err);
      setError('Có lỗi xảy ra khi tải dữ liệu lớp học.');
    } finally {
      setLoading(false);
    }
  }, [classId, user, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
      await loadData();
    } catch (err: any) {
      console.error(err);
      toastError(err.message || 'Lỗi khi tham gia lớp học.');
    } finally {
      setJoiningLoading(false);
    }
  };

  const handleAudioReady = async (assignmentId: string, expectedWord: string, targetPhoneme: string, blob: Blob) => {
    if (!user || !classData) return;
    
    setSubmittingId(assignmentId);
    setAssessmentResult(null);

    try {
      const subs = await getSubmissionsByStudent(classId, user.uid, assignmentId);
      const assignment = assignments.find(a => a.id === assignmentId);
      const maxAttempts = assignment?.maxAttempts || 1;

      if (subs.length >= maxAttempts) {
        toastError(t('practice.max_attempts_reached'));
        return;
      }

      // 1. Upload audio to Firebase Storage
      const audioUrl = await uploadAudio(blob, classId, user.uid, assignmentId);

      // 2. Send to AI API
      const formData = new FormData();
      const filename = blob instanceof File ? blob.name : 'recording.webm';
      formData.append('audio_file', blob, filename);
      formData.append('expected_word', expectedWord);
      formData.append('target_phoneme', targetPhoneme);

      if (classData.scoringConfig) {
        if (classData.scoringConfig.passing_threshold) {
          formData.append('passing_threshold', classData.scoringConfig.passing_threshold.toString());
        }
        if (classData.scoringConfig.weights) {
          formData.append('weights', JSON.stringify(classData.scoringConfig.weights));
        }
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.thuy-tien.pro';
      const res = await fetch(`${apiUrl}/api/v1/assess`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error('Lỗi khi chấm điểm từ máy chủ.');
      }

      const data = await res.json();
      const assessment = data.assessment;

      // 3. Save submission to Firestore
      const newSubmissionData: Omit<SubmissionData, 'id' | 'createdAt'> = {
        assignmentId,
        studentId: user.uid,
        studentEmail: user.email || '',
        word: expectedWord,
        targetPhoneme,
        attemptNumber: subs.length + 1,
        audioUrl,
        isPassed: assessment.is_passed,
        scores: {
          phoneme_score: assessment.phoneme_score,
          dtw_score: assessment.dtw_score,
          whisper_score: assessment.whisper_score,
          total_score: assessment.total_score,
        },
        feedback: assessment.feedback,
      };

      await createSubmission(classId, newSubmissionData);

      setAssessmentResult({
        passed: assessment.is_passed,
        feedback: assessment.feedback,
      });

      if (assessment.is_passed) {
        success('Chúc mừng! Bạn đã đạt bài tập này 🎉');
      } else {
        toastError('Chưa đạt. Hãy nghe lại và thử lại nhé!');
      }

      // Reload assignments to refresh attempts count
      await loadData();

    } catch (err: any) {
      console.error(err);
      toastError(err.message || 'Có lỗi xảy ra khi nộp bài.');
    } finally {
      setSubmittingId(null);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-lime-400"></div>
      </main>
    );
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
    <AuthGuard allowedRole="student">
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
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-200 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-lime-400" />
                {t('practice.assignments_to_do')} ({assignments.length})
              </h2>

              {assignments.length === 0 ? (
                <div className="bg-gray-800/60 rounded-3xl p-8 sm:p-12 text-center text-gray-400 border border-gray-700/70">
                  {t('practice.no_assignments')}
                </div>
              ) : (
                <div className="space-y-4">
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

                    return (
                      <div 
                        key={assignment.id} 
                        className={`bg-gray-800/90 rounded-3xl p-5 sm:p-6 border transition-all duration-200 ${
                          isOpen ? 'border-lime-400/60 shadow-xl shadow-lime-500/5' : 'border-gray-700/80 hover:border-gray-600'
                        }`}
                      >
                        <div 
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer select-none"
                          onClick={() => {
                            setActiveAssignmentId(isOpen ? null : (assignment.id || null));
                            if (!isOpen) setAssessmentResult(null);
                          }}
                        >
                          <div className="space-y-1">
                            {assignment.title ? (
                              <>
                                <h3 className="text-xl sm:text-2xl font-extrabold text-white">{assignment.title}</h3>
                                <p className="text-base font-mono text-lime-400 font-bold">{assignment.word}</p>
                              </>
                            ) : (
                              <h3 className="text-2xl font-bold text-white font-mono">{assignment.word}</h3>
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

                        {/* Dropdown Recording Area */}
                        {isOpen && (
                          <div className="mt-6 pt-6 border-t border-gray-700/80 space-y-4 animate-in fade-in duration-200">
                            {!assignment.isActive ? (
                              <div className="p-4 bg-red-950/30 border border-red-500/30 text-red-400 rounded-2xl text-sm font-medium">
                                {t('practice.assignment_locked')}
                              </div>
                            ) : isDeadlinePassed ? (
                              <div className="p-4 bg-red-950/30 border border-red-500/30 text-red-400 rounded-2xl text-sm font-medium">
                                {t('practice.deadline_passed')}
                              </div>
                            ) : isMaxAttemptsReached && !assignment.isPassed ? (
                              <div className="p-4 bg-red-950/30 border border-red-500/30 text-red-400 rounded-2xl text-sm font-medium">
                                {t('practice.max_attempts_reached')}
                              </div>
                            ) : assignment.isPassed ? (
                              <div className="p-4 bg-green-950/30 border border-green-500/30 text-green-400 rounded-2xl text-sm font-bold flex items-center gap-2">
                                <Award className="w-5 h-5 text-yellow-400" />
                                {t('practice.completed_congrats')}
                              </div>
                            ) : (
                              <div className="max-w-md">
                                <AudioRecorder 
                                  onAudioReady={(blob) => handleAudioReady(assignment.id!, assignment.word, assignment.targetPhoneme, blob)}
                                  disabled={submittingId === assignment.id}
                                />
                              </div>
                            )}

                            {submittingId === assignment.id && (
                              <div className="flex items-center gap-3 text-lime-400 text-sm font-medium animate-pulse py-2">
                                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-lime-400"></div>
                                {t('common.processing')}
                              </div>
                            )}

                            {assessmentResult && !submittingId && (
                              <div className={`p-5 rounded-2xl border text-center space-y-2 ${
                                assessmentResult.passed 
                                  ? 'bg-green-950/40 border-green-500/40 text-green-100' 
                                  : 'bg-red-950/40 border-red-500/40 text-red-100'
                              }`}>
                                <h4 className="text-xl font-bold">
                                  {assessmentResult.passed ? `✅ ${t('practice.status_passed')}` : `❌ ${t('practice.status_failed')}`}
                                </h4>
                                <p className="text-sm">{assessmentResult.feedback}</p>
                              </div>
                            )}

                            {/* Submissions History */}
                            {assignment.submissions && assignment.submissions.length > 0 && (
                              <div className="space-y-2 pt-3 border-t border-gray-700/60">
                                <h4 className="text-xs font-bold text-gray-400">Lịch sử bài nộp ({assignment.submissions.length}):</h4>
                                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 text-xs">
                                  {assignment.submissions.map((sub, idx) => (
                                    <div 
                                      key={sub.id || idx} 
                                      className="flex items-center justify-between p-2.5 bg-gray-900/60 rounded-xl border border-gray-700/60"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="font-mono text-gray-400">#{sub.attemptNumber || idx + 1}</span>
                                        <span className={sub.isPassed ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                                          {sub.isPassed ? t('practice.status_passed') : t('practice.status_failed')}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        {sub.scores?.total_score !== undefined && (
                                          <span className="text-gray-300 font-bold">
                                            {(sub.scores.total_score * 100).toFixed(1)}%
                                          </span>
                                        )}
                                        {sub.audioUrl && (
                                          <audio src={sub.audioUrl} controls className="h-7 w-36 sm:w-44" />
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
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
          )}
        </div>
      </main>
    </AuthGuard>
  );
}
