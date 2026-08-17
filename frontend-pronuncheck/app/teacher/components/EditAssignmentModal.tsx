'use client';

import React, { useState } from 'react';
import { updateAssignment, AssignmentData } from '@/app/lib/firestore';
import { Timestamp } from 'firebase/firestore';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useToast } from '@/app/contexts/ToastContext';
import { X, Save, Edit3 } from 'lucide-react';

interface EditAssignmentModalProps {
  classId: string;
  assignment: AssignmentData | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
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

function EditAssignmentForm({
  classId,
  assignment,
  onClose,
  onUpdated
}: {
  classId: string;
  assignment: AssignmentData;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const { t } = useLanguage();
  const { success, error: toastError } = useToast();

  const [title, setTitle] = useState(assignment.title || '');
  const [word, setWord] = useState(assignment.word || '');
  const [targetPhoneme, setTargetPhoneme] = useState(assignment.targetPhoneme || '');
  const [maxAttempts, setMaxAttempts] = useState(assignment.maxAttempts || 3);
  const [deadline, setDeadline] = useState(() => getInitialDeadline(assignment.deadline));
  const [isActive, setIsActive] = useState(assignment.isActive !== false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignment.id) return;
    setLoading(true);
    try {
      await updateAssignment(classId, assignment.id, {
        title: title.trim() || undefined,
        word: word.trim(),
        targetPhoneme: targetPhoneme.trim() || 'auto',
        maxAttempts: Number(maxAttempts),
        deadline: deadline ? Timestamp.fromDate(new Date(deadline)) : null,
        isActive
      });
      success(t('assignment.updated_success'));
      onUpdated();
      onClose();
    } catch (error: any) {
      console.error('Error updating assignment:', error);
      toastError(error.message || 'Có lỗi xảy ra khi cập nhật bài tập.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-gray-900 border border-gray-700 text-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6 relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{t('assignment.edit_title')}</h2>
              <p className="text-xs text-gray-400">ID: {assignment.id}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1.5">
              {t('assignment.name')} <span className="text-[11px] text-gray-500 font-normal">{t('assignment.name_hint')}</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-400 text-sm"
              placeholder={t('assignment.name_placeholder')}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1.5">
              {t('assignment.word')}
            </label>
            <input
              type="text"
              required
              value={word}
              onChange={e => setWord(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-400 text-sm font-mono"
              placeholder={t('assignment.word_placeholder')}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1.5">
                {t('assignment.phoneme')}
              </label>
              <input
                type="text"
                required
                value={targetPhoneme}
                onChange={e => setTargetPhoneme(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-400 text-sm font-mono"
                placeholder="VD: ʃ hoặc auto"
              />
            </div>

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
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-400 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1.5">
              {t('assignment.deadline')} <span className="text-[11px] text-gray-500 font-normal">{t('assignment.deadline_hint')}</span>
            </label>
            <input
              type="datetime-local"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-400 text-sm"
            />
          </div>

          <div className="flex items-center space-x-2 pt-1">
            <input
              type="checkbox"
              id="editIsActive"
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-blue-500 focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="editIsActive" className="text-xs font-medium text-gray-300 cursor-pointer select-none">
              {t('assignment.is_active')}
            </label>
          </div>

          <div className="flex gap-3 pt-3 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-medium text-xs transition-colors cursor-pointer"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-98 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{loading ? t('common.processing') : t('assignment.btn_save')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function EditAssignmentModal({
  classId,
  assignment,
  isOpen,
  onClose,
  onUpdated
}: EditAssignmentModalProps) {
  if (!isOpen || !assignment) return null;

  return (
    <EditAssignmentForm
      key={assignment.id}
      classId={classId}
      assignment={assignment}
      onClose={onClose}
      onUpdated={onUpdated}
    />
  );
}
