'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { SubmissionData, AssignmentData } from '@/app/lib/firestore';
import { getAudioUrl } from '@/app/lib/storage';
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
  XCircle 
} from 'lucide-react';

interface SubmissionTableProps {
  submissions: SubmissionData[];
  assignments: AssignmentData[];
}

type SortField = 'email' | 'word' | 'attempt' | 'wav2vec' | 'dtw' | 'whisper' | 'total' | 'result';
type SortDirection = 'asc' | 'desc';

export default function SubmissionTable({ submissions, assignments }: SubmissionTableProps) {
  const { t } = useLanguage();
  const { error: toastError } = useToast();
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);

  // Sorting State
  const [sortField, setSortField] = useState<SortField | null>(null);
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
        case 'attempt':
          aVal = a.attemptNumber || 1;
          bVal = b.attemptNumber || 1;
          break;
        case 'wav2vec':
          aVal = a.detailedScore?.wav2vec_score || a.scores?.phoneme_score || 0;
          bVal = b.detailedScore?.wav2vec_score || b.scores?.phoneme_score || 0;
          break;
        case 'dtw':
          aVal = a.detailedScore?.dtw_score || a.scores?.dtw_score || 0;
          bVal = b.detailedScore?.dtw_score || b.scores?.dtw_score || 0;
          break;
        case 'whisper':
          aVal = a.detailedScore?.whisper_score || a.scores?.whisper_score || 0;
          bVal = b.detailedScore?.whisper_score || b.scores?.whisper_score || 0;
          break;
        case 'total':
          aVal = a.detailedScore?.hybrid_target_score 
            ? (a.detailedScore.hybrid_target_score > 1 ? a.detailedScore.hybrid_target_score : a.detailedScore.hybrid_target_score * 100)
            : (a.scores?.total_score ? a.scores.total_score * 100 : 0);
          bVal = b.detailedScore?.hybrid_target_score 
            ? (b.detailedScore.hybrid_target_score > 1 ? b.detailedScore.hybrid_target_score : b.detailedScore.hybrid_target_score * 100)
            : (b.scores?.total_score ? b.scores.total_score * 100 : 0);
          break;
        case 'result':
          aVal = a.isPassed ? 1 : 0;
          bVal = b.isPassed ? 1 : 0;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredSubmissions, sortField, sortDirection, assignmentMap]);

  const handlePlayAudio = async (storagePath: string) => {
    try {
      const url = await getAudioUrl(storagePath);
      const audio = new Audio(url);
      setPlayingAudio(storagePath);
      audio.onended = () => setPlayingAudio(null);
      audio.onerror = () => {
        toastError(t('sub.play_error'));
        setPlayingAudio(null);
      };
      await audio.play();
    } catch (error) {
      console.error(error);
      toastError(t('sub.play_error'));
      setPlayingAudio(null);
    }
  };

  const hasActiveFilters = selectedEmails.length > 0 || selectedAssignmentIds.length > 0 || selectedStatuses.length > 0 || sortField !== null;

  const handleResetFilters = () => {
    setSelectedEmails([]);
    setSelectedAssignmentIds([]);
    setSelectedStatuses([]);
    setSortField(null);
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
    <div className="space-y-4 w-full max-w-full min-w-0" ref={popoverRef}>
      {/* Top Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-900/80 p-4 rounded-2xl border border-gray-700/80">
        <div className="flex items-center gap-3">
          <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <span>📈</span> {t('sub.title')}
          </h3>
          <span className="text-xs bg-blue-500/20 text-blue-400 font-bold px-2.5 py-1 rounded-full border border-blue-500/30">
            {sortedSubmissions.length} / {submissions.length} {t('sub.submissions_count')}
          </span>
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
                <X className="w-3 h-3 cursor-pointer hover:text-white" onClick={() => setSortField(null)} />
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
              {/* Cột 1: Email Học sinh */}
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
                            value={emailSearchQuery}
                            onChange={e => setEmailSearchQuery(e.target.value)}
                            placeholder={t('sub.search_email')}
                            className="bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none w-full"
                          />
                        </div>

                        <div className="flex justify-between text-xs text-blue-400 font-medium mb-2 px-1">
                          <button 
                            type="button" 
                            onClick={() => setSelectedEmails(uniqueEmails)}
                            className="hover:underline cursor-pointer"
                          >
                            {t('sub.select_all')}
                          </button>
                          <button 
                            type="button" 
                            onClick={() => setSelectedEmails([])}
                            className="hover:underline text-gray-400 cursor-pointer"
                          >
                            {t('sub.deselect_all')}
                          </button>
                        </div>

                        <div className="max-h-48 overflow-y-auto space-y-1 pr-1 text-xs">
                          {uniqueEmails
                            .filter(em => em.toLowerCase().includes(emailSearchQuery.toLowerCase()))
                            .map(em => (
                              <label key={em} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-700/60 rounded-lg cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedEmails.includes(em)}
                                  onChange={e => {
                                    if (e.target.checked) {
                                      setSelectedEmails(prev => [...prev, em]);
                                    } else {
                                      setSelectedEmails(prev => prev.filter(x => x !== em));
                                    }
                                  }}
                                  className="w-4 h-4 rounded border-gray-600 bg-gray-900 text-blue-500 focus:ring-0"
                                />
                                <span className="truncate text-gray-200" title={em}>{em}</span>
                              </label>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </th>

              {/* Cột 2: Bài tập / Từ cần đọc */}
              <th scope="col" className="px-5 py-4 min-w-[200px]">
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
                            value={assignmentSearchQuery}
                            onChange={e => setAssignmentSearchQuery(e.target.value)}
                            placeholder={t('sub.search_assignment')}
                            className="bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none w-full"
                          />
                        </div>

                        <div className="flex justify-between text-xs text-purple-400 font-medium mb-2 px-1">
                          <button 
                            type="button" 
                            onClick={() => setSelectedAssignmentIds(assignments.map(a => a.id!).filter(Boolean))}
                            className="hover:underline cursor-pointer"
                          >
                            {t('sub.select_all')}
                          </button>
                          <button 
                            type="button" 
                            onClick={() => setSelectedAssignmentIds([])}
                            className="hover:underline text-gray-400 cursor-pointer"
                          >
                            {t('sub.deselect_all')}
                          </button>
                        </div>

                        <div className="max-h-48 overflow-y-auto space-y-1 pr-1 text-xs">
                          {assignments
                            .filter(a => {
                              const text = `${a.title || ''} ${a.word}`.toLowerCase();
                              return text.includes(assignmentSearchQuery.toLowerCase());
                            })
                            .map(a => (
                              <label key={a.id} className="flex items-start gap-2 px-2 py-1.5 hover:bg-gray-700/60 rounded-lg cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedAssignmentIds.includes(a.id!)}
                                  onChange={e => {
                                    if (e.target.checked) {
                                      setSelectedAssignmentIds(prev => [...prev, a.id!]);
                                    } else {
                                      setSelectedAssignmentIds(prev => prev.filter(x => x !== a.id));
                                    }
                                  }}
                                  className="w-4 h-4 mt-0.5 rounded border-gray-600 bg-gray-900 text-purple-500 focus:ring-0"
                                />
                                <div className="min-w-0">
                                  {a.title ? (
                                    <>
                                      <p className="font-bold text-white truncate">{a.title}</p>
                                      <p className="font-mono text-gray-400 text-[11px] truncate">{a.word}</p>
                                    </>
                                  ) : (
                                    <p className="font-mono text-white truncate">{a.word}</p>
                                  )}
                                </div>
                              </label>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </th>

              {/* Cột 3: Lần thử */}
              <th scope="col" className="px-4 py-4 text-center min-w-[90px]">
                <button 
                  onClick={() => handleSort('attempt')}
                  className="inline-flex items-center gap-1 font-bold hover:text-white group cursor-pointer"
                >
                  <span>{t('sub.th_attempt')}</span>
                  {renderSortIcon('attempt')}
                </button>
              </th>

              {/* Cột 4: Điểm Âm vị */}
              <th scope="col" className="px-4 py-4 text-center min-w-[100px]">
                <button 
                  onClick={() => handleSort('wav2vec')}
                  className="inline-flex items-center gap-1 font-bold hover:text-white group cursor-pointer"
                >
                  <span>{t('sub.th_phoneme')}</span>
                  {renderSortIcon('wav2vec')}
                </button>
              </th>

              {/* Cột 5: Điểm Ngữ điệu */}
              <th scope="col" className="px-4 py-4 text-center min-w-[100px]">
                <button 
                  onClick={() => handleSort('dtw')}
                  className="inline-flex items-center gap-1 font-bold hover:text-white group cursor-pointer"
                >
                  <span>{t('sub.th_intonation')}</span>
                  {renderSortIcon('dtw')}
                </button>
              </th>

              {/* Cột 6: Điểm Whisper */}
              <th scope="col" className="px-4 py-4 text-center min-w-[100px]">
                <button 
                  onClick={() => handleSort('whisper')}
                  className="inline-flex items-center gap-1 font-bold hover:text-white group cursor-pointer"
                >
                  <span>{t('sub.th_whisper')}</span>
                  {renderSortIcon('whisper')}
                </button>
              </th>

              {/* Cột 7: Điểm Tổng kết */}
              <th scope="col" className="px-4 py-4 text-center min-w-[110px]">
                <button 
                  onClick={() => handleSort('total')}
                  className="inline-flex items-center gap-1 font-bold text-yellow-400 hover:text-yellow-300 group cursor-pointer"
                >
                  <span>{t('sub.th_total')}</span>
                  {renderSortIcon('total')}
                </button>
              </th>

              {/* Cột 8: Kết quả (Đạt / Chưa đạt) */}
              <th scope="col" className="px-5 py-4 text-center min-w-[130px]">
                <div className="flex items-center justify-center gap-2">
                  <button 
                    onClick={() => handleSort('result')}
                    className="flex items-center gap-1.5 font-bold hover:text-white group cursor-pointer"
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

                    {/* Popover Filter Result Status */}
                    {activePopover === 'status' && (
                      <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-3 z-50 normal-case">
                        <div className="space-y-1.5 text-xs">
                          <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-700/60 rounded-lg cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedStatuses.includes('passed')}
                              onChange={e => {
                                if (e.target.checked) {
                                  setSelectedStatuses(prev => [...prev, 'passed']);
                                } else {
                                  setSelectedStatuses(prev => prev.filter(x => x !== 'passed'));
                                }
                              }}
                              className="w-4 h-4 rounded border-gray-600 bg-gray-900 text-green-500 focus:ring-0"
                            />
                            <span className="text-green-400 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> {t('practice.status_passed')}
                            </span>
                          </label>

                          <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-700/60 rounded-lg cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedStatuses.includes('failed')}
                              onChange={e => {
                                if (e.target.checked) {
                                  setSelectedStatuses(prev => [...prev, 'failed']);
                                } else {
                                  setSelectedStatuses(prev => prev.filter(x => x !== 'failed'));
                                }
                              }}
                              className="w-4 h-4 rounded border-gray-600 bg-gray-900 text-red-500 focus:ring-0"
                            />
                            <span className="text-red-400 font-bold flex items-center gap-1">
                              <XCircle className="w-3.5 h-3.5" /> {t('practice.status_failed')}
                            </span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </th>

              {/* Cột 9: Audio */}
              <th scope="col" className="px-4 py-4 text-center min-w-[80px]">
                {t('sub.th_listen')}
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-800/80">
            {sortedSubmissions.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                  {submissions.length === 0 ? t('sub.no_submissions') : t('sub.no_filter_match')}
                </td>
              </tr>
            ) : (
              sortedSubmissions.map((sub) => {
                const assignment = assignmentMap.get(sub.assignmentId);
                const phonemeScore = sub.detailedScore?.wav2vec_score ?? sub.scores?.phoneme_score ?? 0;
                const dtwScore = sub.detailedScore?.dtw_score ?? sub.scores?.dtw_score ?? 0;
                const whisperScore = sub.detailedScore?.whisper_score ?? sub.scores?.whisper_score ?? 0;
                
                let totalScore = 0;
                if (sub.detailedScore?.hybrid_target_score !== undefined) {
                  totalScore = sub.detailedScore.hybrid_target_score > 1 
                    ? sub.detailedScore.hybrid_target_score 
                    : sub.detailedScore.hybrid_target_score * 100;
                } else if (sub.scores?.total_score !== undefined) {
                  totalScore = sub.scores.total_score * 100;
                }

                return (
                  <tr key={sub.id} className="hover:bg-gray-800/40 transition-colors">
                    {/* 1. Email */}
                    <td className="px-5 py-4 font-medium text-white truncate max-w-[220px]" title={sub.studentEmail}>
                      {sub.studentEmail}
                    </td>

                    {/* 2. Assignment / Word */}
                    <td className="px-5 py-4 max-w-[220px]">
                      {assignment?.title ? (
                        <div>
                          <p className="font-bold text-white truncate" title={assignment.title}>
                            {assignment.title}
                          </p>
                          <p className="font-mono text-gray-400 text-xs truncate" title={sub.word}>
                            {sub.word}
                          </p>
                        </div>
                      ) : (
                        <p className="font-mono text-white font-medium truncate" title={sub.word}>
                          {sub.word}
                        </p>
                      )}
                    </td>

                    {/* 3. Attempt */}
                    <td className="px-4 py-4 text-center font-mono text-gray-400">
                      {sub.attemptNumber ? `${sub.attemptNumber} / ${assignment?.maxAttempts || 3}` : '1'}
                    </td>

                    {/* 4. Phoneme Score */}
                    <td className="px-4 py-4 text-center font-mono font-bold text-blue-400 whitespace-nowrap">
                      {phonemeScore > 1 ? phonemeScore.toFixed(1) : (phonemeScore * 100).toFixed(1)}%
                    </td>

                    {/* 5. DTW Score */}
                    <td className="px-4 py-4 text-center font-mono text-gray-300 whitespace-nowrap">
                      {dtwScore > 1 ? dtwScore.toFixed(1) : (dtwScore * 100).toFixed(1)}%
                    </td>

                    {/* 6. Whisper Score */}
                    <td className="px-4 py-4 text-center font-mono text-gray-300 whitespace-nowrap">
                      {whisperScore > 1 ? whisperScore.toFixed(1) : (whisperScore * 100).toFixed(1)}%
                    </td>

                    {/* 7. Total Score */}
                    <td className="px-4 py-4 text-center font-mono font-black text-lime-400 whitespace-nowrap">
                      {totalScore.toFixed(1)}%
                    </td>

                    {/* 8. Result Status (Protected Against Wrap) */}
                    <td className="px-5 py-4 text-center whitespace-nowrap">
                      {sub.isPassed ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-500/15 text-green-400 border border-green-500/30 whitespace-nowrap">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>{t('practice.status_passed')}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-500/15 text-red-400 border border-red-500/30 whitespace-nowrap">
                          <XCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{t('practice.status_failed')}</span>
                        </span>
                      )}
                    </td>

                    {/* 9. Audio Player */}
                    <td className="px-4 py-4 text-center">
                      {sub.audioUrl ? (
                        <button
                          onClick={() => handlePlayAudio(sub.audioUrl)}
                          className={`p-2 rounded-xl border transition-all cursor-pointer ${
                            playingAudio === sub.audioUrl
                              ? 'bg-blue-600 text-white border-blue-500 scale-105'
                              : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-700 hover:text-white'
                          }`}
                          title={t('sub.th_listen')}
                        >
                          <Volume2 className="w-4 h-4" />
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
