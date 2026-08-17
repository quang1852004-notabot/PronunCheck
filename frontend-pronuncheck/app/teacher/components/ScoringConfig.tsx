'use client';

import { useState } from 'react';
import { updateScoringConfig, ScoringConfig } from '@/app/lib/firestore';

interface ScoringConfigProps {
  classId: string;
  initialConfig: ScoringConfig;
}

export default function ScoringConfigComponent({ classId, initialConfig }: ScoringConfigProps) {
  const [config, setConfig] = useState<ScoringConfig>(initialConfig || { threshold: 0.5, w1: 0.5, w2: 0.5 });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

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
      <div>
        <h3 className="text-xl font-bold text-white">Cấu hình Chấm điểm AI (V3.5)</h3>
        <p className="text-sm text-gray-400 mt-1">
          Hệ thống sử dụng thuật toán <strong className="text-blue-400">Dynamic Sigmoid Scoring</strong> kết hợp Wav2Vec2 (Âm vị học Đức), F0 FastDTW (Ngữ điệu) và Faster-Whisper.
        </p>
      </div>
      
      <div className="bg-gray-900 p-6 rounded-2xl border border-gray-700 space-y-6">
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-semibold text-gray-300">
              Ngưỡng đạt bài tập (Passing Threshold)
            </label>
            <span className="px-3 py-1 bg-blue-500/20 text-blue-400 font-bold rounded-lg text-sm border border-blue-500/30">
              {(config.threshold * 100).toFixed(0)}%
            </span>
          </div>
          <input
            type="range"
            min="0.3"
            max="0.9"
            step="0.05"
            value={config.threshold}
            onChange={e => setConfig({ ...config, threshold: Number(e.target.value) })}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <p className="text-xs text-gray-400 mt-2">
            Học sinh đạt tổng điểm Hybrid <span className="text-white font-medium">&gt;= {(config.threshold * 100).toFixed(0)}%</span> sẽ được đánh dấu là <strong className="text-green-400">Đạt</strong>.
          </p>
        </div>

        {/* Cơ chế chấm điểm động */}
        <div className="bg-gray-800/80 p-5 rounded-xl border border-gray-700/80 space-y-3">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <span>⚙️</span> Cơ chế Phân bổ Trọng số Động (Dynamic Weights):
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="bg-gray-900/90 p-3.5 rounded-lg border border-gray-700">
              <p className="font-semibold text-blue-300 mb-1">🔤 Từ đơn / Từ ngắn (L &le; 3 từ)</p>
              <p className="text-gray-400">
                Tự động ưu tiên <strong>82% Độ chính xác âm vị</strong> (Wav2Vec2 + Luật Ich/Ach + Vô thanh hóa) và <strong>18% Ngữ điệu</strong>.
              </p>
            </div>
            <div className="bg-gray-900/90 p-3.5 rounded-lg border border-gray-700">
              <p className="font-semibold text-purple-300 mb-1">📖 Cụm từ / Câu dài (L &ge; 6 từ)</p>
              <p className="text-gray-400">
                Tự động ưu tiên <strong>73% Độ lưu loát &amp; Ngữ điệu</strong> (F0 Pitch DTW + Whisper) và <strong>27% Âm vị</strong>.
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-500 italic mt-1">
            * Thuật toán tuyến tính hóa đảm bảo khi học viên ngập ngừng nhưng phát âm âm vị chuẩn sẽ không bị triệt tiêu điểm.
          </p>
        </div>

        <div className="pt-2 flex items-center justify-between">
          <span className={`text-sm font-medium ${message.includes('thành công') ? 'text-green-400' : 'text-red-400'}`}>
            {message}
          </span>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/30 active:scale-95"
          >
            {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
          </button>
        </div>
      </div>
    </div>
  );
}
