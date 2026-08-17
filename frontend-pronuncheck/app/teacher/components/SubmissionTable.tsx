'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { SubmissionData, AssignmentData } from '@/app/lib/firestore';
import { getAudioUrl } from '@/app/lib/storage';
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

      // 3. Filter by Status
      if (selectedStatuses.length > 0) {
        const isPassed = sub.isPassed;
        const matchPassed = selectedStatuses.includes('passed') && isPassed;
        const matchFailed = selectedStatuses.includes('failed') && !isPassed;
        if (!matchPassed && !matchFailed) return false;
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
          const aAssign = assignmentMap.get(a.assignmentId);
          const bAssign = assignmentMap.get(b.assignmentId);
          aVal = (aAssign?.title || a.word).toLowerCase();
          bVal = (bAssign?.title || b.word).toLowerCase();
          break;
        }
        case 'attempt':
          aVal = a.attemptNumber || 0;
          bVal = b.attemptNumber || 0;
          break;
        case 'wav2vec':
          aVal = a.detailedScore.wav2vec_raw_score > 1 ? a.detailedScore.wav2vec_raw_score : a.detailedScore.wav2vec_raw_score * 100;
          bVal = b.detailedScore.wav2vec_raw_score > 1 ? b.detailedScore.wav2vec_raw_score : b.detailedScore.wav2vec_raw_score * 100;
          break;
        case 'dtw':
          aVal = (a.detailedScore.dtw_score ?? 80) > 1 ? (a.detailedScore.dtw_score ?? 80) : (a.detailedScore.dtw_score ?? 0.8) * 100;
          bVal = (b.detailedScore.dtw_score ?? 80) > 1 ? (b.detailedScore.dtw_score ?? 80) : (b.detailedScore.dtw_score ?? 0.8) * 100;
          break;
        case 'whisper':
          aVal = a.detailedScore.whisper_raw_score > 1 ? a.detailedScore.whisper_raw_score : a.detailedScore.whisper_raw_score * 100;
          bVal = b.detailedScore.whisper_raw_score > 1 ? b.detailedScore.whisper_raw_score : b.detailedScore.whisper_raw_score * 100;
          break;
        case 'total':
          aVal = a.detailedScore.hybrid_target_score > 1 ? a.detailedScore.hybrid_target_score : a.detailedScore.hybrid_target_score * 100;
          bVal = b.detailedScore.hybrid_target_score > 1 ? b.detailedScore.hybrid_target_score : b.detailedScore.hybrid_target_score * 100;
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
        alert('Không thể phát file ghi âm này.');
        setPlayingAudio(null);
      };
      await audio.play();
    } catch (error) {
      console.error(error);
      alert('Không thể tải audio từ bộ nhớ.');
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
    <div className="space-y-4" ref={popoverRef}>
      {/* Top Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-900/60 p-4 rounded-2xl border border-gray-700/70">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <span>📈</span> Kết quả học sinh
          </h3>
          <span className="text-xs bg-blue-500/20 text-blue-400 font-bold px-2.5 py-1 rounded-full border border-blue-500/30">
            {sortedSubmissions.length} / {submissions.length} bài nộp
          </span>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400">Đang lọc theo:</span>
            {selectedEmails.length > 0 && (
              <span className="text-xs bg-gray-800 border border-gray-700 text-blue-400 px-2 py-0.5 rounded-md flex items-center gap-1">
                Email ({selectedEmails.length})
                <X className="w-3 h-3 cursor-pointer hover:text-white" onClick={() => setSelectedEmails([])} />
              </span>
            )}
            {selectedAssignmentIds.length > 0 && (
              <span className="text-xs bg-gray-800 border border-gray-700 text-purple-400 px-2 py-0.5 rounded-md flex items-center gap-1">
                Bài tập ({selectedAssignmentIds.length})
                <X className="w-3 h-3 cursor-pointer hover:text-white" onClick={() => setSelectedAssignmentIds([])} />
              </span>
            )}
            {selectedStatuses.length > 0 && (
              <span className="text-xs bg-gray-800 border border-gray-700 text-green-400 px-2 py-0.5 rounded-md flex items-center gap-1">
                {selectedStatuses.map(s => s === 'passed' ? 'Đạt' : 'Chưa đạt').join(', ')}
                <X className="w-3 h-3 cursor-pointer hover:text-white" onClick={() => setSelectedStatuses([])} />
              </span>
            )}
            {sortField && (
              <span className="text-xs bg-gray-800 border border-gray-700 text-yellow-400 px-2 py-0.5 rounded-md flex items-center gap-1">
                Sắp xếp: {sortField} ({sortDirection})
                <X className="w-3 h-3 cursor-pointer hover:text-white" onClick={() => setSortField(null)} />
              </span>
            )}

            <button
              onClick={handleResetFilters}
              className="text-xs text-red-400 hover:text-red-300 hover:bg-red-400/10 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer ml-1"
            >
              <RotateCcw className="w-3 h-3" /> Đặt lại
            </button>
          </div>
        )}
      </div>

      {/* Table Container */}
      <div className="relative overflow-x-auto rounded-2xl border border-gray-700 shadow-xl bg-gray-900/40">
        <table className="w-full text-sm text-left text-gray-300">
          <thead className="text-xs text-gray-300 uppercase bg-gray-900/90 border-b border-gray-700 select-none">
            <tr>
              {/* Cột 1: Email Học sinh */}
              <th scope="col" className="px-5 py-4 min-w-[200px]">
                <div className="flex items-center justify-between gap-2">
                  <button 
                    onClick={() => handleSort('email')}
                    className="flex items-center gap-1.5 font-bold hover:text-white group cursor-pointer"
                  >
                    <span>Email học sinh</span>
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
                      title="Lọc theo email học sinh"
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
                            placeholder="Tìm email..."
                            className="bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none w-full"
                          />
                        </div>

                        <div className="flex justify-between text-xs text-blue-400 font-medium mb-2 px-1">
                          <button 
                            type="button" 
                            onClick={() => setSelectedEmails(uniqueEmails)}
                            className="hover:underline cursor-pointer"
                          >
                            Chọn tất cả
                          </button>
                          <button 
                            type="button" 
                            onClick={() => setSelectedEmails([])}
                            className="hover:underline text-gray-400 cursor-pointer"
                          >
                            Bỏ chọn
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
                    <span>Bài tập / Từ đọc</span>
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
                      title="Lọc theo bài tập"
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
                            placeholder="Tìm bài tập..."
                            className="bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none w-full"
                          />
                        </div>

                        <div className="flex justify-between text-xs text-purple-400 font-medium mb-2 px-1">
                          <button 
                            type="button" 
                            onClick={() => setSelectedAssignmentIds(assignments.map(a => a.id!).filter(Boolean))}
                            className="hover:underline cursor-pointer"
                          >
                            Chọn tất cả
                          </button>
                          <button 
                            type="button" 
                            onClick={() => setSelectedAssignmentIds([])}
                            className="hover:underline text-gray-400 cursor-pointer"
                          >
                            Bỏ chọn
                          </button>
                        </div>

                        <div className="max-h-52 overflow-y-auto space-y-1 pr-1 text-xs">
                          {assignments
                            .filter(a => {
                              const q = assignmentSearchQuery.toLowerCase();
                              return (a.title && a.title.toLowerCase().includes(q)) || a.word.toLowerCase().includes(q);
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
                                  className="w-4 h-4 mt-0.5 rounded border-gray-600 bg-gray-900 text-purple-500 focus:ring-0 shrink-0"
                                />
                                <div className="min-w-0">
                                  {a.title && <p className="font-bold text-white truncate">{a.title}</p>}
                                  <p className="font-mono text-gray-400 text-[11px] truncate">{a.word}</p>
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
              <th scope="col" className="px-3 py-4 text-center whitespace-nowrap">
                <button 
                  onClick={() => handleSort('attempt')}
                  className="inline-flex items-center gap-1 font-bold hover:text-white group cursor-pointer"
                >
                  <span>Lần thử</span>
                  {renderSortIcon('attempt')}
                </button>
              </th>

              {/* Cột 4: Điểm Âm vị */}
              <th scope="col" className="px-4 py-4 text-center whitespace-nowrap" title="Độ chuẩn xác âm vị (Wav2Vec2 + Luật ngữ âm Đức)">
                <button 
                  onClick={() => handleSort('wav2vec')}
                  className="inline-flex items-center gap-1 font-bold hover:text-blue-300 text-blue-400 group cursor-pointer"
                >
                  <span>Âm vị</span>
                  {renderSortIcon('wav2vec')}
                </button>
              </th>

              {/* Cột 5: Điểm Ngữ điệu */}
              <th scope="col" className="px-4 py-4 text-center whitespace-nowrap" title="So khớp cao độ ngữ điệu (F0 FastDTW)">
                <button 
                  onClick={() => handleSort('dtw')}
                  className="inline-flex items-center gap-1 font-bold hover:text-purple-300 text-purple-400 group cursor-pointer"
                >
                  <span>Ngữ điệu</span>
                  {renderSortIcon('dtw')}
                </button>
              </th>

              {/* Cột 6: Whisper */}
              <th scope="col" className="px-4 py-4 text-center whitespace-nowrap" title="Độ trọn vẹn nhận diện (Faster-Whisper Tiny)">
                <button 
                  onClick={() => handleSort('whisper')}
                  className="inline-flex items-center gap-1 font-bold hover:text-gray-100 group cursor-pointer"
                >
                  <span>Whisper</span>
                  {renderSortIcon('whisper')}
                </button>
              </th>

              {/* Cột 7: Tổng kết */}
              <th scope="col" className="px-4 py-4 text-center whitespace-nowrap" title="Điểm tổng hợp Dynamic Sigmoid">
                <button 
                  onClick={() => handleSort('total')}
                  className="inline-flex items-center gap-1 font-bold hover:text-white text-white group cursor-pointer"
                >
                  <span>Tổng kết</span>
                  {renderSortIcon('total')}
                </button>
              </th>

              {/* Cột 8: Kết quả (Filter Đạt/Chưa đạt) */}
              <th scope="col" className="px-4 py-4 text-center whitespace-nowrap min-w-[130px]">
                <div className="inline-flex items-center justify-center gap-1.5">
                  <button 
                    onClick={() => handleSort('result')}
                    className="flex items-center gap-1 font-bold hover:text-white group cursor-pointer"
                  >
                    <span>Kết quả</span>
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
                      title="Lọc theo trạng thái Đạt/Chưa đạt"
                    >
                      <Filter className="w-3.5 h-3.5" />
                    </button>

                    {/* Popover Filter Status */}
                    {activePopover === 'status' && (
                      <div className="absolute right-0 mt-2 w-44 bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-3 z-50 normal-case text-left">
                        <p className="text-xs font-semibold text-gray-400 mb-2 px-1">Lọc kết quả:</p>
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
                              <CheckCircle2 className="w-3.5 h-3.5" /> Đạt
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
                              <XCircle className="w-3.5 h-3.5" /> Chưa đạt
                            </span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </th>

              {/* Cột 9: Nghe Audio */}
              <th scope="col" className="px-4 py-4 text-center whitespace-nowrap">
                Nghe
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-800">
            {sortedSubmissions.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                  {submissions.length === 0 
                    ? 'Lớp học chưa có bài nộp nào.' 
                    : 'Không tìm thấy bài nộp nào phù hợp với bộ lọc hiện tại.'}
                </td>
              </tr>
            ) : (
              sortedSubmissions.map(sub => {
                const assignment = assignmentMap.get(sub.assignmentId);
                const maxAttempts = assignment?.maxAttempts || 1;

                const wav2vecScore = sub.detailedScore.wav2vec_raw_score > 1 
                  ? sub.detailedScore.wav2vec_raw_score 
                  : sub.detailedScore.wav2vec_raw_score * 100;

                const dtwScore = (sub.detailedScore.dtw_score ?? 80) > 1 
                  ? (sub.detailedScore.dtw_score ?? 80) 
                  : (sub.detailedScore.dtw_score ?? 0.8) * 100;

                const whisperScore = sub.detailedScore.whisper_raw_score > 1 
                  ? sub.detailedScore.whisper_raw_score 
                  : sub.detailedScore.whisper_raw_score * 100;

                const totalScore = sub.detailedScore.hybrid_target_score > 1 
                  ? sub.detailedScore.hybrid_target_score 
                  : sub.detailedScore.hybrid_target_score * 100;

                return (
                  <tr key={sub.id} className="bg-gray-800/40 hover:bg-gray-800/80 transition-colors">
                    {/* Email */}
                    <td className="px-5 py-4 font-medium text-white whitespace-nowrap">
                      {sub.studentEmail}
                    </td>

                    {/* Từ / Bài tập */}
                    <td className="px-5 py-4">
                      {assignment?.title ? (
                        <div className="space-y-0.5">
                          <p className="font-bold text-white">{assignment.title}</p>
                          <p className="text-xs font-mono text-gray-400 truncate max-w-xs" title={sub.word}>
                            {sub.word}
                          </p>
                        </div>
                      ) : (
                        <p className="font-mono text-gray-200 font-medium">{sub.word}</p>
                      )}
                    </td>

                    {/* Lần thử */}
                    <td className="px-3 py-4 text-center whitespace-nowrap text-gray-300 font-mono">
                      {sub.attemptNumber} / {maxAttempts}
                    </td>

                    {/* Âm vị */}
                    <td className="px-4 py-4 text-center font-semibold text-blue-400 whitespace-nowrap">
                      {wav2vecScore.toFixed(1)}%
                    </td>

                    {/* Ngữ điệu */}
                    <td className="px-4 py-4 text-center font-semibold text-purple-400 whitespace-nowrap">
                      {dtwScore.toFixed(1)}%
                    </td>

                    {/* Whisper */}
                    <td className="px-4 py-4 text-center text-gray-300 whitespace-nowrap">
                      {whisperScore.toFixed(1)}%
                    </td>

                    {/* Tổng kết */}
                    <td className="px-4 py-4 text-center font-bold text-white text-base whitespace-nowrap">
                      {totalScore.toFixed(1)}%
                    </td>

                    {/* Kết quả (SỬA DỨT ĐIỂM LỖI NGẮT DÒNG) */}
                    <td className="px-4 py-4 text-center whitespace-nowrap">
                      <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap tracking-wide border ${
                        sub.isPassed 
                          ? 'bg-green-500/20 text-green-400 border-green-500/40 shadow-sm shadow-green-500/10' 
                          : 'bg-red-500/20 text-red-400 border-red-500/40 shadow-sm shadow-red-500/10'
                      }`}>
                        {sub.isPassed ? 'Đạt' : 'Chưa đạt'}
                      </span>
                    </td>

                    {/* Nút nghe */}
                    <td className="px-4 py-4 text-center whitespace-nowrap">
                      <button
                        onClick={() => handlePlayAudio(sub.audioStoragePath)}
                        disabled={playingAudio === sub.audioStoragePath}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                          playingAudio === sub.audioStoragePath
                            ? 'bg-blue-600 border-blue-400 text-white animate-pulse'
                            : 'bg-gray-800 border-gray-700 text-gray-300 hover:text-white hover:bg-gray-700 hover:border-gray-600'
                        }`}
                        title="Nghe file ghi âm của học sinh"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
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
