'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { SubmissionData, AssignmentData, ClassData } from '@/app/lib/firestore';
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
  Pause,
  Play,
  Loader2,
  X, 
  CheckCircle2, 
  XCircle,
  Calendar,
  FileSpreadsheet
} from 'lucide-react';

import StudentAnalyticsDashboard from '@/app/teacher/components/StudentAnalyticsDashboard';

interface SubmissionTableProps {
  submissions: SubmissionData[];
  assignments: AssignmentData[];
  classData?: ClassData | null;
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

export default function SubmissionTable({ submissions, assignments, classData }: SubmissionTableProps) {
  const { t } = useLanguage();
  const { success, error: toastError } = useToast();

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

  // Audio Playback State
  const [playingSubId, setPlayingSubId] = useState<string | null>(null);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);
  const audioInstanceRef = useRef<HTMLAudioElement | null>(null);

  // Sorting State - Default sort by 'time' descending
  const [sortField, setSortField] = useState<SortField | null>('time');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Filter States
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [emailSearchQuery, setEmailSearchQuery] = useState('');
  
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<string[]>([]);
  const [assignmentSearchQuery, setAssignmentSearchQuery] = useState('');
  
  const [selectedStatuses, setSelectedStatuses] = useState<('passed' | 'failed')[]>([]);

