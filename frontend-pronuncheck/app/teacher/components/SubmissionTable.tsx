'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  SubmissionData, 
  AssignmentData, 
  ClassData,
  updateSubmissionNote,
  deleteSubmission
} from '@/app/lib/firestore';
import { getAudioUrl } from '@/app/lib/storage';
import { exportClassDataToExcel } from '@/app/lib/excelExport';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useToast } from '@/app/contexts/ToastContext';
import { 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Filter, 
  Search, 
  RotateCcw, 
  Volume2, 
  X, 
  CheckCircle2, 
  XCircle,
  FileSpreadsheet,
  ChevronDown,
  Edit3,
  Trash2,
  MessageSquare,
  AlertTriangle,
  Save
} from 'lucide-react';

import StudentAnalyticsDashboard from '@/app/teacher/components/StudentAnalyticsDashboard';
import DarkAudioPlayer from '@/app/components/DarkAudioPlayer';
import PhonemeKaraokeVisualizer from '@/app/components/PhonemeKaraokeVisualizer';

interface SubmissionTableProps {
  submissions: SubmissionData[];
  assignments: AssignmentData[];
  classData?: ClassData | null;
  onSubmissionUpdated?: () => void;
}

type SortField = 'email' | 'word' | 'time' | 'attempt' | 'wav2vec' | 'dtw' | 'whisper' | 'total' | 'result';
type SortDirection = 'asc' | 'desc';

// Safely normalize score to integer [0, 100]
function normalizeScore(val: any): number {
  if (val === undefined || val === null) return 0;
  let n = Number(val);
  if (isNaN(n) || !isFinite(n)) return 0;
  while (n > 100) n = n / 100;
  if (n <= 1.0 && n > 0) n = n * 100;
  return Math.min(100, Math.max(0, Math.round(n)));
}

// Safely extract timestamp from Firestore or audio filename fallback
function getSubmissionTimestamp(sub: SubmissionData): number {
  if (sub.createdAt?.toDate) {
    return sub.createdAt.toDate().getTime();
  }
  if (sub.createdAt?.seconds) {
    return sub.createdAt.seconds * 1000;
  }
  const path = sub.audioStoragePath || sub.audioUrl || '';
  const match = path.match(/_(\d{13})\./);
  if (match && match[1]) {
    return Number(match[1]);
  }
  return 0;
}

