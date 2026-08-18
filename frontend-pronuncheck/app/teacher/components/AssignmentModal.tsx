'use client';

import React, { useState, useEffect } from 'react';
import { 
  createAssignment, 
  updateAssignment, 
  AssignmentData, 
  ScoringConfig 
} from '@/app/lib/firestore';
import { uploadAudio } from '@/app/lib/storage';
import { Timestamp } from 'firebase/firestore';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useToast } from '@/app/contexts/ToastContext';
import { 
  X, 
  Save, 
  PlusCircle, 
  Edit3, 
  Sparkles, 
  Volume2, 
  Mic, 
  Sliders, 
  BookOpen, 
  Check, 
  Wand2, 
  HelpCircle,
  Play
} from 'lucide-react';
import { playGermanSpeech } from '@/app/lib/tts';
import TeacherRecordSampleModal from '@/app/teacher/components/TeacherRecordSampleModal';
import DynamicScoringGraph from '@/app/teacher/components/DynamicScoringGraph';
import DarkAudioPlayer from '@/app/components/DarkAudioPlayer';

interface AssignmentModalProps {
  classId: string;
  assignment?: AssignmentData | null; // If provided, edit mode; otherwise create mode
  classDefaultConfig?: ScoringConfig;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function getInitialDeadline(deadline: unknown): string {
  if (!deadline) return '';
  try {
    const d = deadline as { toDate?: () => Date; seconds?: number };
    const date = d.toDate 
      ? d.toDate() 
      : new Date(d.seconds ? d.seconds * 1000 : String(deadline));
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  } catch {
    return '';
  }
}

export default function AssignmentModal({
  classId,
  assignment,
  classDefaultConfig,
  isOpen,
  onClose,
  onSaved
}: AssignmentModalProps) {
  const { t } = useLanguage();
  const { success, error: toastError } = useToast();
  const isEditing = Boolean(assignment && assignment.id);

  // Active Sub-Tab: 'basic' | 'scoring'
  const [activeSubTab, setActiveSubTab] = useState<'basic' | 'scoring'>('basic');

  // Basic Info Form State
  const [title, setTitle] = useState('');
  const [word, setWord] = useState('');
  const [targetPhoneme, setTargetPhoneme] = useState('');
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [deadline, setDeadline] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Sample Audio State
  const [enableSampleAudio, setEnableSampleAudio] = useState(false);
  const [sampleAudioType, setSampleAudioType] = useState<'tts' | 'teacher_record'>('tts');
  const [teacherAudioBlob, setTeacherAudioBlob] = useState<Blob | null>(null);
  const [teacherAudioUrl, setTeacherAudioUrl] = useState<string | null>(null);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isPlayingTts, setIsPlayingTts] = useState(false);

  // Scoring Config State
  const [useCustomScoring, setUseCustomScoring] = useState(false);
  const [scoringMode, setScoringMode] = useState<'auto' | 'manual'>('auto');
  const [threshold, setThreshold] = useState<number>(0.6);
  const [L0, setL0] = useState<number>(4.5);
  const [k, setK] = useState<number>(0.85);

  const [loading, setLoading] = useState(false);

