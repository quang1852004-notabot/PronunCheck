'use client';

import React, { useState } from 'react';
import { Sliders, Sparkles, AlertTriangle, Info, HelpCircle } from 'lucide-react';
import { useLanguage } from '@/app/contexts/LanguageContext';

export interface NoiseReductionSliderProps {
  value: number; // 0, 1, 2, 3, 4
  onChange: (level: number) => void;
  disabled?: boolean;
}

export default function NoiseReductionSlider({
  value = 1,
  onChange,
  disabled = false,
}: NoiseReductionSliderProps) {
  const { t } = useLanguage();
  const [showTooltip, setShowTooltip] = useState(false);

  const levelConfigs = [
    {
      level: 0,
      title: t('noise.level_0'),
      desc: t('noise.desc_0'),
      badgeColor: 'text-gray-300 bg-gray-800 border-gray-600',
      trackColor: 'from-gray-500 to-gray-400',
      dotColor: 'bg-gray-400',
      accent: 'accent-gray-400',
    },
    {
      level: 1,
      title: t('noise.level_1'),
      desc: t('noise.desc_1'),
      badgeColor: 'text-cyan-400 bg-cyan-950/70 border-cyan-700/70',
      trackColor: 'from-cyan-500 to-blue-500',
      dotColor: 'bg-cyan-400',
      accent: 'accent-cyan-400',
    },
    {
      level: 2,
      title: t('noise.level_2'),
      desc: t('noise.desc_2'),
      badgeColor: 'text-lime-400 bg-lime-950/70 border-lime-700/70',
      trackColor: 'from-cyan-500 via-lime-400 to-green-500',
      dotColor: 'bg-lime-400',
      accent: 'accent-lime-400',
    },
    {
      level: 3,
      title: t('noise.level_3'),
      desc: t('noise.desc_3'),
      badgeColor: 'text-amber-400 bg-amber-950/70 border-amber-700/70',
      trackColor: 'from-lime-500 via-amber-400 to-yellow-500',
      dotColor: 'bg-amber-400',
      accent: 'accent-amber-400',
    },
    {
      level: 4,
      title: t('noise.level_4'),
      desc: t('noise.desc_4'),
      badgeColor: 'text-rose-400 bg-rose-950/80 border-rose-700/80 shadow-rose-500/10',
      trackColor: 'from-amber-500 via-rose-500 to-red-600',
      dotColor: 'bg-rose-500',
      accent: 'accent-rose-500',
    },
  ];

  const currentConfig = levelConfigs[Math.max(0, Math.min(4, value))];

  return (
    <div className="w-full bg-gray-950/70 p-3.5 sm:p-4 rounded-2xl border border-gray-800/90 shadow-inner space-y-2.5 select-none transition-all">
      {/* Header with Title and Current Level Badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-300">
          <Sliders className="w-3.5 h-3.5 text-cyan-400" />
          <span>{t('noise.title')}</span>
        </div>

        {/* Level Badge with Hover Tooltip on Level 4 */}
        <div className="relative flex items-center gap-1.5">
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold border transition-all shadow-sm ${currentConfig.badgeColor}`}
            onMouseEnter={() => value === 4 && setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            {value === 4 ? (
              <AlertTriangle className="w-3 h-3 text-rose-400 animate-pulse" />
            ) : value === 3 ? (
              <Sparkles className="w-3 h-3 text-amber-400" />
            ) : null}
            <span>{currentConfig.title}</span>
            <span className="text-[10px] opacity-75 font-mono">({value}/4)</span>
          </div>

          {/* Small Tooltip on Hover for Level 4 */}
          {(showTooltip || value === 4) && (
            <div className="group relative">
              <span
                className="cursor-help text-rose-400 hover:text-rose-300 transition-colors"
                title={t('noise.warning_level_4')}
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </span>
              
              {/* Tooltip Box popup on hover */}
              <div className="absolute right-0 bottom-full mb-2 w-64 p-2.5 bg-gray-900 text-rose-300 border border-rose-700/80 rounded-xl text-[11px] leading-snug shadow-2xl z-50 pointer-events-none transition-all opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 origin-bottom-right">
                <div className="font-bold flex items-center gap-1 text-rose-400 mb-0.5">
                  <AlertTriangle className="w-3 h-3 inline" /> Lưu ý Mức 4 (Cực đoan):
                </div>
                {t('noise.warning_level_4')}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 5-Step Range Slider */}
      <div className="space-y-1 px-1">
        <input
          type="range"
          min={0}
          max={4}
          step={1}
          value={value}
          disabled={disabled}
          onChange={(e) => {
            const nextVal = Number(e.target.value);
            onChange(nextVal);
            if (typeof window !== 'undefined') {
              try {
                localStorage.setItem('pronuncheck_noise_level', nextVal.toString());
              } catch (_) {}
            }
          }}
          className={`w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${currentConfig.accent}`}
        />

        {/* Step Ticks (0, 1, 2, 3, 4) - Using absolute positioning for perfect center alignment */}
        <div className="relative w-full h-10 mt-1 px-2">
          <div className="relative w-full h-full">
            {[0, 1, 2, 3, 4].map((step) => {
              const isSelected = step === value;
              return (
                <button
                  key={step}
                  type="button"
                  disabled={disabled}
                  style={{ left: `${step * 25}%`, transform: 'translateX(-50%)' }}
                  onClick={() => {
                    onChange(step);
                    if (typeof window !== 'undefined') {
                      try {
                        localStorage.setItem('pronuncheck_noise_level', step.toString());
                      } catch (_) {}
                    }
                  }}
                  className={`absolute top-0 transition-all cursor-pointer flex flex-col items-center gap-1 ${
                    isSelected ? 'text-white font-extrabold scale-110 z-10' : 'text-gray-500 hover:text-gray-400 z-0'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full transition-all ${
                      isSelected ? currentConfig.dotColor : 'bg-gray-700'
                    }`}
                  />
                  <span className="text-[10px] whitespace-nowrap">
                    {step === 0 ? 'Tắt' : step === 1 ? 'Nhẹ' : step === 2 ? 'Vừa' : step === 3 ? 'Mạnh' : 'Cực đoan'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Short Description */}
      <p className="text-[11px] text-gray-400 italic px-1 pt-0.5 leading-relaxed flex items-center gap-1.5">
        <Info className="w-3 h-3 text-gray-500 shrink-0" />
        <span>{currentConfig.desc}</span>
      </p>
    </div>
  );
}
