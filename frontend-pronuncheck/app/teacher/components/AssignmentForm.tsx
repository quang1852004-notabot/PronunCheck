'use client';

import React, { useState } from 'react';
import { createAssignment } from '@/app/lib/firestore';
import { Timestamp } from 'firebase/firestore';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useToast } from '@/app/contexts/ToastContext';
import { PlusCircle, Sparkles } from 'lucide-react';

interface AssignmentFormProps {
  classId: string;
  onCreated: () => void;
}

export default function AssignmentForm({ classId, onCreated }: AssignmentFormProps) {
  const { t } = useLanguage();
  const { success, error: toastError } = useToast();

  const [title, setTitle] = useState('');
  const [word, setWord] = useState('');
  const [targetPhoneme, setTargetPhoneme] = useState('');
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [deadline, setDeadline] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createAssignment(classId, {
        title: title.trim() || undefined,
        word: word.trim(),
        targetPhoneme: targetPhoneme.trim() || 'auto',
        maxAttempts,
        deadline: deadline ? Timestamp.fromDate(new Date(deadline)) : null,
        isActive
      });
      setTitle('');
      setWord('');
      setTargetPhoneme('');
      setMaxAttempts(3);
      setDeadline('');
      setIsActive(true);
      success(t('assignment.created_success'));
      onCreated();
    } catch (error: any) {
      console.error(error);
      toastError(error.message || 'Có lỗi xảy ra khi tạo bài tập');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-gray-800/90 p-5 sm:p-6 rounded-3xl border border-gray-700/80 space-y-4 shadow-xl">
      <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
        <PlusCircle className="w-5 h-5 text-blue-400" />
        {t('assignment.create_title')}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-gray-300 mb-1.5">
            {t('assignment.name')} <span className="text-[11px] text-gray-500 font-normal">{t('assignment.name_hint')}</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-400 text-sm"
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
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-400 text-sm font-mono"
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
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-400 text-sm font-mono"
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
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-400 text-sm"
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
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-400 text-sm"
          />
        </div>

        <div className="md:col-span-2 flex items-center space-x-2 pt-1">
          <input
            type="checkbox"
            id="isActive"
            checked={isActive}
            onChange={e => setIsActive(e.target.checked)}
            className="w-4 h-4 rounded border-gray-700 bg-gray-900 text-blue-500 focus:ring-blue-500 cursor-pointer"
          />
          <label htmlFor="isActive" className="text-xs font-medium text-gray-300 cursor-pointer select-none">
            {t('assignment.is_active')}
          </label>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full mt-3 px-4 py-3 bg-blue-600 hover:bg-blue-500 active:scale-98 disabled:opacity-50 text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer text-sm"
      >
        <Sparkles className="w-4 h-4" />
        <span>{loading ? t('common.processing') : t('assignment.btn_create')}</span>
      </button>
    </form>
  );
}
