'use client';

import React, { useState, useEffect } from 'react';
import { updateScoringConfig, ScoringConfig } from '@/app/lib/firestore';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useToast } from '@/app/contexts/ToastContext';
import { Sliders, Save, Sparkles, Wand2, Settings2, CheckCircle2, HelpCircle } from 'lucide-react';
import DynamicScoringGraph from '@/app/teacher/components/DynamicScoringGraph';

interface ScoringConfigProps {
  classId: string;
  initialConfig?: ScoringConfig;
  onSaved?: (config: ScoringConfig) => void;
}

export default function ScoringConfigComponent({ classId, initialConfig, onSaved }: ScoringConfigProps) {
  const { t } = useLanguage();
  const { success, error: toastError } = useToast();

  const [mode, setMode] = useState<'auto' | 'manual'>(initialConfig?.mode || 'auto');
  const [threshold, setThreshold] = useState<number>(
    initialConfig?.threshold !== undefined ? initialConfig.threshold : 0.6
  );
  const [L0, setL0] = useState<number>(initialConfig?.L0 !== undefined ? initialConfig.L0 : 4.5);
  const [k, setK] = useState<number>(initialConfig?.k !== undefined ? initialConfig.k : 0.85);
  const [saving, setSaving] = useState(false);

  // Sync state if initialConfig from Firestore changes
  useEffect(() => {
    if (initialConfig) {
      if (initialConfig.mode) setMode(initialConfig.mode);
      if (initialConfig.threshold !== undefined) setThreshold(initialConfig.threshold);
      if (initialConfig.L0 !== undefined) setL0(initialConfig.L0);
      if (initialConfig.k !== undefined) setK(initialConfig.k);
    }
  }, [initialConfig]);

  // Simulation highlight state: 1.5 (short), 4.5 (medium), 8.0 (long)
  const [simL, setSimL] = useState<number>(1.5);

  const handleSave = async () => {
    setSaving(true);
    try {
      const newConfig: ScoringConfig = {
        threshold,
        mode,
        L0,
        k,
        passing_threshold: threshold,
        w1: 0.5,
        w2: 0.5
      };

      await updateScoringConfig(classId, newConfig);
      if (onSaved) {
        onSaved(newConfig);
      }
      success(t('config.saved_success'));
    } catch (error: any) {
      console.error(error);
      toastError(error.message || 'Lỗi khi lưu cấu hình.');
    } finally {
      setSaving(false);
    }
  };

  // Calculate simulated weights for currently selected simL
  const expSim = Math.max(-20, Math.min(20, k * (simL - L0)));
  const simW_acc = Math.round((1 / (1 + Math.exp(expSim))) * 100);
  const simW_flu = 100 - simW_acc;

  return (
    <div className="space-y-6 select-none animate-in fade-in duration-200">
      <div className="bg-gray-800/90 p-5 sm:p-7 rounded-3xl border border-gray-700/80 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-700/80 pb-5">
          <div>
            <h3 className="text-lg sm:text-xl font-black text-white flex items-center gap-2.5">
              <Sliders className="w-5 h-5 text-blue-400" />
              <span>{t('config.title')}</span>
            </h3>
            <p className="text-xs sm:text-sm text-gray-400 mt-1">
              {t('config.desc')}
            </p>
          </div>

          {/* Mode Switcher Buttons */}
          <div className="flex items-center p-1 bg-gray-900 rounded-2xl border border-gray-700/80 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setMode('auto')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                mode === 'auto'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>{t('config.mode_auto')}</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('manual')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                mode === 'manual'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>{t('config.mode_manual')}</span>
            </button>
          </div>
        </div>

        {/* Mode 1: Automatic Explanation Card */}
        {mode === 'auto' && (
          <div className="p-5 bg-blue-950/30 border border-blue-500/30 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
              <Sparkles className="w-4 h-4" />
              <span>{t('config.auto_title')}</span>
            </div>
            <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">
              {t('config.auto_desc')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="bg-gray-900/80 p-3 rounded-xl border border-blue-500/20">
                <span className="text-xs font-bold text-blue-300 block">{t('config.auto_short_label')}</span>
                <span className="text-[11px] text-gray-400">{t('config.auto_short_desc')}</span>
              </div>
              <div className="bg-gray-900/80 p-3 rounded-xl border border-blue-500/20">
                <span className="text-xs font-bold text-blue-300 block">{t('config.auto_med_label')}</span>
                <span className="text-[11px] text-gray-400">{t('config.auto_med_desc')}</span>
              </div>
              <div className="bg-gray-900/80 p-3 rounded-xl border border-blue-500/20">
                <span className="text-xs font-bold text-blue-300 block">{t('config.auto_long_label')}</span>
                <span className="text-[11px] text-gray-400">{t('config.auto_long_desc')}</span>
              </div>
            </div>
          </div>
        )}

        {/* Mode 2: Manual Interactive SVG Graph & Controls */}
        {mode === 'manual' && (
          <div className="space-y-6">
            <DynamicScoringGraph
              L0={L0}
              k={k}
              threshold={threshold}
              activeL={simL}
            />

            {/* Parameter Sliders */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-gray-900/80 p-5 rounded-2xl border border-purple-500/30">
              {/* Slider 1: L0 */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-bold text-gray-200">{t('config.l0_label')}</label>
                  <span className="font-mono font-black text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md">
                    L0 = {L0.toFixed(1)}
                  </span>
                </div>
                <input
                  type="range"
                  min="2.0"
                  max="10.0"
                  step="0.5"
                  value={L0}
                  onChange={(e) => setL0(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between text-[10px] text-gray-500">
                  <span>2.0 (Từ rất ngắn)</span>
                  <span>4.5 (Mặc định)</span>
                  <span>10.0 (Câu rất dài)</span>
                </div>
              </div>

              {/* Slider 2: k */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-bold text-gray-200">{t('config.k_label')}</label>
                  <span className="font-mono font-black text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md">
                    k = {k.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.3"
                  max="2.0"
                  step="0.05"
                  value={k}
                  onChange={(e) => setK(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <div className="flex justify-between text-[10px] text-gray-500">
                  <span>0.3 (Chuyển đổi rất êm)</span>
                  <span>0.85 (Chuẩn)</span>
                  <span>2.0 (Chuyển đổi đột ngột)</span>
                </div>
              </div>
            </div>

            {/* Quick Live Simulation Buttons */}
            <div className="p-4 bg-gray-900/60 rounded-2xl border border-gray-800 space-y-3">
              <span className="text-xs font-bold text-gray-300 block">{t('config.sim_title')}</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSimL(1.5)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    simL === 1.5 
                      ? 'bg-blue-600/30 text-blue-300 border-blue-500' 
                      : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white'
                  }`}
                >
                  {t('config.sim_short')}
                </button>
                <button
                  type="button"
                  onClick={() => setSimL(4.5)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    simL === 4.5 
                      ? 'bg-blue-600/30 text-blue-300 border-blue-500' 
                      : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white'
                  }`}
                >
                  {t('config.sim_medium')}
                </button>
                <button
                  type="button"
                  onClick={() => setSimL(8.0)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    simL === 8.0 
                      ? 'bg-blue-600/30 text-blue-300 border-blue-500' 
                      : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white'
                  }`}
                >
                  {t('config.sim_long')}
                </button>
              </div>

              {/* Simulation Result Output */}
              <div className="p-3 bg-gray-950/80 rounded-xl border border-gray-800 flex items-center justify-between text-xs font-mono">
                <span className="text-gray-400">Kết quả phân bổ trọng số:</span>
                <div className="flex items-center gap-3">
                  <span className="text-green-400 font-bold">Âm vị: {simW_acc}%</span>
                  <span className="text-purple-400 font-bold">Ngữ điệu: {simW_flu}%</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Passing Threshold Setting (Always available in both Auto and Manual mode) */}
        <div className="p-5 bg-gray-900/90 rounded-2xl border border-gray-700/80 space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <label className="text-xs sm:text-sm font-bold text-white block">
                {t('config.threshold')}
              </label>
              <p className="text-[11px] text-gray-400">
                {t('config.threshold_hint')}
              </p>
            </div>
            <span className="font-mono text-lg font-black text-lime-400 bg-lime-500/10 px-3 py-1 rounded-xl border border-lime-500/20">
              {Math.round(threshold * 100)} / 100
            </span>
          </div>

          <input
            type="range"
            min="0.4"
            max="0.95"
            step="0.05"
            value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-lime-400"
          />
          <div className="flex justify-between text-[10px] text-gray-500">
            <span>40 (Dễ - Người mới)</span>
            <span>60 (Tiêu chuẩn A1-A2)</span>
            <span>70 (Khá B1)</span>
            <span>85+ (Nâng cao B2-C1)</span>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-sm rounded-2xl transition-all shadow-lg shadow-blue-500/25 flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{t('config.save_btn')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
