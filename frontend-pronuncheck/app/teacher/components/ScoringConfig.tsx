'use client';

import { useState } from 'react';
import { updateScoringConfig, ScoringConfig } from '@/app/lib/firestore';

interface ScoringConfigProps {
  classId: string;
  initialConfig: ScoringConfig;
}

export default function ScoringConfigComponent({ classId, initialConfig }: ScoringConfigProps) {
  const [config, setConfig] = useState<ScoringConfig>(initialConfig);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const handleW1Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const w1 = Number(e.target.value);
    setConfig({ ...config, w1, w2: 1 - w1 });
  };

  const handleW2Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const w2 = Number(e.target.value);
    setConfig({ ...config, w2, w1: 1 - w2 });
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      await updateScoringConfig(classId, config);
      setMessage('Lưu cấu hình thành công!');
    } catch (error) {
      console.error(error);
      setMessage('Lỗi khi lưu cấu hình.');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold">Cấu hình chấm điểm</h3>
      
      <div className="bg-gray-900 p-6 rounded-2xl border border-gray-700 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Ngưỡng đạt (Threshold): {(config.threshold * 100).toFixed(0)}%
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={config.threshold}
            onChange={e => setConfig({ ...config, threshold: Number(e.target.value) })}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <p className="text-xs text-gray-500 mt-2">Điểm Hybrid >= {(config.threshold * 100).toFixed(0)}% sẽ được tính là Đạt.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Trọng số Wav2Vec2 (w1): {config.w1.toFixed(2)}
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={config.w1}
            onChange={handleW1Change}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Trọng số Whisper (w2): {config.w2.toFixed(2)}
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={config.w2}
            onChange={handleW2Change}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <p className="text-xs text-gray-500 mt-2">w1 + w2 luôn bằng 1. Điểm Hybrid = w1 * Wav2Vec2 + w2 * Whisper.</p>
        </div>

        <div className="pt-4 flex items-center justify-between">
          <span className={`text-sm ${message.includes('thành công') ? 'text-green-400' : 'text-red-400'}`}>
            {message}
          </span>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-medium rounded-lg transition-colors shadow-lg shadow-blue-500/30"
          >
            {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
          </button>
        </div>
      </div>
    </div>
  );
}
