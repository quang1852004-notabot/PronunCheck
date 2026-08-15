'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import AuthGuard from '@/app/components/AuthGuard';
import { getClass, getAssignments, getSubmissions, ClassData, AssignmentData, SubmissionData } from '@/app/lib/firestore';
import { useParams, useRouter } from 'next/navigation';
import AssignmentForm from '@/app/teacher/components/AssignmentForm';
import ScoringConfigComponent from '@/app/teacher/components/ScoringConfig';
import SubmissionTable from '@/app/teacher/components/SubmissionTable';

export default function ClassDetail() {
  const params = useParams();
  const classId = params.classId as string;
  const router = useRouter();

  const [classData, setClassData] = useState<ClassData | null>(null);
  const [assignments, setAssignments] = useState<AssignmentData[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'assignments' | 'config' | 'submissions'>('assignments');

  const loadData = async () => {
    setLoading(true);
    const data = await getClass(classId);
    if (data) {
      setClassData(data);
      const asgns = await getAssignments(classId);
      setAssignments(asgns);
      const subs = await getSubmissions(classId);
      setSubmissions(subs);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (classId) {
      loadData();
    }
  }, [classId]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Đã copy: ' + text);
  };

  return (
    <AuthGuard allowedRole="teacher">
      <div className="min-h-screen bg-gray-900 text-gray-100 p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div className="bg-gray-800 p-6 rounded-2xl shadow-2xl flex items-center justify-between border border-gray-700">
            <div className="flex items-center space-x-6">
              <button
                onClick={() => router.push('/teacher')}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {classData ? classData.className : 'Đang tải...'}
                </h1>
                <div className="flex items-center space-x-2 mt-2">
                  <span className="text-gray-400 text-sm">Class ID:</span>
                  <code className="bg-gray-900 px-2 py-1 rounded text-blue-400 font-mono text-sm">
                    {classId}
                  </code>
                  <button
                    onClick={() => copyToClipboard(classId)}
                    className="text-gray-500 hover:text-blue-400 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex space-x-2 border-b border-gray-700">
            <button
              onClick={() => setActiveTab('assignments')}
              className={`px-6 py-3 font-medium transition-colors border-b-2 ${
                activeTab === 'assignments'
                  ? 'border-blue-400 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              Bài tập
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={`px-6 py-3 font-medium transition-colors border-b-2 ${
                activeTab === 'config'
                  ? 'border-blue-400 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              Cấu hình chấm điểm
            </button>
            <button
              onClick={() => setActiveTab('submissions')}
              className={`px-6 py-3 font-medium transition-colors border-b-2 ${
                activeTab === 'submissions'
                  ? 'border-blue-400 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              Kết quả học sinh
            </button>
          </div>

          {/* Content */}
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-400 mx-auto"></div>
            </div>
          ) : (
            <div className="bg-gray-800 p-6 rounded-2xl shadow-2xl border border-gray-700">
              {activeTab === 'assignments' && (
                <div className="space-y-8">
                  <AssignmentForm classId={classId} onCreated={loadData} />
                  
                  <div>
                    <h3 className="text-xl font-bold mb-4">Danh sách bài tập</h3>
                    <div className="grid gap-4">
                      {assignments.map(a => (
                        <div key={a.id} className="bg-gray-900 p-4 rounded-xl border border-gray-700 flex justify-between items-center">
                          <div>
                            <h4 className="text-lg font-bold text-blue-400">{a.word}</h4>
                            <p className="text-sm text-gray-400 mt-1">Phoneme: <code className="text-gray-200">{a.targetPhoneme}</code></p>
                            <p className="text-sm text-gray-400">Số lần thử: {a.maxAttempts}</p>
                            {a.deadline && (
                              <p className="text-sm text-gray-400">Hạn chót: {a.deadline.toDate().toLocaleString('vi-VN')}</p>
                            )}
                          </div>
                          <div>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${a.isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                              {a.isActive ? 'Đang mở' : 'Đã đóng'}
                            </span>
                          </div>
                        </div>
                      ))}
                      {assignments.length === 0 && (
                        <p className="text-gray-500 text-center py-4">Chưa có bài tập nào.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'config' && classData && (
                <ScoringConfigComponent classId={classId} initialConfig={classData.scoringConfig} />
              )}

              {activeTab === 'submissions' && (
                <SubmissionTable submissions={submissions} assignments={assignments} />
              )}
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
