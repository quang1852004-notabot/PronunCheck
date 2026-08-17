'use client';

import React, { useState } from 'react';
import { updateScoringConfig, ScoringConfig } from '@/app/lib/firestore';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useToast } from '@/app/contexts/ToastContext';
import { Sliders, Save, Sparkles } from 'lucide-react';

interface ScoringConfigProps {
  classId: string;
  initialConfig?: ScoringConfig;
}

export default function ScoringConfigComponent({ classId, initialConfig }: ScoringConfigProps) {
  const { t } = useLanguage();
  const { success, error: toastError } = useToast();

  const [config, setConfig] = useState<ScoringConfig>(
    initialConfig || { threshold: 0.6, w1: 0.4, w2: 0.6 }
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateScoringConfig(classId, config);
      success(t('config.saved_success'));
    } catch (error: any) {
      console.error(error);
      toastError(error.message || 'Lỗi khi lưu cấu hình.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-800/90 p-5 sm:p-6 rounded-3xl border border-gray-700/80 shadow-xl space-y-6">
        <div>
          <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-blue-400" />
            {t('config.title')}
          </h3>
          <p className="text-xs sm:text-sm text-gray-400 mt-1">
            {t('config.desc')}
          </p>
        </div>
        
        <div className="bg-gray-900/80 p-5 rounded-2xl border border-gray-700/80 space-y-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-bold text-gray-300">
                {t('config.threshold')}
              </label>
              <span className="px-3 py-1 bg-blue-500/20 text-blue-400 font-bold rounded-xl text-xs border border-blue-500/30">
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
            <p className="text-[11px] text-gray-400 mt-2">
              {t('config.threshold_hint')}
            </p>
          </div>

          {/* Cơ chế chấm điểm động */}
          <div className="bg-gray-800/80 p-4 rounded-xl border border-gray-700/80 space-y-2.5">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              Cơ chế Phân bổ Trọng số Động (Dynamic Sigmoid Weights):
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              <div className="bg-gray-900/90 p-3 rounded-xl border border-gray-700">
                <p className="font-bold text-blue-300 mb-0.5">🔤 Từ đơn / Từ ngắn (L &le; 3 từ)</p>
                <p className="text-gray-400 text-[11px]">
                  Tự động ưu tiên <strong>82% Âm vị học</strong> (Wav2Vec2 + Luật Ich/Ach) và <strong>18% Ngữ điệu</strong>.
                </p>
              </div>
              <div className="bg-gray-900/90 p-3 rounded-xl border border-gray-700">
                <p className="font-bold text-purple-300 mb-0.5">📖 Cụm từ / Câu dài (L &ge; 6 từ)</p>
                <p className="text-gray-400 text-[11px]">
                  Tự động ưu tiên <strong>73% Ngữ điệu &amp; Lưu loát</strong> (F0 Pitch DTW + Whisper) và <strong>27% Âm vị</strong>.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-blue-500/25 flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? t('common.processing') : t('config.save_btn')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
