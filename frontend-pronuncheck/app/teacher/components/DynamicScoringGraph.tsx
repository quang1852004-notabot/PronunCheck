'use client';

import React from 'react';
import { useLanguage } from '@/app/contexts/LanguageContext';

interface DynamicScoringGraphProps {
  L0: number;
  k: number;
  threshold: number; // 0.3 to 0.9
  highlightL?: number; // e.g., 1.5, 4.5, 8.0
}

export default function DynamicScoringGraph({
  L0 = 4.5,
  k = 0.85,
  threshold = 0.6,
  highlightL
}: DynamicScoringGraphProps) {
  const { t } = useLanguage();

  const svgWidth = 540;
  const svgHeight = 260;
  const padLeft = 45;
  const padRight = 30;
  const padTop = 25;
  const padBottom = 40;

  const graphWidth = svgWidth - padLeft - padRight;
  const graphHeight = svgHeight - padTop - padBottom;

  const maxL = 10;
  const numSteps = 50;

  // Generate Sigmoid Curve Points
  const accPoints: { x: number; y: number; L: number; weight: number }[] = [];
  const fluPoints: { x: number; y: number; L: number; weight: number }[] = [];

  for (let i = 0; i <= numSteps; i++) {
    const L = (i / numSteps) * maxL;
    const exponent = Math.max(-20, Math.min(20, k * (L - L0)));
    const w_acc = 1 / (1 + Math.exp(exponent));
    const w_flu = 1 - w_acc;

    const x = padLeft + (L / maxL) * graphWidth;
    const y_acc = padTop + (1 - w_acc) * graphHeight;
    const y_flu = padTop + (1 - w_flu) * graphHeight;

    accPoints.push({ x, y: y_acc, L, weight: w_acc });
    fluPoints.push({ x, y: y_flu, L, weight: w_flu });
  }

  const accPolyline = accPoints.map(p => `${p.x},${p.y}`).join(' ');
  const fluPolyline = fluPoints.map(p => `${p.x},${p.y}`).join(' ');

  // Passing Threshold Horizontal Line
  const thresholdY = padTop + (1 - threshold) * graphHeight;

  // Crossover Point (where w_acc = w_flu = 0.5 at L = L0)
  const crossoverX = padLeft + (Math.min(maxL, Math.max(0, L0)) / maxL) * graphWidth;
  const crossoverY = padTop + 0.5 * graphHeight;

  // Highlight Point at highlightL
  let highlightInfo = null;
  if (highlightL !== undefined) {
    const expH = Math.max(-20, Math.min(20, k * (highlightL - L0)));
    const wH_acc = 1 / (1 + Math.exp(expH));
    const wH_flu = 1 - wH_acc;
    const hX = padLeft + (Math.min(maxL, Math.max(0, highlightL)) / maxL) * graphWidth;
    const hY_acc = padTop + (1 - wH_acc) * graphHeight;
    const hY_flu = padTop + (1 - wH_flu) * graphHeight;

    highlightInfo = {
      x: hX,
      y_acc: hY_acc,
      y_flu: hY_flu,
      w_acc: Math.round(wH_acc * 100),
      w_flu: Math.round(wH_flu * 100),
      L: highlightL
    };
  }

  return (
    <div className="w-full bg-gray-950/90 p-4 sm:p-6 rounded-2xl border border-gray-800 shadow-2xl space-y-4 select-none">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-800 pb-3">
        <div>
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <span>{t('config.graph_title')}</span>
          </h4>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {t('config.graph_desc')}
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-2.5 text-[10px] font-bold">
          <span className="flex items-center gap-1 text-lime-400 bg-lime-500/10 px-2 py-0.5 rounded-full border border-lime-500/30">
            <span className="w-2.5 h-0.5 bg-lime-400 inline-block"></span> Âm vị w_acc
          </span>
          <span className="flex items-center gap-1 text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/30">
            <span className="w-2.5 h-0.5 bg-purple-400 inline-block"></span> Ngữ điệu w_flu
          </span>
          <span className="flex items-center gap-1 text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full border border-yellow-500/30">
            <span className="w-2.5 h-0.5 border-t border-dashed border-yellow-400 inline-block"></span> Ngưỡng Đạt ({Math.round(threshold * 100)}%)
          </span>
        </div>
      </div>

      {/* SVG Chart Canvas */}
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full min-w-[420px] max-h-72 overflow-visible"
        >
          {/* Background Grid Lines (Horizontal: 0%, 25%, 50%, 75%, 100%) */}
          {[0, 0.25, 0.5, 0.75, 1.0].map((level, idx) => {
            const y = padTop + (1 - level) * graphHeight;
            return (
              <g key={idx}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={svgWidth - padRight}
                  y2={y}
                  stroke="#374151"
                  strokeDasharray={level === 0 || level === 1 ? 'none' : '3 3'}
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 8}
                  y={y + 3}
                  textAnchor="end"
                  fill="#9ca3af"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  {Math.round(level * 100)}%
                </text>
              </g>
            );
          })}

          {/* Vertical Grid Lines for L = 0, 2, 4, 6, 8, 10 */}
          {[0, 2, 4, 6, 8, 10].map((lVal, idx) => {
            const x = padLeft + (lVal / maxL) * graphWidth;
            return (
              <g key={idx}>
                <line
                  x1={x}
                  y1={padTop}
                  x2={x}
                  y2={svgHeight - padBottom}
                  stroke="#374151"
                  strokeDasharray="2 2"
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={svgHeight - padBottom + 16}
                  textAnchor="middle"
                  fill="#9ca3af"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  L={lVal}
                </text>
              </g>
            );
          })}

          {/* Section Category Labels on X Axis */}
          <text
            x={padLeft + (1.5 / maxL) * graphWidth}
            y={svgHeight - padBottom + 30}
            textAnchor="middle"
            fill="#a3e635"
            fontSize="9"
            fontWeight="bold"
          >
            Từ đơn (L&le;2)
          </text>
          <text
            x={padLeft + (4.5 / maxL) * graphWidth}
            y={svgHeight - padBottom + 30}
            textAnchor="middle"
            fill="#60a5fa"
            fontSize="9"
            fontWeight="bold"
          >
            Cụm từ (L=3-5)
          </text>
          <text
            x={padLeft + (8.0 / maxL) * graphWidth}
            y={svgHeight - padBottom + 30}
            textAnchor="middle"
            fill="#c084fc"
            fontSize="9"
            fontWeight="bold"
          >
            Câu dài (L&ge;6)
          </text>

          {/* Passing Threshold Horizontal Line (Dashed Yellow/Red) */}
          <line
            x1={padLeft}
            y1={thresholdY}
            x2={svgWidth - padRight}
            y2={thresholdY}
            stroke="#facc15"
            strokeWidth="2.5"
            strokeDasharray="6 4"
          />
          <text
            x={svgWidth - padRight + 6}
            y={thresholdY + 3}
            textAnchor="start"
            fill="#facc15"
            fontSize="10"
            fontWeight="black"
            fontFamily="monospace"
          >
            Đạt &ge; {Math.round(threshold * 100)}%
          </text>

          {/* 1. Phoneme Accuracy Weight Curve (Lime/Green) */}
          <polyline
            points={accPolyline}
            fill="none"
            stroke="#a3e635"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* 2. Fluency & Intonation Weight Curve (Purple) */}
          <polyline
            points={fluPolyline}
            fill="none"
            stroke="#c084fc"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Crossover Node (50% point at L0) */}
          <circle
            cx={crossoverX}
            cy={crossoverY}
            r="6"
            fill="#3b82f6"
            stroke="#ffffff"
            strokeWidth="2"
          />
          <text
            x={crossoverX}
            y={crossoverY - 10}
            textAnchor="middle"
            fill="#60a5fa"
            fontSize="10"
            fontWeight="bold"
          >
            50% (L₀={L0.toFixed(1)})
          </text>

          {/* Highlighted Example Line & Points (if selected) */}
          {highlightInfo && (
            <g>
              <line
                x1={highlightInfo.x}
                y1={padTop}
                x2={highlightInfo.x}
                y2={svgHeight - padBottom}
                stroke="#60a5fa"
                strokeWidth="1.5"
                strokeDasharray="4 2"
              />
              {/* Point on w_acc */}
              <circle
                cx={highlightInfo.x}
                cy={highlightInfo.y_acc}
                r="6"
                fill="#a3e635"
                stroke="#030712"
                strokeWidth="2"
              />
              <text
                x={highlightInfo.x + 8}
                y={highlightInfo.y_acc - 2}
                fill="#a3e635"
                fontSize="10"
                fontWeight="black"
                fontFamily="monospace"
              >
                Âm vị: {highlightInfo.w_acc}%
              </text>

              {/* Point on w_flu */}
              <circle
                cx={highlightInfo.x}
                cy={highlightInfo.y_flu}
                r="6"
                fill="#c084fc"
                stroke="#030712"
                strokeWidth="2"
              />
              <text
                x={highlightInfo.x + 8}
                y={highlightInfo.y_flu + 12}
                fill="#c084fc"
                fontSize="10"
                fontWeight="black"
                fontFamily="monospace"
              >
                Ngữ điệu: {highlightInfo.w_flu}%
              </text>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