  // Populate form on open / mode change
  useEffect(() => {
    if (isOpen) {
      setActiveSubTab('basic');
      if (assignment) {
        // Edit mode
        setTitle(assignment.title || '');
        setWord(assignment.word || '');
        setTargetPhoneme(assignment.targetPhoneme || '');
        setMaxAttempts(assignment.maxAttempts || 3);
        setDeadline(getInitialDeadline(assignment.deadline));
        setIsActive(assignment.isActive !== false);

        setEnableSampleAudio(Boolean(assignment.enableSampleAudio));
        setSampleAudioType(assignment.sampleAudioType || 'tts');
        setTeacherAudioUrl(assignment.sampleAudioUrl || null);
        setTeacherAudioBlob(null);

        if (assignment.scoringConfig) {
          setUseCustomScoring(true);
          setScoringMode(assignment.scoringConfig.mode || 'auto');
          setThreshold(assignment.scoringConfig.threshold ?? 0.6);
          setL0(assignment.scoringConfig.L0 ?? 4.5);
          setK(assignment.scoringConfig.k ?? 0.85);
        } else {
          setUseCustomScoring(false);
          setScoringMode(classDefaultConfig?.mode || 'auto');
          setThreshold(classDefaultConfig?.threshold ?? 0.6);
          setL0(classDefaultConfig?.L0 ?? 4.5);
          setK(classDefaultConfig?.k ?? 0.85);
        }
      } else {
        // Create mode
        setTitle('');
        setWord('');
        setTargetPhoneme('auto');
        setMaxAttempts(3);
        setDeadline('');
        setIsActive(true);

        setEnableSampleAudio(false);
        setSampleAudioType('tts');
        setTeacherAudioBlob(null);
        setTeacherAudioUrl(null);

        setUseCustomScoring(false);
        setScoringMode(classDefaultConfig?.mode || 'auto');
        setThreshold(classDefaultConfig?.threshold ?? 0.6);
        setL0(classDefaultConfig?.L0 ?? 4.5);
        setK(classDefaultConfig?.k ?? 0.85);
      }
    }
  }, [isOpen, assignment, classDefaultConfig]);

  // Handle Play TTS Preview
  const handleTestTts = async () => {
    if (!word.trim()) {
      toastError('Vui lòng nhập từ/câu mục tiêu trước khi nghe thử TTS.');
      return;
    }
    setIsPlayingTts(true);
    try {
      await playGermanSpeech(word.trim(), 1.0);
    } catch (err) {
      console.error(err);
    } finally {
      setIsPlayingTts(false);
    }
  };

