'use client';

import { useState } from 'react';
import { createAssignment } from '@/app/lib/firestore';
import { Timestamp } from 'firebase/firestore';

interface AssignmentFormProps {
  classId: string;
  onCreated: () => void;
}

export default function AssignmentForm({ classId, onCreated }: AssignmentFormProps) {
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
      <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
        <span className="text-blue-400">📝</span> Tạo bài tập mới
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Tên bài tập <span className="text-xs text-gray-500 font-normal">(Tùy chọn - Giúp hiển thị gọn gàng trong danh sách)</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            placeholder="VD: Bài 1 - Luyện đếm số từ 1 đến 10"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Từ / Câu cần đọc *</label>
          <input
            type="text"
            required
            value={word}
            onChange={e => setWord(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            placeholder="VD: Schule hoặc eins zwei drei..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Phoneme mục tiêu * <span className="text-xs text-gray-500 font-normal">(nhập &#39;auto&#39; nếu là câu dài)</span>
          </label>
          <input
            type="text"
            required
            value={targetPhoneme}
            onChange={e => setTargetPhoneme(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            placeholder="VD: ʃ hoặc sch hoặc auto"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Số lần thử tối đa</label>
          <input
            type="number"
            min={1}
            required
            value={maxAttempts}
            onChange={e => setMaxAttempts(Number(e.target.value))}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Hạn chót <span className="text-xs text-gray-500 font-normal">(để trống nếu không giới hạn)</span>
          </label>
          <input
            type="datetime-local"
            value={deadline}
            onChange={e => setDeadline(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="md:col-span-2 flex items-center space-x-2 pt-1">
          <input
            type="checkbox"
            id="isActive"
            checked={isActive}
            onChange={e => setIsActive(e.target.checked)}
            className="w-5 h-5 rounded border-gray-700 bg-gray-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-900 cursor-pointer"
          />
          <label htmlFor="isActive" className="text-sm font-medium text-gray-300 cursor-pointer">
            Đang mở (Học sinh có thể nhìn thấy và làm bài)
          </label>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full mt-4 px-4 py-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/25 cursor-pointer"
      >
        {loading ? 'Đang tạo...' : '+ Tạo bài tập mới'}
      </button>
    </form>
  );
}
