'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import AuthGuard from '@/app/components/AuthGuard';
import Navbar from '@/app/components/Navbar';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useToast } from '@/app/contexts/ToastContext';
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
import { useRouter } from 'next/navigation';
import ScoringConfigComponent from '@/app/teacher/components/ScoringConfig';
import SubmissionTable from '@/app/teacher/components/SubmissionTable';
import ClassManagement from '@/app/teacher/components/ClassManagement';
import AssignmentModal from '@/app/teacher/components/AssignmentModal';
import { 
  Edit2, 
  Trash2, 
  ArrowLeft, 
  Copy, 
  Check, 
  Power, 
  AlertTriangle, 
  BookOpen, 
  Sliders, 
  Table2, 
  Settings,
  PlusCircle,
  Volume2
} from 'lucide-react';

export default function ClassDetail({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = use(params);
  const router = useRouter();
  const { t } = useLanguage();
  const { success, error: toastError } = useToast();

  const [classData, setClassData] = useState<ClassData | null>(null);
  const [assignments, setAssignments] = useState<AssignmentData[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'assignments' | 'config' | 'submissions' | 'management'>('assignments');
  const [copied, setCopied] = useState(false);

  // Assignment Modal & Delete states
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentData | null>(null);
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
    success(t('common.copied'));
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleActive = async (assignment: AssignmentData) => {
    if (!assignment.id) return;
    const newStatus = !assignment.isActive;
    try {
      await updateAssignment(classId, assignment.id, { isActive: newStatus });
      setAssignments(prev => prev.map(a => a.id === assignment.id ? { ...a, isActive: newStatus } : a));
      success(newStatus ? 'Đã mở bài tập' : 'Đã đóng bài tập');
    } catch (error) {
      console.error('Error toggling assignment status:', error);
      toastError('Không thể thay đổi trạng thái bài tập.');
    }
  };

  const handleDeleteAssignment = async (deleteSubmissions: boolean) => {
    if (!deletingAssignment?.id) return;
    setIsDeleting(true);
    try {
      const { deleteAssignmentWithSubmissions } = await import('@/app/lib/firestore');
      await deleteAssignmentWithSubmissions(classId, deletingAssignment.id, deleteSubmissions);
      setAssignments(prev => prev.filter(a => a.id !== deletingAssignment.id));
      if (deleteSubmissions) {
        setSubmissions(prev => prev.filter(s => s.assignmentId !== deletingAssignment.id));
      }
      setDeletingAssignment(null);
      success(t('assignment.deleted_success'));
    } catch (error) {
      console.error('Error deleting assignment:', error);
      toastError('Lỗi khi xóa bài tập.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AuthGuard allowedRole="teacher">
      <main className="min-h-screen bg-gray-900 text-white flex flex-col w-full max-w-full overflow-x-hidden">
        <Navbar currentRole="teacher" />

        <div className="flex-1 p-3 sm:p-6 md:p-8 max-w-[1600px] mx-auto w-full space-y-6">
          {/* Header Card */}
          <div className="bg-gray-800/90 p-5 sm:p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-gray-700/80">
            <div className="flex items-center space-x-3 sm:space-x-4">
              <button
                onClick={() => router.push('/teacher')}
                className="p-2.5 bg-gray-700/80 hover:bg-gray-700 rounded-2xl transition-colors text-gray-300 hover:text-white cursor-pointer shrink-0"
                title={t('common.back')}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <h1 className="text-xl sm:text-2xl font-black text-white truncate font-sans">
                    {classData ? (classData.className || classData.name) : t('common.loading')}
                  </h1>
                  <button
                    type="button"
                    onClick={() => setActiveTab('management')}
                    className="p-1.5 rounded-xl bg-gray-700/60 hover:bg-gray-700 text-gray-400 hover:text-blue-400 transition-colors cursor-pointer shrink-0"
                    title={t('mgmt.rename_class')}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <span className="text-gray-400 text-xs">{t('student.class_id')}:</span>
                  <code className="bg-gray-900 px-2.5 py-0.5 rounded-lg text-blue-400 font-mono text-xs font-bold border border-gray-700">
                    {classId}
                  </code>
                  <button
                    onClick={() => copyToClipboard(classId)}
                    className="p-1 text-gray-400 hover:text-blue-400 hover:bg-gray-700/50 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-xs"
                    title={t('common.copy')}
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? t('common.copied') : t('common.copy')}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 bg-gray-900 text-gray-300 text-xs rounded-xl border border-gray-700 font-medium">
                {assignments.length} {t('tab.assignments').toLowerCase()} • {submissions.length} {t('sub.submissions_count')}
              </span>
            </div>
          </div>

          {/* Navigation Tabs - Horizontal scrolling with no overflow break */}
          <div className="w-full overflow-x-auto scrollbar-none">
            <nav className="flex space-x-2 border-b border-gray-700/80 pb-px min-w-max">
              <button
                onClick={() => setActiveTab('assignments')}
                className={`py-3 px-4 sm:px-6 font-bold text-xs sm:text-sm rounded-t-2xl transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'assignments'
                    ? 'border-b-2 border-blue-500 text-blue-400 bg-gray-800/80 shadow-sm'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                {t('tab.assignments')} ({assignments.length})
              </button>

              <button
                onClick={() => setActiveTab('config')}
                className={`py-3 px-4 sm:px-6 font-bold text-xs sm:text-sm rounded-t-2xl transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'config'
                    ? 'border-b-2 border-blue-500 text-blue-400 bg-gray-800/80 shadow-sm'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
                }`}
              >
                <Sliders className="w-4 h-4" />
                {t('tab.scoring_config')}
              </button>

              <button
                onClick={() => setActiveTab('submissions')}
                className={`py-3 px-4 sm:px-6 font-bold text-xs sm:text-sm rounded-t-2xl transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'submissions'
                    ? 'border-b-2 border-blue-500 text-blue-400 bg-gray-800/80 shadow-sm'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
                }`}
              >
                <Table2 className="w-4 h-4" />
                {t('tab.submissions')} ({submissions.length})
              </button>

              <button
                onClick={() => setActiveTab('management')}
                className={`py-3 px-4 sm:px-6 font-bold text-xs sm:text-sm rounded-t-2xl transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'management'
                    ? 'border-b-2 border-emerald-500 text-emerald-400 bg-gray-800/80 shadow-sm'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
                }`}
              >
                <Settings className="w-4 h-4" />
                {t('tab.class_management')}
              </button>
            </nav>
          </div>

          {/* Tab 1: Assignments */}
          <div className={activeTab === 'assignments' ? 'space-y-6 animate-in fade-in duration-200' : 'hidden'}>
            <div className="bg-gray-800/90 rounded-3xl p-5 sm:p-6 shadow-xl border border-gray-700/80 space-y-5">
              {/* Header with Title & + Create New Assignment Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-700/60">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-blue-400" />
                    <span>{t('tab.assignments')} ({assignments.length})</span>
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Danh sách các bài tập phát âm đang mở cho học viên trong lớp
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedAssignment(null);
                    setIsAssignmentModalOpen(true);
                  }}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl text-xs sm:text-sm transition-all shadow-lg shadow-blue-500/25 flex items-center gap-2 cursor-pointer active:scale-95 shrink-0 self-start sm:self-auto"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>{t('assignment.btn_create')}</span>
                </button>
              </div>

              {loading ? (
                <div className="flex justify-center p-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-400"></div>
                </div>
              ) : assignments.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <p className="text-gray-400 text-sm">
                    {t('practice.no_assignments')}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAssignment(null);
                      setIsAssignmentModalOpen(true);
                    }}
                    className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>{t('assignment.btn_create')}</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {assignments.map((assignment) => (
                    <div
                      key={assignment.id}
                      className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                        assignment.isActive !== false
                          ? 'bg-gray-900/80 border-gray-700 hover:border-gray-600 shadow-md'
                          : 'bg-gray-900/40 border-gray-800 opacity-60'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="min-w-0 flex-1">
                            {assignment.title ? (
                              <>
                                <h3 className="font-bold text-lg text-white truncate font-sans" title={assignment.title}>
                                  {assignment.title}
                                </h3>
                                <p className="font-sans text-sm text-lime-400 font-bold mt-0.5 truncate tracking-wide">
                                  {assignment.word}
                                </p>
                              </>
                            ) : (
                              <h3 className="font-sans text-lg font-bold text-lime-400 truncate tracking-wide">
                                {assignment.word}
                              </h3>
                            )}
                          </div>

                          <span
                            className={`text-[11px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${
                              assignment.isActive !== false
                                ? 'bg-green-500/10 text-green-400 border-green-500/20'
                                : 'bg-red-500/10 text-red-400 border-red-500/20'
                            }`}
                          >
                            {assignment.isActive !== false ? t('assignment.status_open') : t('assignment.status_closed')}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400 mt-3">
                          <span className="bg-gray-800 px-2 py-1 rounded-lg border border-gray-700 font-sans">
                            Phoneme: <strong className="text-white font-mono">{assignment.targetPhoneme}</strong>
                          </span>
                          <span className="bg-gray-800 px-2 py-1 rounded-lg border border-gray-700 font-sans">
                            Tối đa: <strong className="text-white">{assignment.maxAttempts} lượt</strong>
                          </span>
                          {assignment.enableSampleAudio && (
                            <span className="bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 px-2 py-1 rounded-lg font-bold flex items-center gap-1">
                              <Volume2 className="w-3 h-3" />
                              <span>{assignment.sampleAudioType === 'teacher_record' ? 'Audio GV' : 'Audio TTS'}</span>
                            </span>
                          )}
                          {assignment.scoringConfig && (
                            <span className="bg-purple-950/40 text-purple-300 border border-purple-500/30 px-2 py-1 rounded-lg font-bold">
                              ⚙️ Config riêng
                            </span>
                          )}
                          {assignment.deadline && (
                            <span className="bg-gray-800 px-2 py-1 rounded-lg border border-gray-700 font-sans">
                              Hạn: {assignment.deadline.toDate().toLocaleDateString('vi-VN')}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-gray-800/80">
                        <button
                          onClick={() => handleToggleActive(assignment)}
                          className={`p-2 rounded-xl border text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                            assignment.isActive !== false
                              ? 'bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border-yellow-500/20'
                              : 'bg-green-500/10 hover:bg-green-500/20 text-green-400 border-green-500/20'
                          }`}
                          title={assignment.isActive !== false ? t('assignment.toggle_close') : t('assignment.toggle_open')}
                        >
                          <Power className="w-3.5 h-3.5" />
                          <span>{assignment.isActive !== false ? t('assignment.toggle_close') : t('assignment.toggle_open')}</span>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedAssignment(assignment);
                            setIsAssignmentModalOpen(true);
                          }}
                          className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-xl text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
                          title={t('common.edit')}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>{t('common.edit')}</span>
                        </button>

                        <button
                          onClick={() => setDeletingAssignment(assignment)}
                          className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
                          title={t('common.delete')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{t('common.delete')}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tab 2: Scoring Config */}
          <div className={activeTab === 'config' ? 'animate-in fade-in duration-200' : 'hidden'}>
            <ScoringConfigComponent 
              classId={classId} 
              initialConfig={classData?.scoringConfig} 
              onSaved={(newConfig) => {
                setClassData(prev => prev ? { ...prev, scoringConfig: newConfig } : null);
              }}
            />
          </div>

          {/* Tab 3: Submissions Table */}
          <div className={activeTab === 'submissions' ? 'animate-in fade-in duration-200' : 'hidden'}>
            <SubmissionTable 
              submissions={submissions} 
              assignments={assignments} 
              classData={classData} 
              onSubmissionUpdated={loadData}
            />
          </div>

          {/* Tab 4: Class Management */}
          <div className={activeTab === 'management' ? 'animate-in fade-in duration-200' : 'hidden'}>
            {classData && (
              <ClassManagement
                classId={classId}
                classData={classData}
                assignments={assignments}
                submissions={submissions}
                onClassUpdated={loadData}
              />
            )}
          </div>
        </div>

        {/* Unified Create & Edit Assignment Modal (Dual Tabs) */}
        <AssignmentModal
          classId={classId}
          assignment={selectedAssignment}
          classDefaultConfig={classData?.scoringConfig}
          isOpen={isAssignmentModalOpen}
          onClose={() => {
            setIsAssignmentModalOpen(false);
            setSelectedAssignment(null);
          }}
          onSaved={loadData}
        />

        {/* Delete Confirmation Modal with Dual Options */}
        {deletingAssignment && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in"
            onClick={() => setDeletingAssignment(null)}
          >
            <div
              className="bg-gray-900 border border-gray-700 text-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-5"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 text-red-400">
                <div className="w-11 h-11 rounded-2xl bg-red-500/20 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">{t('assignment.delete_confirm_title')}</h3>
                  <p className="text-xs text-gray-400 font-mono">
                    {deletingAssignment.title ? `${deletingAssignment.title} (${deletingAssignment.word})` : deletingAssignment.word}
                  </p>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
                {t('assignment.delete_confirm_desc')}
              </p>

              {/* 2 Action Buttons + Cancel Button */}
              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => handleDeleteAssignment(true)}
                  disabled={isDeleting}
                  className="w-full py-3 px-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-lg shadow-red-500/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{t('assignment.delete_with_subs')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDeleteAssignment(false)}
                  disabled={isDeleting}
                  className="w-full py-3 px-4 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-300 border border-yellow-500/30 font-bold rounded-xl text-xs sm:text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{t('assignment.delete_only_assign')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDeletingAssignment(null)}
                  disabled={isDeleting}
                  className="w-full py-2.5 px-4 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-xl font-medium text-xs sm:text-sm transition-colors cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </AuthGuard>
  );
}
