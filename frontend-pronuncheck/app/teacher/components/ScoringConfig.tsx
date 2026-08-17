'use client';

import React, { useState } from 'react';
import { updateScoringConfig, ScoringConfig } from '@/app/lib/firestore';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useToast } from '@/app/contexts/ToastContext';
import { Sliders, Save, Sparkles, Wand2, Settings2, CheckCircle2, HelpCircle } from 'lucide-react';
import DynamicScoringGraph from '@/app/teacher/components/DynamicScoringGraph';

interface ScoringConfigProps {
  classId: string;
  initialConfig?: ScoringConfig;
}

export default function ScoringConfigComponent({ classId, initialConfig }: ScoringConfigProps) {
  const { t } = useLanguage();
  const { success, error: toastError } = useToast();

  const [mode, setMode] = useState<'auto' | 'manual'>(initialConfig?.mode || 'auto');
  const [threshold, setThreshold] = useState<number>(
    initialConfig?.threshold !== undefined ? initialConfig.threshold : 0.6
  );
  const [L0, setL0] = useState<number>(initialConfig?.L0 !== undefined ? initialConfig.L0 : 4.5);
  const [k, setK] = useState<number>(initialConfig?.k !== undefined ? initialConfig.k : 0.85);
  const [saving, setSaving] = useState(false);

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

        {/* Global Passing Threshold Slider (Applies to both modes) */}
        <div className="bg-gray-900/90 p-5 rounded-2xl border border-gray-700/80 space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <label className="block text-xs sm:text-sm font-bold text-gray-200">
                {t('config.threshold')}
              </label>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {t('config.threshold_hint')}
              </p>
            </div>
            <span className="px-3.5 py-1.5 bg-blue-500/20 text-blue-400 font-mono font-black rounded-xl text-sm border border-blue-500/30">
              {Math.round(threshold * 100)}%
            </span>
          </div>

          <input
            type="range"
            min="0.4"
            max="0.9"
            step="0.05"
            value={threshold}
            onChange={e => setThreshold(Number(e.target.value))}
            className="w-full h-2.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />

          <div className="flex justify-between text-[10px] text-gray-500 font-mono">
            <span>Dễ (40%)</span>
            <span>Chuẩn B1/B2 (60% - 70%)</span>
            <span>Khắt khe (90%)</span>
          </div>
        </div>

        {/* MODE A: AUTOMATIC MODE (Teacher-Friendly, No Math jargon) */}
        {mode === 'auto' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="bg-blue-950/20 p-4 rounded-2xl border border-blue-500/30 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <div className="text-xs text-blue-200 leading-relaxed">
                <strong className="text-blue-300 font-bold block mb-1">
                  Thuật toán AI tự động điều phối trọng số theo độ dài bài tập:
                </strong>
                Hệ thống tự động nhận diện độ dài của từ hoặc câu để áp dụng tiêu chí chấm phù hợp nhất mà giáo viên không cần phải tính toán thủ công.
              </div>
            </div>

            {/* 3 Pedagogical Scenario Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              {/* Short Words */}
              <div className="bg-gray-900/90 p-4 rounded-2xl border border-gray-700/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-lime-400">🔤 Từ đơn ngắn</span>
                  <span className="text-[10px] font-mono bg-lime-500/10 text-lime-400 px-2 py-0.5 rounded-md border border-lime-500/20">L &le; 2</span>
                </div>
                <p className="text-gray-300 text-[11px] leading-relaxed">
                  Ví dụ: <strong className="text-white">Schule</strong>, <strong className="text-white">Rot</strong>, <strong className="text-white">Tisch</strong>
                </p>
                <div className="bg-gray-950 p-2.5 rounded-xl border border-gray-800 text-[11px] text-gray-300 space-y-1">
                  <div className="flex justify-between">
                    <span>Âm vị học (Wav2Vec2):</span>
                    <strong className="text-lime-400 font-mono">~82%</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Ngữ điệu (FastDTW):</span>
                    <strong className="text-purple-400 font-mono">~18%</strong>
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 italic">
                  Ưu tiên bắt lỗi từng âm vị nhỏ (Ich/Ach-Laut, vô thanh hóa).
                </p>
              </div>

              {/* Medium Phrases */}
              <div className="bg-gray-900/90 p-4 rounded-2xl border border-gray-700/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-blue-400">📑 Cụm từ vừa</span>
                  <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-md border border-blue-500/20">L = 3-5</span>
                </div>
                <p className="text-gray-300 text-[11px] leading-relaxed">
                  Ví dụ: <strong className="text-white">das Mineralwasser</strong>, <strong className="text-white">Guten Morgen</strong>
                </p>
                <div className="bg-gray-950 p-2.5 rounded-xl border border-gray-800 text-[11px] text-gray-300 space-y-1">
                  <div className="flex justify-between">
                    <span>Âm vị học:</span>
                    <strong className="text-lime-400 font-mono">~50%</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Ngữ điệu &amp; Lưu loát:</span>
                    <strong className="text-purple-400 font-mono">~50%</strong>
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 italic">
                  Cân bằng hoàn hảo giữa độ chuẩn xác âm và nhịp điệu từ ghép.
                </p>
              </div>

              {/* Long Sentences */}
              <div className="bg-gray-900/90 p-4 rounded-2xl border border-gray-700/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-purple-400">📖 Câu dài</span>
                  <span className="text-[10px] font-mono bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-md border border-purple-500/20">L &ge; 6</span>
                </div>
                <p className="text-gray-300 text-[11px] leading-relaxed">
                  Ví dụ: <strong className="text-white">Ich möchte Deutsch lernen</strong>
                </p>
                <div className="bg-gray-950 p-2.5 rounded-xl border border-gray-800 text-[11px] text-gray-300 space-y-1">
                  <div className="flex justify-between">
                    <span>Âm vị học:</span>
                    <strong className="text-lime-400 font-mono">~27%</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Ngữ điệu &amp; Lưu loát:</span>
                    <strong className="text-purple-400 font-mono">~73%</strong>
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 italic">
                  Ưu tiên độ trôi chảy và đường cong ngữ điệu câu tự nhiên.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* MODE B: MANUAL / VISUALIZATION MODE (Interactive Graph & Parameters) */}
        {mode === 'manual' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Interactive SVG Graph */}
            <DynamicScoringGraph
              L0={L0}
              k={k}
              threshold={threshold}
              highlightL={simL}
            />

            {/* Parameter Sliders */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-900/80 p-5 rounded-2xl border border-gray-700/80">
              {/* L0 Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-300">
                    {t('config.l0_label')}
                  </label>
                  <span className="px-2.5 py-1 bg-blue-500/20 text-blue-400 font-mono font-bold rounded-lg text-xs border border-blue-500/30">
                    L₀ = {L0.toFixed(1)}
                  </span>
                </div>
                <input
                  type="range"
                  min="2.0"
                  max="8.0"
                  step="0.5"
                  value={L0}
                  onChange={e => setL0(Number(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <p className="text-[10px] text-gray-400">
                  Tại độ dài L = L₀, tỷ lệ phân chia là 50% Âm vị và 50% Ngữ điệu.
                </p>
              </div>

              {/* k Slope Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-300">
                    {t('config.k_label')}
                  </label>
                  <span className="px-2.5 py-1 bg-purple-500/20 text-purple-400 font-mono font-bold rounded-lg text-xs border border-purple-500/30">
                    k = {k.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.3"
                  max="1.8"
                  step="0.05"
                  value={k}
                  onChange={e => setK(Number(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <p className="text-[10px] text-gray-400">
                  k càng lớn thì độ dốc chuyển đổi càng gấp; k nhỏ chuyển đổi mượt mà.
                </p>
              </div>
            </div>

            {/* Live Simulation Sandbox */}
            <div className="bg-gray-900/90 p-5 rounded-2xl border border-gray-700/80 space-y-3.5">
              <h4 className="text-xs font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-yellow-400" />
                <span>{t('config.sim_title')}</span>
              </h4>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSimL(1.5)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    simL === 1.5 
                      ? 'bg-lime-400 text-gray-950 shadow-md shadow-lime-400/20 scale-105' 
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-750'
                  }`}
                >
                  {t('config.sim_short')}
                </button>

                <button
                  type="button"
                  onClick={() => setSimL(4.5)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    simL === 4.5 
                      ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20 scale-105' 
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-750'
                  }`}
                >
                  {t('config.sim_medium')}
                </button>

                <button
                  type="button"
                  onClick={() => setSimL(8.0)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    simL === 8.0 
                      ? 'bg-purple-500 text-white shadow-md shadow-purple-500/20 scale-105' 
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-750'
                  }`}
                >
                  {t('config.sim_long')}
                </button>
              </div>

              {/* Simulation Output Card */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2 text-xs">
                <div className="bg-gray-950 p-3 rounded-xl border border-gray-800">
                  <span className="text-gray-400 text-[10px] uppercase font-bold block">Trọng số Âm vị (w_acc)</span>
                  <strong className="text-lime-400 font-mono text-base font-black">{simW_acc}%</strong>
                </div>
                <div className="bg-gray-950 p-3 rounded-xl border border-gray-800">
                  <span className="text-gray-400 text-[10px] uppercase font-bold block">Trọng số Ngữ điệu (w_flu)</span>
                  <strong className="text-purple-400 font-mono text-base font-black">{simW_flu}%</strong>
                </div>
                <div className="col-span-2 sm:col-span-1 bg-gray-950 p-3 rounded-xl border border-gray-800">
                  <span className="text-gray-400 text-[10px] uppercase font-bold block">Yêu cầu Đạt</span>
                  <strong className="text-yellow-400 font-mono text-base font-black">&ge; {Math.round(threshold * 100)}%</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="pt-3 flex items-center justify-end border-t border-gray-700/80">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-7 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 disabled:opacity-50 text-white font-extrabold rounded-2xl text-xs transition-all shadow-xl shadow-blue-500/20 flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? t('common.processing') : t('config.save_btn')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