export default function SubmissionTable({ 
  submissions, 
  assignments, 
  classData,
  onSubmissionUpdated
}: SubmissionTableProps) {
  const { t } = useLanguage();
  const { success, error: toastError } = useToast();

  // Expanded Row State (Accordion)
  const [expandedSubId, setExpandedSubId] = useState<string | null>(null);

  // Playback sync for Karaoke
  const [karaokeCurrentTime, setKaraokeCurrentTime] = useState(0);
  const [karaokeDuration, setKaraokeDuration] = useState(0);
  const [isKaraokePlaying, setIsKaraokePlaying] = useState(false);

  // Manage Action Popover & Modals
  const [managePopoverSubId, setManagePopoverSubId] = useState<string | null>(null);
  const [editingNoteSub, setEditingNoteSub] = useState<SubmissionData | null>(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const [deletingSub, setDeletingSub] = useState<SubmissionData | null>(null);
  const [deletingSubLoading, setDeletingSubLoading] = useState(false);

  // Sorting State - Default sort by 'time' descending
  const [sortField, setSortField] = useState<SortField | null>('time');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Filter States
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [emailSearchQuery, setEmailSearchQuery] = useState('');
  
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<string[]>([]);
  const [assignmentSearchQuery, setAssignmentSearchQuery] = useState('');
  
  const [selectedStatuses, setSelectedStatuses] = useState<('passed' | 'failed')[]>([]);

  // Active Filter Popover Menu: 'email' | 'assignment' | 'status' | null
  const [activePopover, setActivePopover] = useState<'email' | 'assignment' | 'status' | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Click outside to close popovers
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setActivePopover(null);
        setManagePopoverSubId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // When opening note modal, prepopulate current note
  useEffect(() => {
    if (editingNoteSub) {
      setNoteText(editingNoteSub.teacherNote || '');
    }
  }, [editingNoteSub]);

  // Handle Export Excel
  const handleExportExcel = () => {
    try {
      exportClassDataToExcel({
        classData: classData || { name: 'Class', teacherId: '', teacherEmail: '' },
        assignments,
        submissions,
        members: []
      });
      success(t('mgmt.excel_exported'));
    } catch (err) {
      console.error('Export excel error:', err);
      toastError('Lỗi khi xuất file Excel');
    }
  };

  // Handle Save Teacher Note
  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNoteSub?.id || !classData?.id) return;
    setSavingNote(true);
    try {
      await updateSubmissionNote(classData.id, editingNoteSub.id, noteText);
      success(t('sub.note_saved'));
      setEditingNoteSub(null);
      if (onSubmissionUpdated) onSubmissionUpdated();
    } catch (err: any) {
      console.error(err);
      toastError(err.message || 'Lỗi khi lưu ghi chú');
    } finally {
      setSavingNote(false);
    }
  };

  // Handle Delete Submission
  const handleConfirmDeleteSubmission = async () => {
    if (!deletingSub?.id || !classData?.id) return;
    setDeletingSubLoading(true);
    try {
      await deleteSubmission(classData.id, deletingSub.id);
      success(t('sub.sub_deleted'));
      if (expandedSubId === deletingSub.id) setExpandedSubId(null);
      setDeletingSub(null);
      if (onSubmissionUpdated) onSubmissionUpdated();
    } catch (err: any) {
      console.error(err);
      toastError(err.message || 'Lỗi khi xóa bài nộp');
    } finally {
      setDeletingSubLoading(false);
    }
  };

  // Map assignmentId -> AssignmentData for quick lookup
  const assignmentMap = useMemo(() => {
    const map = new Map<string, AssignmentData>();
    assignments.forEach(a => {
      if (a.id) map.set(a.id, a);
    });
    return map;
  }, [assignments]);

  // Unique list of student emails for filtering
  const uniqueEmails = useMemo(() => {
    const set = new Set<string>();
    submissions.forEach(s => {
      if (s.studentEmail) set.add(s.studentEmail);
    });
    return Array.from(set).sort();
  }, [submissions]);

  // Handle Sort Toggle
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortField(null); // Reset sort
      }
    } else {
      setSortField(field);
      setSortDirection(field === 'email' || field === 'word' ? 'asc' : 'desc');
    }
  };

  // Filter submissions
  const filteredSubmissions = useMemo(() => {
    return submissions.filter(sub => {
      if (selectedEmails.length > 0 && !selectedEmails.includes(sub.studentEmail)) {
        return false;
      }
      if (selectedAssignmentIds.length > 0 && !selectedAssignmentIds.includes(sub.assignmentId)) {
        return false;
      }
      if (selectedStatuses.length > 0) {
        const status = sub.isPassed ? 'passed' : 'failed';
        if (!selectedStatuses.includes(status)) {
          return false;
        }
      }
      return true;
    });
  }, [submissions, selectedEmails, selectedAssignmentIds, selectedStatuses]);

  // Sort submissions
  const sortedSubmissions = useMemo(() => {
    if (!sortField) return filteredSubmissions;

    return [...filteredSubmissions].sort((a, b) => {
      let aVal: string | number = 0;
      let bVal: string | number = 0;

      switch (sortField) {
        case 'email':
          aVal = a.studentEmail.toLowerCase();
          bVal = b.studentEmail.toLowerCase();
          break;
        case 'word': {
          const aTitle = assignmentMap.get(a.assignmentId)?.title || a.word;
          const bTitle = assignmentMap.get(b.assignmentId)?.title || b.word;
          aVal = aTitle.toLowerCase();
          bVal = bTitle.toLowerCase();
          break;
        }
        case 'time':
          aVal = getSubmissionTimestamp(a);
          bVal = getSubmissionTimestamp(b);
          break;
        case 'attempt':
          aVal = a.attemptNumber || 1;
          bVal = b.attemptNumber || 1;
          break;
        case 'wav2vec':
          aVal = normalizeScore(a.scores?.phoneme_score ?? a.detailedScore?.wav2vec_raw_score);
          bVal = normalizeScore(b.scores?.phoneme_score ?? b.detailedScore?.wav2vec_raw_score);
          break;
        case 'dtw':
          aVal = normalizeScore(a.scores?.dtw_score ?? a.detailedScore?.dtw_score);
          bVal = normalizeScore(b.scores?.dtw_score ?? b.detailedScore?.dtw_score);
          break;
        case 'whisper':
          aVal = normalizeScore(a.scores?.whisper_score ?? a.detailedScore?.whisper_raw_score);
          bVal = normalizeScore(b.scores?.whisper_score ?? b.detailedScore?.whisper_raw_score);
          break;
        case 'total':
          aVal = normalizeScore(a.scores?.total_score ?? a.detailedScore?.hybrid_target_score);
          bVal = normalizeScore(b.scores?.total_score ?? b.detailedScore?.hybrid_target_score);
          break;
        case 'result':
          aVal = a.isPassed ? 1 : 0;
          bVal = b.isPassed ? 1 : 0;
          break;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredSubmissions, sortField, sortDirection, assignmentMap]);

  const hasActiveFilters = selectedEmails.length > 0 || selectedAssignmentIds.length > 0 || selectedStatuses.length > 0 || sortField !== 'time';

  const handleResetFilters = () => {
    setSelectedEmails([]);
    setSelectedAssignmentIds([]);
    setSelectedStatuses([]);
    setSortField('time');
    setSortDirection('desc');
    setActivePopover(null);
  };

  // Render Sort Icon
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-gray-500 group-hover:text-gray-300 opacity-60" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-3.5 h-3.5 text-blue-400 font-bold" /> 
      : <ArrowDown className="w-3.5 h-3.5 text-blue-400 font-bold" />;
  };

  return (
    <div className="space-y-6 w-full max-w-full min-w-0" ref={popoverRef}>
      {/* 1. Student Analytics Overview Dashboard */}
      <StudentAnalyticsDashboard 
        submissions={submissions} 
        assignments={assignments} 
      />

      {/* 2. Top Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-900/80 p-4 rounded-2xl border border-gray-700/80">
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <span>📈</span> {t('sub.title')}
          </h3>
          <span className="text-xs bg-blue-500/20 text-blue-400 font-bold px-2.5 py-1 rounded-full border border-blue-500/30 font-mono">
            {sortedSubmissions.length} / {submissions.length} {t('sub.submissions_count')}
          </span>

          {/* Compact Excel Export Button */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3 py-1 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95 ml-1"
            title={t('mgmt.export_btn')}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>.xlsx</span>
          </button>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400">{t('sub.filter_by')}</span>
            {selectedEmails.length > 0 && (
              <span className="text-xs bg-gray-800 border border-gray-700 text-blue-400 px-2 py-0.5 rounded-md flex items-center gap-1">
                {t('sub.filter_email')} ({selectedEmails.length})
                <X className="w-3 h-3 cursor-pointer hover:text-white" onClick={() => setSelectedEmails([])} />
              </span>
            )}
            {selectedAssignmentIds.length > 0 && (
              <span className="text-xs bg-gray-800 border border-gray-700 text-purple-400 px-2 py-0.5 rounded-md flex items-center gap-1">
                {t('sub.filter_assignment')} ({selectedAssignmentIds.length})
                <X className="w-3 h-3 cursor-pointer hover:text-white" onClick={() => setSelectedAssignmentIds([])} />
              </span>
            )}
            {selectedStatuses.length > 0 && (
              <span className="text-xs bg-gray-800 border border-gray-700 text-green-400 px-2 py-0.5 rounded-md flex items-center gap-1">
                {selectedStatuses.map(s => s === 'passed' ? t('practice.status_passed') : t('practice.status_failed')).join(', ')}
                <X className="w-3 h-3 cursor-pointer hover:text-white" onClick={() => setSelectedStatuses([])} />
              </span>
            )}
            {sortField && (
              <span className="text-xs bg-gray-800 border border-gray-700 text-yellow-400 px-2 py-0.5 rounded-md flex items-center gap-1">
                {sortField} ({sortDirection})
                <X className="w-3 h-3 cursor-pointer hover:text-white" onClick={() => setSortField('time')} />
              </span>
            )}

            <button
              onClick={handleResetFilters}
              className="text-xs text-red-400 hover:text-red-300 hover:bg-red-400/10 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer ml-1"
            >
              <RotateCcw className="w-3 h-3" /> {t('common.reset')}
            </button>
          </div>
        )}
      </div>

      {/* Table Container */}
      <div className="relative overflow-x-auto rounded-3xl border border-gray-700/80 shadow-2xl bg-gray-900/50 w-full max-w-full">
        <table className="w-full text-xs sm:text-sm text-left text-gray-300">
          <thead className="text-[11px] sm:text-xs text-gray-300 uppercase bg-gray-900/95 border-b border-gray-700 select-none whitespace-nowrap">
            <tr>
              {/* Col 0: Expand Chevron */}
              <th scope="col" className="w-8 px-2 py-4 text-center"></th>

              {/* Col 1: Email */}
              <th scope="col" className="px-4 py-4 min-w-[180px]">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleSort('email')}
                    className="inline-flex items-center gap-1.5 font-bold hover:text-white group cursor-pointer"
                  >
                    <span>{t('sub.th_email')}</span>
                    {renderSortIcon('email')}
                  </button>

                  <div className="relative">
                    <button
                      onClick={() => setActivePopover(activePopover === 'email' ? null : 'email')}
                      className={`p-1 rounded-md transition-colors cursor-pointer ${
                        selectedEmails.length > 0 
                          ? 'bg-blue-600 text-white' 
                          : 'text-gray-400 hover:text-white hover:bg-gray-800'
                      }`}
                      title={t('sub.filter_email')}
                    >
                      <Filter className="w-3.5 h-3.5" />
                    </button>

                    {/* Popover Filter Email */}
                    {activePopover === 'email' && (
                      <div className="absolute left-0 mt-2 w-64 bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-3 z-50 normal-case">
                        <div className="flex items-center gap-2 bg-gray-900 px-2.5 py-1.5 rounded-xl border border-gray-700 mb-2">
                          <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <input
                            type="text"
                            placeholder={t('sub.search_email')}
                            value={emailSearchQuery}
                            onChange={(e) => setEmailSearchQuery(e.target.value)}
                            className="bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none w-full"
                          />
                        </div>

                        <div className="max-h-48 overflow-y-auto space-y-1 scrollbar-thin">
                          {uniqueEmails
                            .filter(e => e.toLowerCase().includes(emailSearchQuery.toLowerCase()))
                            .map(email => (
                              <label key={email} className="flex items-center gap-2 p-1.5 hover:bg-gray-700 rounded-lg cursor-pointer text-xs">
                                <input
                                  type="checkbox"
                                  checked={selectedEmails.includes(email)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedEmails([...selectedEmails, email]);
                                    } else {
                                      setSelectedEmails(selectedEmails.filter(x => x !== email));
                                    }
                                  }}
                                  className="rounded bg-gray-900 border-gray-600 text-blue-600 focus:ring-0"
                                />
                                <span className="truncate text-gray-300 font-mono">{email}</span>
                              </label>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </th>

              {/* Col 2: Assignment / Word */}
              <th scope="col" className="px-4 py-4 min-w-[180px]">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleSort('word')}
                    className="inline-flex items-center gap-1.5 font-bold hover:text-white group cursor-pointer"
                  >
                    <span>{t('sub.th_word')}</span>
                    {renderSortIcon('word')}
                  </button>

                  <div className="relative">
                    <button
                      onClick={() => setActivePopover(activePopover === 'assignment' ? null : 'assignment')}
                      className={`p-1 rounded-md transition-colors cursor-pointer ${
                        selectedAssignmentIds.length > 0 
                          ? 'bg-purple-600 text-white' 
                          : 'text-gray-400 hover:text-white hover:bg-gray-800'
                      }`}
                      title={t('sub.filter_assignment')}
                    >
                      <Filter className="w-3.5 h-3.5" />
                    </button>

                    {/* Popover Filter Assignment */}
                    {activePopover === 'assignment' && (
                      <div className="absolute left-0 mt-2 w-72 bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-3 z-50 normal-case">
                        <div className="flex items-center gap-2 bg-gray-900 px-2.5 py-1.5 rounded-xl border border-gray-700 mb-2">
                          <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <input
                            type="text"
                            placeholder={t('sub.search_assignment')}
                            value={assignmentSearchQuery}
                            onChange={(e) => setAssignmentSearchQuery(e.target.value)}
                            className="bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none w-full"
                          />
                        </div>

                        <div className="max-h-48 overflow-y-auto space-y-1 scrollbar-thin">
                          {assignments
                            .filter(a => (a.title || a.word).toLowerCase().includes(assignmentSearchQuery.toLowerCase()))
                            .map(a => (
                              <label key={a.id} className="flex items-center gap-2 p-1.5 hover:bg-gray-700 rounded-lg cursor-pointer text-xs">
                                <input
                                  type="checkbox"
                                  checked={a.id ? selectedAssignmentIds.includes(a.id) : false}
                                  onChange={(e) => {
                                    if (!a.id) return;
                                    if (e.target.checked) {
                                      setSelectedAssignmentIds([...selectedAssignmentIds, a.id]);
                                    } else {
                                      setSelectedAssignmentIds(selectedAssignmentIds.filter(x => x !== a.id));
                                    }
                                  }}
                                  className="rounded bg-gray-900 border-gray-600 text-purple-600 focus:ring-0"
                                />
                                <span className="truncate text-gray-300 font-medium">
                                  {a.title ? `${a.title} (${a.word})` : a.word}
                                </span>
                              </label>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </th>

              {/* Col 3: Submitted At */}
              <th scope="col" className="px-3 py-4 text-center whitespace-nowrap">
                <button 
                  onClick={() => handleSort('time')}
                  className="inline-flex items-center gap-1.5 font-bold hover:text-white group cursor-pointer"
                >
                  <span>{t('sub.th_time')}</span>
                  {renderSortIcon('time')}
                </button>
              </th>

              {/* Col 4: Attempt */}
              <th scope="col" className="px-3 py-4 text-center">
                <button 
                  onClick={() => handleSort('attempt')}
                  className="inline-flex items-center gap-1.5 font-bold hover:text-white group cursor-pointer"
                >
                  <span>{t('sub.th_attempt')}</span>
                  {renderSortIcon('attempt')}
                </button>
              </th>

              {/* Col 5: Phonetics (Clean White Text) */}
              <th scope="col" className="px-3 py-4 text-center">
                <button 
                  onClick={() => handleSort('wav2vec')}
                  className="inline-flex items-center gap-1.5 font-bold hover:text-white group cursor-pointer text-gray-200"
                >
                  <span>{t('sub.th_phoneme')}</span>
                  {renderSortIcon('wav2vec')}
                </button>
              </th>

              {/* Col 6: Intonation (Clean White Text) */}
              <th scope="col" className="px-3 py-4 text-center">
                <button 
                  onClick={() => handleSort('dtw')}
                  className="inline-flex items-center gap-1.5 font-bold hover:text-white group cursor-pointer text-gray-200"
                >
                  <span>{t('sub.th_intonation')}</span>
                  {renderSortIcon('dtw')}
                </button>
              </th>

              {/* Col 7: Completeness (Clean White Text) */}
              <th scope="col" className="px-3 py-4 text-center">
                <button 
                  onClick={() => handleSort('whisper')}
                  className="inline-flex items-center gap-1.5 font-bold hover:text-white group cursor-pointer text-gray-200"
                >
                  <span>{t('sub.th_whisper')}</span>
                  {renderSortIcon('whisper')}
                </button>
              </th>

              {/* Col 8: Overall Score (White in header) */}
              <th scope="col" className="px-3 py-4 text-center">
                <button 
                  onClick={() => handleSort('total')}
                  className="inline-flex items-center gap-1.5 font-bold hover:text-white group cursor-pointer text-gray-200"
                >
                  <span>{t('sub.th_total')}</span>
                  {renderSortIcon('total')}
                </button>
              </th>

              {/* Col 9: Result Filter */}
              <th scope="col" className="px-3.5 py-4 text-center min-w-[120px]">
                <div className="flex items-center justify-center gap-2">
                  <button 
                    onClick={() => handleSort('result')}
                    className="inline-flex items-center gap-1.5 font-bold hover:text-white group cursor-pointer"
                  >
                    <span>{t('sub.th_result')}</span>
                    {renderSortIcon('result')}
                  </button>

                  <div className="relative">
                    <button
                      onClick={() => setActivePopover(activePopover === 'status' ? null : 'status')}
                      className={`p-1 rounded-md transition-colors cursor-pointer ${
                        selectedStatuses.length > 0 
                          ? 'bg-green-600 text-white' 
                          : 'text-gray-400 hover:text-white hover:bg-gray-800'
                      }`}
                      title={t('sub.filter_result')}
                    >
                      <Filter className="w-3.5 h-3.5" />
                    </button>

                    {/* Popover Filter Result */}
                    {activePopover === 'status' && (
                      <div className="absolute right-0 mt-2 w-44 bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-3 z-50 normal-case">
                        <div className="space-y-1.5">
                          <label className="flex items-center gap-2 p-1.5 hover:bg-gray-700 rounded-lg cursor-pointer text-xs text-green-400">
                            <input
                              type="checkbox"
                              checked={selectedStatuses.includes('passed')}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedStatuses([...selectedStatuses, 'passed']);
                                } else {
                                  setSelectedStatuses(selectedStatuses.filter(s => s !== 'passed'));
                                }
                              }}
                              className="rounded bg-gray-900 border-gray-600 text-green-600 focus:ring-0"
                            />
                            <span>{t('practice.status_passed')}</span>
                          </label>
                          <label className="flex items-center gap-2 p-1.5 hover:bg-gray-700 rounded-lg cursor-pointer text-xs text-red-400">
                            <input
                              type="checkbox"
                              checked={selectedStatuses.includes('failed')}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedStatuses([...selectedStatuses, 'failed']);
                                } else {
                                  setSelectedStatuses(selectedStatuses.filter(s => s !== 'failed'));
                                }
                              }}
                              className="rounded bg-gray-900 border-gray-600 text-red-600 focus:ring-0"
                            />
                            <span>{t('practice.status_failed')}</span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </th>

              {/* Col 10: Manage Actions */}
              <th scope="col" className="px-3 py-4 text-center">
                {t('sub.th_manage')}
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-800">
            {sortedSubmissions.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-6 py-12 text-center text-gray-500 font-medium">
                  {submissions.length === 0 ? t('sub.no_submissions') : t('sub.no_filter_match')}
                </td>
              </tr>
            ) : (
              sortedSubmissions.map((sub, idx) => {
                const subId = sub.id || `${sub.assignmentId}_${sub.studentId}_${sub.attemptNumber || idx}`;
                const assignment = assignmentMap.get(sub.assignmentId);
                const isExpanded = expandedSubId === subId;

                // Clean Integer Scores [0 - 100]
                const rawTotal = sub.detailedScore?.hybrid_target_score !== undefined
                  ? sub.detailedScore.hybrid_target_score
                  : (sub.scores?.total_score !== undefined ? sub.scores.total_score : 0);
                const totalScore = normalizeScore(rawTotal);

                const rawPhoneme = sub.scores?.phoneme_score !== undefined
                  ? sub.scores.phoneme_score
                  : (sub.detailedScore?.wav2vec_raw_score !== undefined ? sub.detailedScore.wav2vec_raw_score : 0);
                const phonemeScore = normalizeScore(rawPhoneme);

                const rawDtw = sub.scores?.dtw_score !== undefined
                  ? sub.scores.dtw_score
                  : (sub.detailedScore?.dtw_score !== undefined ? sub.detailedScore.dtw_score : 0);
                const dtwScore = normalizeScore(rawDtw);

                const rawWhisper = sub.scores?.whisper_score !== undefined
                  ? sub.scores.whisper_score
                  : (sub.detailedScore?.whisper_raw_score !== undefined ? sub.detailedScore.whisper_raw_score : 0);
                const whisperScore = normalizeScore(rawWhisper);

                // Format timestamp with fallback to audio filename timestamp
                let formattedTime = '-';
                if (sub.createdAt?.toDate) {
                  const d = sub.createdAt.toDate();
                  formattedTime = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + d.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' });
                } else if (sub.createdAt?.seconds) {
                  const d = new Date(sub.createdAt.seconds * 1000);
                  formattedTime = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + d.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' });
                } else {
                  const path = sub.audioStoragePath || sub.audioUrl || '';
                  const match = path.match(/_(\d{13})\./);
                  if (match && match[1]) {
                    const d = new Date(Number(match[1]));
                    formattedTime = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + d.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' });
                  }
                }

                return (
                  <React.Fragment key={subId}>
                    <tr className={`transition-colors border-b border-gray-800/60 ${
                      isExpanded ? 'bg-gray-800/60' : 'hover:bg-gray-800/30'
                    }`}>
                      {/* 0. Chevron Expand Button */}
                      <td className="px-2 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => setExpandedSubId(isExpanded ? null : subId)}
                          className={`p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-transform duration-200 cursor-pointer ${
                            isExpanded ? 'rotate-180 text-lime-400 bg-gray-700' : ''
                          }`}
                          title={isExpanded ? t('sub.collapse_details') : t('sub.expand_details')}
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </td>

                      {/* 1. Student Email */}
                      <td className="px-3.5 py-3 font-mono font-medium text-gray-200 truncate max-w-[200px]" title={sub.studentEmail}>
                        {sub.studentEmail}
                      </td>

                      {/* 2. Assignment / Word */}
                      <td className="px-3.5 py-3 max-w-[220px]">
                        {assignment?.title ? (
                          <div>
                            <p className="font-bold text-white truncate text-xs sm:text-sm font-sans" title={assignment.title}>
                              {assignment.title}
                            </p>
                            <p className="font-sans text-gray-400 text-xs truncate" title={sub.word}>
                              {sub.word}
                            </p>
                          </div>
                        ) : (
                          <p className="font-sans text-white font-medium truncate text-xs sm:text-sm" title={sub.word}>
                            {sub.word}
                          </p>
                        )}
                      </td>

                      {/* 3. Submitted At */}
                      <td className="px-3 py-3 text-center font-mono text-[11px] text-gray-400 whitespace-nowrap">
                        {formattedTime}
                      </td>

                      {/* 4. Attempt */}
                      <td className="px-3 py-3 text-center font-mono text-xs text-gray-400">
                        {sub.attemptNumber ? `${sub.attemptNumber} / ${assignment?.maxAttempts || 3}` : '1'}
                      </td>

                      {/* 5. Phoneme Score (Clean White) */}
                      <td className="px-3 py-3 text-center font-mono font-bold text-gray-200 whitespace-nowrap text-xs sm:text-sm">
                        {phonemeScore}
                      </td>

                      {/* 6. DTW Score (Clean White) */}
                      <td className="px-3 py-3 text-center font-mono font-bold text-gray-200 whitespace-nowrap text-xs sm:text-sm">
                        {dtwScore}
                      </td>

                      {/* 7. Whisper Score (Clean White) */}
                      <td className="px-3 py-3 text-center font-mono font-bold text-gray-200 whitespace-nowrap text-xs sm:text-sm">
                        {whisperScore}
                      </td>

                      {/* 8. Total Score (Colored by Result: Green if Passed, Red if Failed) */}
                      <td className={`px-3 py-3 text-center font-mono font-black text-sm sm:text-base whitespace-nowrap ${
                        sub.isPassed ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {totalScore}
                      </td>

                      {/* 9. Result Status */}
                      <td className="px-3.5 py-3 text-center whitespace-nowrap">
                        {sub.isPassed ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-green-500/15 text-green-400 border border-green-500/30 whitespace-nowrap">
                            <CheckCircle2 className="w-3 h-3 shrink-0" />
                            <span>{t('practice.status_passed')}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-500/15 text-red-400 border border-red-500/30 whitespace-nowrap">
                            <XCircle className="w-3 h-3 shrink-0" />
                            <span>{t('practice.status_failed')}</span>
                          </span>
                        )}
                      </td>

                      {/* 10. Manage Action Button */}
                      <td className="px-3 py-3 text-center relative">
                        <button
                          type="button"
                          onClick={() => setManagePopoverSubId(managePopoverSubId === subId ? null : subId)}
                          className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 transition-colors cursor-pointer inline-flex items-center justify-center"
                          title={t('sub.th_manage')}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        {/* Action Popover Menu */}
                        {managePopoverSubId === subId && (
                          <div className="absolute right-3 top-12 w-48 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-1.5 z-50 text-left space-y-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingNoteSub(sub);
                                setManagePopoverSubId(null);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-blue-400 hover:bg-gray-800 rounded-xl transition-colors cursor-pointer font-bold"
                            >
                              <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                              <span>{t('sub.add_note')}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDeletingSub(sub);
                                setManagePopoverSubId(null);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-gray-800 rounded-xl transition-colors cursor-pointer font-bold"
                            >
                              <Trash2 className="w-3.5 h-3.5 shrink-0" />
                              <span>{t('sub.delete_sub')}</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>

                    {/* Expandable Karaoke & Diagnostics Details Sub-Row */}
                    {isExpanded && (
                      <tr className="bg-gray-950/90 border-b border-gray-800/80">
                        <td colSpan={11} className="p-4 sm:p-6 space-y-5 animate-in fade-in duration-200">
                          {/* Teacher Note Banner */}
                          {sub.teacherNote && (
                            <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-500/30 flex items-start justify-between gap-3 shadow-md">
                              <div className="flex items-start gap-2.5">
                                <MessageSquare className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                                <div className="space-y-0.5">
                                  <span className="text-xs font-bold text-blue-300 uppercase tracking-wide">
                                    {t('sub.teacher_note')}:
                                  </span>
                                  <p className="text-xs sm:text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">
                                    {sub.teacherNote}
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setEditingNoteSub(sub)}
                                className="text-xs text-blue-400 hover:underline shrink-0 cursor-pointer font-bold"
                              >
                                {t('common.edit')}
                              </button>
                            </div>
                          )}

                          {/* 4 Detailed Score Cards */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                            <div className="bg-gray-900/90 p-3 rounded-2xl border border-gray-800">
                              <span className="text-gray-400 block text-[10px] uppercase font-bold">{t('practice.score_phonetics')}</span>
                              <strong className="text-blue-400 font-mono text-xl font-black">{phonemeScore}</strong>
                            </div>
                            <div className="bg-gray-900/90 p-3 rounded-2xl border border-gray-800">
                              <span className="text-gray-400 block text-[10px] uppercase font-bold">{t('practice.score_intonation')}</span>
                              <strong className="text-purple-400 font-mono text-xl font-black">{dtwScore}</strong>
                            </div>
                            <div className="bg-gray-900/90 p-3 rounded-2xl border border-gray-800">
                              <span className="text-gray-400 block text-[10px] uppercase font-bold">{t('practice.score_completeness')}</span>
                              <strong className="text-pink-400 font-mono text-xl font-black">{whisperScore}</strong>
                            </div>
                            <div className="bg-gray-900/90 p-3 rounded-2xl border border-gray-800">
                              <span className="text-gray-400 block text-[10px] uppercase font-bold">{t('practice.score_overall')}</span>
                              <strong className={`font-mono text-xl font-black ${sub.isPassed ? 'text-green-400' : 'text-red-400'}`}>
                                {totalScore}
                              </strong>
                            </div>
                          </div>

                          {/* Dark Audio Player Waveform */}
                          {sub.audioUrl && (
                            <div className="space-y-1.5">
                              <span className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                                <Volume2 className="w-3.5 h-3.5 text-lime-400" />
                                Audio Playback ({sub.studentEmail} - Attempt #{sub.attemptNumber || 1}):
                              </span>
                              <DarkAudioPlayer
                                audioUrl={sub.audioUrl}
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
                            </div>
                          )}

                          {/* Word-Level Karaoke Visualizer */}
                          <PhonemeKaraokeVisualizer
                            expectedWord={sub.word}
                            charScores={sub.charScores || sub.detailedScore?.char_scores}
                            currentTime={karaokeCurrentTime}
                            duration={karaokeDuration}
                            isPlaying={isKaraokePlaying}
                          />

                          {/* AI Feedback if available */}
                          {sub.feedback && (
                            <div className="p-3.5 rounded-xl bg-gray-900 border border-gray-800 text-xs text-gray-300">
                              <span className="font-bold text-gray-400 block mb-1">AI Feedback:</span>
                              <p className="leading-relaxed">{sub.feedback}</p>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal 1: Add / Edit Teacher Note */}
      {editingNoteSub && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in"
          onClick={() => setEditingNoteSub(null)}
        >
          <div
            className="bg-gray-900 border border-gray-700 text-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-blue-400">
              <div className="w-10 h-10 rounded-2xl bg-blue-500/20 flex items-center justify-center shrink-0">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">{t('sub.note_modal_title')}</h3>
                <p className="text-xs text-gray-400 font-mono">
                  {editingNoteSub.studentEmail} • {editingNoteSub.word}
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveNote} className="space-y-4">
              <div>
                <textarea
                  rows={4}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder={t('sub.note_placeholder')}
                  className="w-full bg-gray-950 border border-gray-700 rounded-xl p-3.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-400 text-xs sm:text-sm font-sans resize-none"
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingNoteSub(null)}
                  className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-medium text-sm transition-colors cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={savingNote}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {savingNote ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>{t('common.save')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Confirm Delete Single Submission */}
      {deletingSub && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in"
          onClick={() => setDeletingSub(null)}
        >
          <div
            className="bg-gray-900 border border-gray-700 text-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-10 h-10 rounded-2xl bg-red-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">{t('sub.delete_confirm_title')}</h3>
                <p className="text-xs text-gray-400 font-mono">
                  {deletingSub.studentEmail} • Attempt #{deletingSub.attemptNumber || 1}
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              {t('sub.delete_confirm_desc')}
            </p>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingSub(null)}
                className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-medium text-sm transition-colors cursor-pointer"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSubmission}
                disabled={deletingSubLoading}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-red-500/20 disabled:opacity-50 cursor-pointer"
              >
                {deletingSubLoading ? t('common.processing') : t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
