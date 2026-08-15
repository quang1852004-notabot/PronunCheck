'use client';

import React, { useEffect, useState, use, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import AuthGuard from '@/app/components/AuthGuard';
import { useAuth } from '@/app/contexts/AuthContext';
import AudioRecorder from '@/app/components/AudioRecorder';
import { 
  getClass, 
  getAssignments, 
  getSubmissionsByStudent, 
  createSubmission,
  ClassData,
  AssignmentData,
  SubmissionData
} from '@/app/lib/firestore';
import { uploadAudio } from '@/app/lib/storage';

function ClassPageContent({ classId }: { classId: string }) {
  const searchParams = useSearchParams();
  const pwd = searchParams.get('pwd');

  const { user } = useAuth();
  
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [assignments, setAssignments] = useState<(AssignmentData & { 
    submissions: SubmissionData[];
    attemptsUsed: number;
    isPassed: boolean;
  })[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [assessmentResult, setAssessmentResult] = useState<{ passed: boolean; feedback: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    
    const loadClassData = async () => {
      try {
        const data = await getClass(classId);
        if (!data) {
          setError('Không tìm thấy lớp học này.');
          return;
        }

        if (data.password !== pwd) {
          setError('Mật khẩu lớp học không đúng.');
          return;
        }

        setClassData(data);

        // Load assignments
        const assignmentsData = await getAssignments(classId);
        
        // Load submissions for each assignment for this student
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
      } catch (err) {
        console.error(err);
        setError('Có lỗi xảy ra khi tải dữ liệu lớp học.');
      } finally {
        setLoading(false);
      }
    };

    loadClassData();
  }, [classId, pwd, user]);

  const handleAudioReady = async (assignmentId: string, expectedWord: string, targetPhoneme: string, blob: Blob) => {
    if (!user || !classData) return;
    
    setSubmittingId(assignmentId);
    setAssessmentResult(null);

    try {
      const formData = new FormData();
      formData.append('audio_file', blob, 'recording.webm');
      formData.append('expected_word', expectedWord);
      formData.append('target_phoneme', targetPhoneme);
      
      // Add scoring config
      formData.append('threshold', classData.scoringConfig.threshold.toString());
      formData.append('w1', classData.scoringConfig.w1.toString());
      formData.append('w2', classData.scoringConfig.w2.toString());

      const res = await fetch('http://127.0.0.1:8000/api/v1/assess', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error('Lỗi khi chấm điểm từ server.');
      }

      const data = await res.json();
      
      // Upload audio to storage
      const storagePath = await uploadAudio(classId, assignmentId, user.uid, blob);
      
      const assignment = assignments.find(a => a.id === assignmentId);
      const attemptNumber = (assignment?.attemptsUsed || 0) + 1;

      // Save submission to firestore
      await createSubmission(classId, {
        studentId: user.uid,
        studentEmail: user.email!,
        assignmentId,
        word: expectedWord,
        audioStoragePath: storagePath,
        detailedScore: {
          wav2vec_raw_score: data.wav2vec_raw_score || 0,
          whisper_raw_score: data.whisper_raw_score || 0,
          hybrid_target_score: data.hybrid_target_score || 0,
          is_passed: data.is_passed,
          feedback: data.feedback
        },
        isPassed: data.is_passed,
        attemptNumber
      });

      setAssessmentResult({
        passed: data.is_passed,
        feedback: data.feedback,
      });

      // Update local state
      setAssignments(prev => prev.map(a => {
        if (a.id === assignmentId) {
          return {
            ...a,
            attemptsUsed: attemptNumber,
            isPassed: a.isPassed || data.is_passed
          };
        }
        return a;
      }));

    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra khi chấm điểm hoặc lưu kết quả.');
    } finally {
      setSubmittingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-lime-400"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-6 flex flex-col items-center justify-center">
        <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl text-center max-w-md w-full border border-gray-700">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-red-400 mb-6">{error}</h2>
          <Link 
            href="/student"
            className="bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-xl font-medium transition-colors inline-block w-full"
          >
            Quay lại Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <header className="max-w-4xl mx-auto flex items-center justify-between mb-8 pb-4 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <Link 
            href="/student"
            className="text-gray-400 hover:text-white transition-colors flex items-center justify-center h-10 w-10 bg-gray-800 rounded-full"
          >
            ←
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-lime-400">{classData?.className}</h1>
            <p className="text-gray-400 text-sm">Giáo viên: {classData?.teacherEmail}</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto space-y-6">
        <h2 className="text-xl font-bold mb-4">Bài tập cần làm</h2>
        
        {assignments.length === 0 ? (
          <div className="bg-gray-800 rounded-2xl p-8 text-center text-gray-400 border border-gray-700">
            Lớp học chưa có bài tập nào.
          </div>
        ) : (
          assignments.map((assignment) => {
            const isDeadlinePassed = assignment.deadline ? assignment.deadline.toDate() < new Date() : false;
            const isMaxAttemptsReached = assignment.attemptsUsed >= assignment.maxAttempts;
            
            let statusBadge = null;
            if (assignment.isPassed) {
              statusBadge = <span className="bg-green-900/50 text-green-400 px-3 py-1 rounded-full text-sm font-medium border border-green-500/30">✅ Đạt</span>;
            } else if (assignment.attemptsUsed > 0 && !assignment.isPassed) {
              statusBadge = <span className="bg-red-900/50 text-red-400 px-3 py-1 rounded-full text-sm font-medium border border-red-500/30">❌ Chưa đạt</span>;
            } else {
              statusBadge = <span className="bg-yellow-900/50 text-yellow-400 px-3 py-1 rounded-full text-sm font-medium border border-yellow-500/30">⏳ Chưa làm</span>;
            }

            return (
              <div key={assignment.id} className="bg-gray-800 rounded-2xl p-6 shadow-xl border border-gray-700 transition-colors">
                <div 
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer"
                  onClick={() => {
                    setActiveAssignmentId(activeAssignmentId === assignment.id ? null : (assignment.id || null));
                    if (activeAssignmentId !== assignment.id) setAssessmentResult(null);
                  }}
                >
                  <div>
                    <h3 className="text-3xl font-bold text-white mb-2">{assignment.word}</h3>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
                      <span className="bg-gray-700 px-2 py-1 rounded-md">Âm mục tiêu: <strong className="text-lime-400">{assignment.targetPhoneme}</strong></span>
                      <span>Số lần: {assignment.attemptsUsed}/{assignment.maxAttempts}</span>
                      {assignment.deadline && (
                        <span>Hạn: {assignment.deadline.toDate().toLocaleString('vi-VN')}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-4">
                    {statusBadge}
                    <span className="text-gray-500 transform transition-transform" style={{ transform: activeAssignmentId === assignment.id ? 'rotate(180deg)' : 'rotate(0)' }}>
                      ▼
                    </span>
                  </div>
                </div>

                {activeAssignmentId === assignment.id && (
                  <div className="mt-6 pt-6 border-t border-gray-700">
                    {!assignment.isActive ? (
                      <p className="text-red-400">Bài tập đã bị khóa.</p>
                    ) : isDeadlinePassed ? (
                      <p className="text-red-400">Đã quá hạn nộp bài.</p>
                    ) : isMaxAttemptsReached && !assignment.isPassed ? (
                      <p className="text-red-400">Bạn đã hết số lần nộp bài.</p>
                    ) : assignment.isPassed ? (
                      <p className="text-green-400 font-medium">Bạn đã hoàn thành bài tập này! 🎉</p>
                    ) : (
                      <div className="max-w-md">
                        <AudioRecorder 
                          onAudioReady={(blob) => handleAudioReady(assignment.id!, assignment.word, assignment.targetPhoneme, blob)}
                          disabled={submittingId === assignment.id}
                        />
                      </div>
                    )}

                    {assessmentResult && submittingId === null && (
                      <div className={`mt-6 p-4 rounded-xl border max-w-md ${assessmentResult.passed ? 'bg-green-900/20 border-green-500/30' : 'bg-red-900/20 border-red-500/30'}`}>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-2xl">{assessmentResult.passed ? '✅' : '❌'}</span>
                          <span className={`font-bold ${assessmentResult.passed ? 'text-green-400' : 'text-red-400'}`}>
                            {assessmentResult.passed ? 'Đạt!' : 'Chưa đạt'}
                          </span>
                        </div>
                        <p className="text-gray-300 text-sm ml-9">{assessmentResult.feedback}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}

export default function ClassPage({ params }: { params: Promise<{ classId: string }> }) {
  const resolvedParams = use(params);
  
  return (
    <AuthGuard allowedRole="student">
      <Suspense fallback={
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-lime-400"></div>
        </div>
      }>
        <ClassPageContent classId={resolvedParams.classId} />
      </Suspense>
    </AuthGuard>
  );
}
