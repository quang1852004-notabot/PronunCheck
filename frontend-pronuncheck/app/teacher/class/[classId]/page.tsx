'use client';

import { useState, useEffect, useCallback } from 'react';
import AuthGuard from '@/app/components/AuthGuard';
import { 
  getClass, 
  getAssignments, 
  getSubmissions, 
  deleteAssignment,
  updateAssignment,
  ClassData, 
  AssignmentData, 
  SubmissionData 
} from '@/app/lib/firestore';
import { useParams, useRouter } from 'next/navigation';
import AssignmentForm from '@/app/teacher/components/AssignmentForm';
import EditAssignmentModal from '@/app/teacher/components/EditAssignmentModal';
import ScoringConfigComponent from '@/app/teacher/components/ScoringConfig';
import SubmissionTable from '@/app/teacher/components/SubmissionTable';
import { Edit2, Trash2, ArrowLeft, Copy, Check, Power, AlertTriangle } from 'lucide-react';

export default function ClassDetail() {
  const params = useParams();
  const classId = params.classId as string;
  const router = useRouter();

  const [classData, setClassData] = useState<ClassData | null>(null);
  const [assignments, setAssignments] = useState<AssignmentData[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'assignments' | 'config' | 'submissions'>('assignments');
  const [copied, setCopied] = useState(false);

  // Edit & Delete states
  const [editingAssignment, setEditingAssignment] = useState<AssignmentData | null>(null);
  const [deletingAssignment, setDeletingAssignment] = useState<AssignmentData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    try {
      const data = await getClass(classId);
      if (data) {
        setClassData(data);
        const asgns = await getAssignments(classId);
        setAssignments(asgns);
        const subs = await getSubmissions(classId);
        setSubmissions(subs);
      }
    } catch (err) {
      console.error('Error loading class data:', err);
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleActive = async (assignment: AssignmentData) => {
    if (!assignment.id) return;
    const newStatus = !assignment.isActive;
    try {
      await updateAssignment(classId, assignment.id, { isActive: newStatus });
      setAssignments(prev => prev.map(a => a.id === assignment.id ? { ...a, isActive: newStatus } : a));
    } catch (error) {
      console.error('Error toggling assignment status:', error);
      alert('Không thể thay đổi trạng thái bài tập.');
    }
  };

  const handleDeleteAssignment = async () => {
    if (!deletingAssignment?.id) return;
    setIsDeleting(true);
    try {
      await deleteAssignment(classId, deletingAssignment.id);
      setAssignments(prev => prev.filter(a => a.id !== deletingAssignment.id));
      setDeletingAssignment(null);
    } catch (error) {
      console.error('Error deleting assignment:', error);
      alert('Lỗi khi xóa bài tập.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AuthGuard allowedRole="teacher">
      <div className="min-h-screen bg-gray-900 text-gray-100 p-4 sm:p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div className="bg-gray-800 p-6 rounded-3xl shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-gray-700">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/teacher')}
                className="p-3 bg-gray-700 hover:bg-gray-600 rounded-2xl transition-colors text-gray-300 hover:text-white cursor-pointer"
                title="Quay lại danh sách lớp"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {classData ? classData.className : 'Đang tải...'}
                </h1>
                <div className="flex items-center space-x-2 mt-1.5">
                  <span className="text-gray-400 text-xs">Mã lớp:</span>
                  <code className="bg-gray-900 px-2.5 py-1 rounded-lg text-blue-400 font-mono text-sm font-bold border border-gray-700">
                    {classId}
                  </code>
                  <button
                    onClick={() => copyToClipboard(classId)}
                    className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-gray-700/50 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs"
                    title="Sao chép mã lớp"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-green-400" />
                        <span className="text-green-400 font-medium">Đã copy</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy mã</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 self-end sm:self-center text-sm text-gray-400 bg-gray-900/60 px-4 py-2 rounded-xl border border-gray-700/60">
              <span>{classData?.password ? '🔒 Có mật khẩu bảo vệ' : '🔓 Mở tự do'}</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex space-x-2 border-b border-gray-700 overflow-x-auto pb-px">
            <button
              onClick={() => setActiveTab('assignments')}
              className={`px-6 py-3 font-semibold transition-all border-b-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'assignments'
                  ? 'border-blue-400 text-blue-400 bg-blue-500/10 rounded-t-xl'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              📚 Bài tập ({assignments.length})
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={`px-6 py-3 font-semibold transition-all border-b-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'config'
                  ? 'border-blue-400 text-blue-400 bg-blue-500/10 rounded-t-xl'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              ⚙️ Cấu hình chấm điểm
            </button>
            <button
              onClick={() => setActiveTab('submissions')}
              className={`px-6 py-3 font-semibold transition-all border-b-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'submissions'
                  ? 'border-blue-400 text-blue-400 bg-blue-500/10 rounded-t-xl'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              📊 Kết quả học sinh ({submissions.length})
            </button>
          </div>

          {/* Content */}
          {loading ? (
            <div className="text-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-400 mx-auto"></div>
            </div>
          ) : (
            <div className="bg-gray-800 p-6 sm:p-8 rounded-3xl shadow-2xl border border-gray-700">
              {activeTab === 'assignments' && (
                <div className="space-y-10">
                  <AssignmentForm classId={classId} onCreated={loadData} />
                  
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <span>📋</span> Danh sách bài tập ({assignments.length})
                      </h3>
                    </div>

                    <div className="grid gap-4">
                      {assignments.map(a => (
                        <div 
                          key={a.id} 
                          className={`p-5 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                            a.isActive 
                              ? 'bg-gray-900/90 border-gray-700 hover:border-gray-600' 
                              : 'bg-gray-900/40 border-gray-800 opacity-75'
                          }`}
                        >
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex items-center gap-3 flex-wrap">
                              {a.title ? (
                                <>
                                  <h4 className="text-lg font-bold text-white">{a.title}</h4>
                                  <span className="text-sm text-blue-400 font-mono bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-lg truncate max-w-xs" title={a.word}>
                                    {a.word}
                                  </span>
                                </>
                              ) : (
                                <h4 className="text-lg font-bold text-blue-400 font-mono">{a.word}</h4>
                              )}

                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                a.isActive 
                                  ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                                  : 'bg-gray-600/20 text-gray-400 border border-gray-600/30'
                              }`}>
                                {a.isActive ? '● Đang mở' : '○ Đã đóng'}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
                              <p>Phoneme: <code className="text-gray-200 font-bold bg-gray-800 px-1.5 py-0.5 rounded">{a.targetPhoneme}</code></p>
                              <p>Tối đa: <strong className="text-white">{a.maxAttempts}</strong> lần thử</p>
                              {a.deadline && (
                                <p>Hạn: <span className="text-yellow-400 font-medium">
                                  {a.deadline.toDate ? a.deadline.toDate().toLocaleString('vi-VN') : new Date(a.deadline.seconds * 1000).toLocaleString('vi-VN')}
                                </span></p>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-gray-800 justify-end">
                            {/* Toggle Active Button */}
                            <button
                              onClick={() => handleToggleActive(a)}
                              className={`p-2.5 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-medium cursor-pointer ${
                                a.isActive 
                                  ? 'bg-gray-800 text-yellow-400 border-gray-700 hover:bg-yellow-400/10 hover:border-yellow-400/30' 
                                  : 'bg-gray-800 text-green-400 border-gray-700 hover:bg-green-400/10 hover:border-green-400/30'
                              }`}
                              title={a.isActive ? 'Đóng bài tập này' : 'Mở lại bài tập này'}
                            >
                              <Power className="w-4 h-4" />
                              <span className="hidden sm:inline">{a.isActive ? 'Đóng' : 'Mở'}</span>
                            </button>

                            {/* Edit Button */}
                            <button
                              onClick={() => setEditingAssignment(a)}
                              className="p-2.5 bg-gray-800 hover:bg-blue-600/20 text-gray-300 hover:text-blue-400 border border-gray-700 hover:border-blue-500/40 rounded-xl transition-all flex items-center gap-1.5 text-xs font-medium cursor-pointer"
                              title="Chỉnh sửa bài tập"
                            >
                              <Edit2 className="w-4 h-4" />
                              <span className="hidden sm:inline">Sửa</span>
                            </button>

                            {/* Delete Button */}
                            <button
                              onClick={() => setDeletingAssignment(a)}
                              className="p-2.5 bg-gray-800 hover:bg-red-600/20 text-gray-400 hover:text-red-400 border border-gray-700 hover:border-red-500/40 rounded-xl transition-all flex items-center gap-1.5 text-xs font-medium cursor-pointer"
                              title="Xóa bài tập"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span className="hidden sm:inline">Xóa</span>
                            </button>
                          </div>
                        </div>
                      ))}

                      {assignments.length === 0 && (
                        <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8 text-center text-gray-500">
                          Chưa có bài tập nào trong lớp học này.
                        </div>
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

      {/* Edit Assignment Modal */}
      <EditAssignmentModal
        classId={classId}
        assignment={editingAssignment}
        isOpen={Boolean(editingAssignment)}
        onClose={() => setEditingAssignment(null)}
        onUpdated={loadData}
      />

      {/* Delete Confirmation Modal */}
      {deletingAssignment && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in"
          onClick={() => setDeletingAssignment(null)}
        >
          <div 
            className="bg-gray-900 border border-gray-700 text-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Xác nhận xóa bài tập?</h3>
                <p className="text-xs text-gray-400 mt-0.5">Thao tác này không thể hoàn tác.</p>
              </div>
            </div>

            <div className="bg-gray-800/80 p-4 rounded-2xl border border-gray-700/80 text-sm">
              <p className="text-gray-300">
                Bạn đang chuẩn bị xóa bài tập: <strong className="text-white">{deletingAssignment.title || deletingAssignment.word}</strong>
              </p>
              <p className="text-xs text-red-400/90 mt-2">
                ⚠️ Lưu ý: Học sinh sẽ không còn thấy bài tập này trong danh sách làm bài nữa.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingAssignment(null)}
                className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-medium transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteAssignment}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 active:bg-red-700 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-500/25 cursor-pointer"
              >
                {isDeleting ? 'Đang xóa...' : 'Xác nhận xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthGuard>
  );
}
