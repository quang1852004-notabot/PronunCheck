'use client';

import { useState } from 'react';
import { createAssignment } from '@/app/lib/firestore';
import { Timestamp } from 'firebase/firestore';

interface AssignmentFormProps {
  classId: string;
  onCreated: () => void;
}

export default function AssignmentForm({ classId, onCreated }: AssignmentFormProps) {
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
        word,
        targetPhoneme,
        maxAttempts,
        deadline: deadline ? Timestamp.fromDate(new Date(deadline)) : null,
        isActive
      });
      setWord('');
      setTargetPhoneme('');
      setMaxAttempts(3);
      setDeadline('');
      setIsActive(true);
      onCreated();
    } catch (error) {
      console.error(error);
      alert('Có lỗi xảy ra khi tạo bài tập');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-gray-900 p-6 rounded-2xl border border-gray-700 space-y-4">
      <h3 className="text-xl font-bold mb-4">Tạo bài tập mới</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Từ cần đọc *</label>
          <input
            type="text"
            required
            value={word}
            onChange={e => setWord(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
            placeholder="VD: Schule"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Phoneme mục tiêu *</label>
          <input
            type="text"
            required
            value={targetPhoneme}
            onChange={e => setTargetPhoneme(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
            placeholder="VD: ʃ"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Số lần thử tối đa</label>
          <input
            type="number"
            min={1}
            required
            value={maxAttempts}
            onChange={e => setMaxAttempts(Number(e.target.value))}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Hạn chót</label>
          <input
            type="datetime-local"
            value={deadline}
            onChange={e => setDeadline(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="md:col-span-2 flex items-center space-x-2">
          <input
            type="checkbox"
            id="isActive"
            checked={isActive}
            onChange={e => setIsActive(e.target.checked)}
            className="w-5 h-5 rounded border-gray-700 bg-gray-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-900"
          />
          <label htmlFor="isActive" className="text-sm font-medium text-gray-400">Đang mở (Học sinh có thể làm)</label>
        </div>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full mt-4 px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-medium rounded-lg transition-colors shadow-lg shadow-blue-500/30"
      >
        {loading ? 'Đang tạo...' : 'Tạo bài tập'}
      </button>
    </form>
  );
}