  // Handle Save / Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!word.trim()) {
      toastError('Vui lòng nhập từ / câu cần đọc.');
      return;
    }

    setLoading(true);
    try {
      let finalSampleUrl = teacherAudioUrl || undefined;
      let finalStoragePath = assignment?.sampleAudioStoragePath || undefined;

      // 1. If teacher recorded new audio blob, upload it to storage
      if (enableSampleAudio && sampleAudioType === 'teacher_record' && teacherAudioBlob) {
        const uploadRes = await uploadAudio({
          classId,
          assignmentId: assignment?.id || 'sample_temp',
          studentId: 'teacher_sample',
          blob: teacherAudioBlob
        });
        finalSampleUrl = uploadRes.downloadUrl;
        finalStoragePath = uploadRes.storagePath;
      }

      // 2. Build Scoring Config payload if custom
      const finalScoringConfig: ScoringConfig | undefined = useCustomScoring ? {
        threshold,
        passing_threshold: threshold,
        mode: scoringMode,
        L0,
        k,
        w1: 0.5,
        w2: 0.5
      } : undefined;

      const payload = {
        title: title.trim() || undefined,
        word: word.trim(),
        targetPhoneme: targetPhoneme.trim() || 'auto',
        maxAttempts: Number(maxAttempts),
        deadline: deadline ? Timestamp.fromDate(new Date(deadline)) : null,
        isActive,
        enableSampleAudio,
        sampleAudioType: enableSampleAudio ? sampleAudioType : undefined,
        sampleAudioUrl: enableSampleAudio ? finalSampleUrl : undefined,
        sampleAudioStoragePath: enableSampleAudio ? finalStoragePath : undefined,
        scoringConfig: finalScoringConfig
      };

      if (isEditing && assignment?.id) {
        await updateAssignment(classId, assignment.id, payload);
        success(t('assignment.updated_success'));
      } else {
        await createAssignment(classId, payload);
        success(t('assignment.created_success'));
      }

      onSaved();
      onClose();
    } catch (error: any) {
      console.error('Error saving assignment:', error);
      toastError(error.message || 'Có lỗi xảy ra khi lưu bài tập.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
        onClick={onClose}
      >
        <div
          className="bg-gray-900 border border-gray-700 text-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 relative max-h-[90vh] flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-800 pb-4 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                {isEditing ? <Edit3 className="w-5 h-5" /> : <PlusCircle className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">
                  {isEditing ? t('assignment.edit_title') : t('assignment.create_title')}
                </h3>
                <p className="text-xs text-gray-400">
                  {isEditing ? `ID: ${assignment?.id}` : 'Thiết lập nội dung và thuật toán chấm điểm'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Sub-Tab Navigation Bar */}
          <div className="flex space-x-2 border-b border-gray-800 pb-px shrink-0">
            <button
              type="button"
              onClick={() => setActiveSubTab('basic')}
              className={`py-2.5 px-4 font-bold text-xs sm:text-sm rounded-t-xl transition-all flex items-center gap-2 cursor-pointer ${
                activeSubTab === 'basic'
                  ? 'border-b-2 border-blue-500 text-blue-400 bg-gray-800/80 shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>1. Thông số bài tập & Audio mẫu</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('scoring')}
              className={`py-2.5 px-4 font-bold text-xs sm:text-sm rounded-t-xl transition-all flex items-center gap-2 cursor-pointer ${
                activeSubTab === 'scoring'
                  ? 'border-b-2 border-purple-500 text-purple-400 bg-gray-800/80 shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>2. Cấu hình Chấm điểm AI</span>
              {useCustomScoring && (
                <span className="w-2 h-2 rounded-full bg-purple-400"></span>
              )}
            </button>
          </div>

          {/* Form Body (Scrollable) */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-1 space-y-5 scrollbar-thin">
            {/* TAB 1: Basic Information & Sample Audio */}
            {activeSubTab === 'basic' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                {/* 1. Title */}
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1.5">
                    {t('assignment.name')} <span className="text-[11px] text-gray-500 font-normal">{t('assignment.name_hint')}</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-400 text-sm font-sans"
                    placeholder={t('assignment.name_placeholder')}
                  />
                </div>

                {/* 2. Target Word & Phoneme Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1.5">
                      {t('assignment.word')}
                    </label>
                    <input
                      type="text"
                      required
                      value={word}
                      onChange={e => setWord(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-400 text-sm font-mono"
                      placeholder={t('assignment.word_placeholder')}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1.5">
                      {t('assignment.phoneme')} <span className="text-[11px] text-gray-500 font-normal">{t('assignment.phoneme_hint')}</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={targetPhoneme}
                      onChange={e => setTargetPhoneme(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-400 text-sm font-mono"
                      placeholder="VD: ʃ hoặc auto"
                    />
                  </div>
                </div>

                {/* 3. Max Attempts & Deadline */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1.5">
                      {t('assignment.max_attempts')}
                    </label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={maxAttempts}
                      onChange={e => setMaxAttempts(Number(e.target.value))}
                      className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-400 text-sm font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1.5">
                      {t('assignment.deadline')} <span className="text-[11px] text-gray-500 font-normal">{t('assignment.deadline_hint')}</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={deadline}
                      onChange={e => setDeadline(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-400 text-sm"
                    />
                  </div>
                </div>

                {/* 4. Active Checkbox */}
                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="checkbox"
                    id="modalIsActive"
                    checked={isActive}
                    onChange={e => setIsActive(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-700 bg-gray-950 text-blue-500 focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="modalIsActive" className="text-xs font-medium text-gray-300 cursor-pointer select-none">
                    {t('assignment.is_active')}
                  </label>
                </div>

                {/* 5. SAMPLE AUDIO SECTION */}
                <div className="p-4 bg-gray-950/80 rounded-2xl border border-gray-800 space-y-3 mt-3">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={enableSampleAudio}
                        onChange={e => setEnableSampleAudio(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-700 bg-gray-900 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Volume2 className="w-4 h-4 text-emerald-400" />
                        Cho phép học viên nghe audio mẫu trước khi làm bài
                      </span>
                    </label>
                  </div>

                  {enableSampleAudio && (
                    <div className="pt-3 border-t border-gray-800 space-y-3 animate-in fade-in duration-150">
                      <div className="flex flex-col sm:flex-row gap-3">
                        {/* Option 1: Google TTS */}
                        <label className={`flex-1 p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                          sampleAudioType === 'tts'
                            ? 'bg-emerald-950/30 border-emerald-500/50 text-white'
                            : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-gray-300'
                        }`}>
                          <input
                            type="radio"
                            name="sampleType"
                            value="tts"
                            checked={sampleAudioType === 'tts'}
                            onChange={() => setSampleAudioType('tts')}
                            className="text-emerald-500 focus:ring-0"
                          />
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-bold block">Google TTS (Mặc định)</span>
                            <span className="text-[10px] text-gray-400">Giọng đọc tiếng Đức chuẩn tự nhiên</span>
                          </div>
                        </label>

                        {/* Option 2: Teacher Self-Record */}
                        <label className={`flex-1 p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                          sampleAudioType === 'teacher_record'
                            ? 'bg-emerald-950/30 border-emerald-500/50 text-white'
                            : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-gray-300'
                        }`}>
                          <input
                            type="radio"
                            name="sampleType"
                            value="teacher_record"
                            checked={sampleAudioType === 'teacher_record'}
                            onChange={() => setSampleAudioType('teacher_record')}
                            className="text-emerald-500 focus:ring-0"
                          />
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-bold block">Giáo viên tự ghi âm</span>
                            <span className="text-[10px] text-gray-400">Thu âm giọng mẫu trực tiếp</span>
                          </div>
                        </label>
                      </div>

                      {/* Controls for selected audio type */}
                      {sampleAudioType === 'tts' ? (
                        <div className="flex items-center justify-between bg-gray-900 p-3 rounded-xl border border-gray-800">
                          <span className="text-xs text-gray-300">
                            Phát âm tự động cho từ/câu: <strong className="text-lime-400">{word || '(chưa nhập)'}</strong>
                          </span>
                          <button
                            type="button"
                            onClick={handleTestTts}
                            disabled={isPlayingTts || !word.trim()}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-all flex items-center gap-1 cursor-pointer shrink-0"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                            <span>{isPlayingTts ? 'Đang phát...' : 'Nghe thử TTS'}</span>
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2 bg-gray-900 p-3 rounded-xl border border-gray-800">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-300 font-medium">
                              {teacherAudioUrl ? '✅ Đã có file ghi âm mẫu của bạn' : 'Chưa có file ghi âm mẫu'}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                if (!word.trim()) {
                                  toastError('Vui lòng nhập từ/câu cần đọc trước khi thu âm.');
                                  return;
                                }
                                setIsRecordModalOpen(true);
                              }}
                              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                            >
                              <Mic className="w-3.5 h-3.5" />
                              <span>{teacherAudioUrl ? 'Thu âm lại' : 'Thu âm ngay'}</span>
                            </button>
                          </div>

                          {/* Audio Preview if available */}
                          {teacherAudioUrl && (
                            <div className="pt-2">
                              <DarkAudioPlayer audioUrl={teacherAudioUrl} />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: Scoring Config for this Assignment */}
            {activeSubTab === 'scoring' && (
              <div className="space-y-5 animate-in fade-in duration-150">
                {/* Switcher: Inherit vs Custom */}
                <div className="p-4 bg-gray-950/90 rounded-2xl border border-gray-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-purple-400" />
                        <span>Cấu hình Chấm điểm cho Bài tập này</span>
                      </h4>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Tùy chỉnh riêng thuật toán chấm cho bài này hoặc kế thừa cấu hình chung của lớp.
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 p-1 bg-gray-900 rounded-xl border border-gray-800">
                      <button
                        type="button"
                        onClick={() => setUseCustomScoring(false)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          !useCustomScoring
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        Kế thừa lớp
                      </button>
                      <button
                        type="button"
                        onClick={() => setUseCustomScoring(true)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          useCustomScoring
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        Tùy chỉnh riêng
                      </button>
                    </div>
                  </div>
                </div>

                {/* Custom Scoring Sliders */}
                <div className={`space-y-4 transition-opacity ${useCustomScoring ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                  {/* Passing Threshold Slider */}
                  <div className="p-4 bg-gray-950/80 rounded-2xl border border-gray-800 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-gray-200">{t('config.threshold')}</span>
                      <strong className="font-mono text-sm text-yellow-400 font-black">
                        {Math.round(threshold * 100)} / 100
                      </strong>
                    </div>
                    <input
                      type="range"
                      min={0.3}
                      max={0.95}
                      step={0.05}
                      value={threshold}
                      onChange={e => setThreshold(parseFloat(e.target.value))}
                      className="w-full accent-yellow-400 cursor-pointer h-2 bg-gray-800 rounded-lg"
                    />
                    <p className="text-[11px] text-gray-500">{t('config.threshold_hint')}</p>
                  </div>

                  {/* Mode switcher & manual parameters */}
                  <div className="p-4 bg-gray-950/80 rounded-2xl border border-gray-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-200">Chế độ phân bổ trọng số:</span>
                      <div className="flex items-center gap-1.5 p-1 bg-gray-900 rounded-xl border border-gray-800">
                        <button
                          type="button"
                          onClick={() => setScoringMode('auto')}
                          className={`px-3 py-1 text-xs font-bold rounded-lg cursor-pointer ${
                            scoringMode === 'auto' ? 'bg-blue-600 text-white' : 'text-gray-400'
                          }`}
                        >
                          Tự động
                        </button>
                        <button
                          type="button"
                          onClick={() => setScoringMode('manual')}
                          className={`px-3 py-1 text-xs font-bold rounded-lg cursor-pointer ${
                            scoringMode === 'manual' ? 'bg-purple-600 text-white' : 'text-gray-400'
                          }`}
                        >
                          Thủ công
                        </button>
                      </div>
                    </div>

                    {scoringMode === 'manual' && (
                      <div className="space-y-3 pt-2 border-t border-gray-800">
                        {/* L0 Slider */}
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-300">Điểm chuyển tiếp L0:</span>
                            <strong className="font-mono text-blue-400">{L0} từ</strong>
                          </div>
                          <input
                            type="range"
                            min={2.0}
                            max={8.0}
                            step={0.5}
                            value={L0}
                            onChange={e => setL0(parseFloat(e.target.value))}
                            className="w-full accent-blue-500 cursor-pointer h-1.5 bg-gray-800 rounded-lg"
                          />
                        </div>

                        {/* k Slider */}
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-300">Độ dốc chuyển đổi k:</span>
                            <strong className="font-mono text-purple-400">{k}</strong>
                          </div>
                          <input
                            type="range"
                            min={0.3}
                            max={2.0}
                            step={0.05}
                            value={k}
                            onChange={e => setK(parseFloat(e.target.value))}
                            className="w-full accent-purple-500 cursor-pointer h-1.5 bg-gray-800 rounded-lg"
                          />
                        </div>

                        {/* Dynamic SVG Graph */}
                        <div className="pt-2">
                          <DynamicScoringGraph L0={L0} k={k} threshold={threshold} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex items-center gap-3 pt-4 border-t border-gray-800 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-2xl font-medium text-xs sm:text-sm transition-colors cursor-pointer"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl text-xs sm:text-sm transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : isEditing ? (
                  <Save className="w-4 h-4" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span>{loading ? t('common.processing') : isEditing ? t('assignment.btn_save') : t('assignment.btn_create')}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Teacher Recording Sample Modal Popup */}
      <TeacherRecordSampleModal
        isOpen={isRecordModalOpen}
        targetWord={word.trim()}
        onClose={() => setIsRecordModalOpen(false)}
        onApply={(blob, previewUrl) => {
          setTeacherAudioBlob(blob);
          setTeacherAudioUrl(previewUrl);
          setSampleAudioType('teacher_record');
        }}
      />
    </>
  );
}
