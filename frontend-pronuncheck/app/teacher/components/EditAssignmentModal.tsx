'use client';

import React, { useState } from 'react';
import { updateAssignment, AssignmentData } from '@/app/lib/firestore';
import { Timestamp } from 'firebase/firestore';
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
      onUpdated();
      onClose();
    } catch (error) {
      console.error('Error updating assignment:', error);
      alert('Có lỗi xảy ra khi cập nhật bài tập.');
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
              <h2 className="text-xl font-bold text-white">Chỉnh sửa bài tập</h2>
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
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Tên bài tập <span className="text-xs text-gray-500 font-normal">(Tùy chọn)</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="VD: Schule hoặc eins zwei drei..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Phoneme mục tiêu *</label>
              <input
                type="text"
                required
                value={targetPhoneme}
                onChange={e => setTargetPhoneme(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="VD: ʃ hoặc auto"
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
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Hạn chót <span className="text-xs text-gray-500 font-normal">(để trống nếu không giới hạn)</span>
            </label>
            <input
              type="datetime-local"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <input
              type="checkbox"
              id="editIsActive"
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
              className="w-5 h-5 rounded border-gray-700 bg-gray-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-900 cursor-pointer"
            />
            <label htmlFor="editIsActive" className="text-sm font-medium text-gray-300 cursor-pointer">
              Đang mở (Học sinh có thể nhìn thấy và làm bài)
            </label>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-medium transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
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