  // Active Popover Menu: 'email' | 'assignment' | 'status' | null
  const [activePopover, setActivePopover] = useState<'email' | 'assignment' | 'status' | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Click outside to close popover
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setActivePopover(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Stop audio on unmount
  useEffect(() => {
    return () => {
      if (audioInstanceRef.current) {
        audioInstanceRef.current.pause();
        audioInstanceRef.current = null;
      }
    };
  }, []);

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
      // 1. Filter by Email
      if (selectedEmails.length > 0 && !selectedEmails.includes(sub.studentEmail)) {
        return false;
      }

      // 2. Filter by Assignment
      if (selectedAssignmentIds.length > 0 && !selectedAssignmentIds.includes(sub.assignmentId)) {
        return false;
      }

      // 3. Filter by Status (Passed / Failed)
      if (selectedStatuses.length > 0) {
        const isPassed = sub.isPassed;
        const matchesStatus = (selectedStatuses.includes('passed') && isPassed) ||
                              (selectedStatuses.includes('failed') && !isPassed);
        if (!matchesStatus) return false;
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
        case 'time': {
          const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
          const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
          aVal = aTime;
          bVal = bTime;
          break;
        }
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

  // Unified audio player function supporting both URL and Storage Path
  const handlePlayAudio = async (sub: SubmissionData) => {
    const subId = sub.id || `${sub.assignmentId}_${sub.studentId}_${sub.attemptNumber}`;

    // If already playing this audio, pause it
    if (playingSubId === subId) {
      if (audioInstanceRef.current) {
        audioInstanceRef.current.pause();
        audioInstanceRef.current = null;
      }
      setPlayingSubId(null);
      return;
    }

    // Stop current audio if playing another
    if (audioInstanceRef.current) {
      audioInstanceRef.current.pause();
      audioInstanceRef.current = null;
    }

    const audioPathOrUrl = sub.audioUrl || sub.audioStoragePath || (sub as any).audioPath;
    if (!audioPathOrUrl) {
      toastError(t('sub.play_error'));
      return;
    }

    setLoadingAudioId(subId);

    try {
      const url = await getAudioUrl(audioPathOrUrl);
      if (!url) throw new Error('No audio URL found');

      const audio = new Audio(url);
      audioInstanceRef.current = audio;

      audio.onended = () => {
        setPlayingSubId(null);
        audioInstanceRef.current = null;
      };

      audio.onerror = () => {
        toastError(t('sub.play_error'));
        setPlayingSubId(null);
        setLoadingAudioId(null);
        audioInstanceRef.current = null;
      };

      await audio.play();
      setPlayingSubId(subId);
    } catch (error) {
      console.error('Play audio error:', error);
      toastError(t('sub.play_error'));
      setPlayingSubId(null);
    } finally {
      setLoadingAudioId(null);
    }
  };

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

      {/* Table Container - Overflow Horizontal Protected */}
      <div className="relative overflow-x-auto rounded-3xl border border-gray-700/80 shadow-2xl bg-gray-900/50 w-full max-w-full">
        <table className="w-full text-xs sm:text-sm text-left text-gray-300">
          <thead className="text-[11px] sm:text-xs text-gray-300 uppercase bg-gray-900/95 border-b border-gray-700 select-none whitespace-nowrap">
            <tr>
              {/* Col 1: Email */}
              <th scope="col" className="px-5 py-4 min-w-[200px]">
                <div className="flex items-center justify-between gap-2">
                  <button 
                    onClick={() => handleSort('email')}
                    className="flex items-center gap-1.5 font-bold hover:text-white group cursor-pointer"
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
                        <div className="flex justify-between text-[11px] text-blue-400 pb-1.5 border-b border-gray-700 mb-1.5 font-medium">
                          <button 
                            onClick={() => setSelectedEmails(uniqueEmails)}
                            className="hover:underline cursor-pointer"
                          >
                            {t('sub.select_all')}
                          </button>
                          <button 
                            onClick={() => setSelectedEmails([])}
                            className="hover:underline cursor-pointer"
                          >
                            {t('sub.deselect_all')}
                          </button>
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-1">
                          {uniqueEmails
                            .filter(email => email.toLowerCase().includes(emailSearchQuery.toLowerCase()))
                            .map((email) => {
                              const isChecked = selectedEmails.includes(email);
                              return (
                                <label 
                                  key={email}
                                  className="flex items-center gap-2 p-1.5 hover:bg-gray-700 rounded-lg cursor-pointer text-xs text-gray-200"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedEmails([...selectedEmails, email]);
                                      } else {
                                        setSelectedEmails(selectedEmails.filter(e => e !== email));
                                      }
                                    }}
                                    className="rounded bg-gray-900 border-gray-600 text-blue-600 focus:ring-0"
                                  />
                                  <span className="truncate">{email}</span>
                                </label>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </th>

              {/* Col 2: Assignment / Word */}
              <th scope="col" className="px-5 py-4 min-w-[220px]">
                <div className="flex items-center justify-between gap-2">
                  <button 
                    onClick={() => handleSort('word')}
                    className="flex items-center gap-1.5 font-bold hover:text-white group cursor-pointer"
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
                        <div className="flex justify-between text-[11px] text-purple-400 pb-1.5 border-b border-gray-700 mb-1.5 font-medium">
                          <button 
                            onClick={() => setSelectedAssignmentIds(assignments.map(a => a.id!).filter(Boolean))}
                            className="hover:underline cursor-pointer"
                          >
                            {t('sub.select_all')}
                          </button>
                          <button 
                            onClick={() => setSelectedAssignmentIds([])}
                            className="hover:underline cursor-pointer"
                          >
                            {t('sub.deselect_all')}
                          </button>
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-1">
                          {assignments
                            .filter(a => {
                              const matchTitle = a.title && a.title.toLowerCase().includes(assignmentSearchQuery.toLowerCase());
                              const matchWord = a.word && a.word.toLowerCase().includes(assignmentSearchQuery.toLowerCase());
                              return matchTitle || matchWord;
                            })
                            .map((a) => {
                              const isChecked = selectedAssignmentIds.includes(a.id!);
                              return (
                                <label 
                                  key={a.id}
                                  className="flex items-center gap-2 p-1.5 hover:bg-gray-700 rounded-lg cursor-pointer text-xs text-gray-200"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedAssignmentIds([...selectedAssignmentIds, a.id!]);
                                      } else {
                                        setSelectedAssignmentIds(selectedAssignmentIds.filter(id => id !== a.id));
                                      }
                                    }}
                                    className="rounded bg-gray-900 border-gray-600 text-purple-600 focus:ring-0"
                                  />
                                  <div className="truncate">
                                    {a.title && <span className="font-bold block">{a.title}</span>}
                                    <span className="font-mono text-gray-400">{a.word}</span>
                                  </div>
                                </label>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </th>

              {/* Col 3: Time of Submission */}
              <th scope="col" className="px-4 py-4 text-center min-w-[140px]">
                <button 
                  onClick={() => handleSort('time')}
                  className="inline-flex items-center gap-1.5 font-bold hover:text-white group cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  <span>{t('sub.th_time')}</span>
                  {renderSortIcon('time')}
                </button>
              </th>

              {/* Col 4: Attempt */}
              <th scope="col" className="px-4 py-4 text-center">
                <button 
                  onClick={() => handleSort('attempt')}
                  className="inline-flex items-center gap-1.5 font-bold hover:text-white group cursor-pointer"
                >
                  <span>{t('sub.th_attempt')}</span>
                  {renderSortIcon('attempt')}
                </button>
              </th>

              {/* Col 5: Phonetics */}
              <th scope="col" className="px-4 py-4 text-center">
                <button 
                  onClick={() => handleSort('wav2vec')}
                  className="inline-flex items-center gap-1.5 font-bold hover:text-white group cursor-pointer text-blue-400"
                >
                  <span>{t('sub.th_phoneme')}</span>
                  {renderSortIcon('wav2vec')}
                </button>
              </th>

              {/* Col 6: Intonation */}
              <th scope="col" className="px-4 py-4 text-center">
                <button 
                  onClick={() => handleSort('dtw')}
                  className="inline-flex items-center gap-1.5 font-bold hover:text-white group cursor-pointer text-purple-400"
                >
                  <span>{t('sub.th_intonation')}</span>
                  {renderSortIcon('dtw')}
                </button>
              </th>

              {/* Col 7: Completeness */}
              <th scope="col" className="px-4 py-4 text-center">
                <button 
                  onClick={() => handleSort('whisper')}
                  className="inline-flex items-center gap-1.5 font-bold hover:text-white group cursor-pointer text-pink-400"
                >
                  <span>{t('sub.th_whisper')}</span>
                  {renderSortIcon('whisper')}
                </button>
              </th>

              {/* Col 8: Overall Score */}
              <th scope="col" className="px-4 py-4 text-center">
                <button 
                  onClick={() => handleSort('total')}
                  className="inline-flex items-center gap-1.5 font-bold hover:text-white group cursor-pointer text-lime-400"
                >
                  <span>{t('sub.th_total')}</span>
                  {renderSortIcon('total')}
                </button>
              </th>

              {/* Col 9: Result Filter */}
              <th scope="col" className="px-5 py-4 text-center min-w-[130px]">
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

              {/* Col 10: Listen Audio */}
              <th scope="col" className="px-4 py-4 text-center">
                {t('sub.th_listen')}
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-800">
            {sortedSubmissions.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-6 py-12 text-center text-gray-500 font-medium">
                  {submissions.length === 0 ? t('sub.no_submissions') : t('sub.no_filter_match')}
                </td>
              </tr>
            ) : (
              sortedSubmissions.map((sub, idx) => {
                const subId = sub.id || `${sub.assignmentId}_${sub.studentId}_${sub.attemptNumber || idx}`;
                const assignment = assignmentMap.get(sub.assignmentId);

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

                const isAudioPlaying = playingSubId === subId;
                const isAudioLoading = loadingAudioId === subId;
                const hasAudio = Boolean(sub.audioUrl || sub.audioStoragePath || (sub as any).audioPath);

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
                  <tr 
                    key={subId} 
                    className="hover:bg-gray-800/40 transition-colors border-b border-gray-800/60"
                  >
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

                    {/* 3. Submitted At (Date & Time) */}
                    <td className="px-3 py-3 text-center font-mono text-[11px] text-gray-400 whitespace-nowrap">
                      {formattedTime}
                    </td>

                    {/* 4. Attempt */}
                    <td className="px-3 py-3 text-center font-mono text-xs text-gray-400">
                      {sub.attemptNumber ? `${sub.attemptNumber} / ${assignment?.maxAttempts || 3}` : '1'}
                    </td>

                    {/* 5. Phoneme Score */}
                    <td className="px-3 py-3 text-center font-mono font-bold text-blue-400 whitespace-nowrap text-xs sm:text-sm">
                      {phonemeScore}
                    </td>

                    {/* 6. DTW Score */}
                    <td className="px-3 py-3 text-center font-mono text-purple-400 whitespace-nowrap text-xs sm:text-sm">
                      {dtwScore}
                    </td>

                    {/* 7. Whisper Score */}
                    <td className="px-3 py-3 text-center font-mono text-pink-400 whitespace-nowrap text-xs sm:text-sm">
                      {whisperScore}
                    </td>

                    {/* 8. Total Score */}
                    <td className="px-3 py-3 text-center font-mono font-black text-lime-400 whitespace-nowrap text-sm sm:text-base">
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

                    {/* 10. Audio Player Button */}
                    <td className="px-3 py-3 text-center">
                      {hasAudio ? (
                        <button
                          type="button"
                          onClick={() => handlePlayAudio(sub)}
                          disabled={isAudioLoading}
                          className={`p-2 rounded-xl border transition-all cursor-pointer inline-flex items-center justify-center ${
                            isAudioPlaying
                              ? 'bg-lime-400 text-gray-950 border-lime-400 shadow-md shadow-lime-400/30 scale-105 animate-pulse'
                              : isAudioLoading
                              ? 'bg-gray-800 text-lime-400 border-gray-700'
                              : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-700 hover:text-white'
                          }`}
                          title={isAudioPlaying ? 'Pause' : t('sub.th_listen')}
                        >
                          {isAudioLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : isAudioPlaying ? (
                            <Pause className="w-3.5 h-3.5 fill-current" />
                          ) : (
                            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                          )}
                        </button>
                      ) : (
                        <span className="text-gray-600 text-xs">-</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
