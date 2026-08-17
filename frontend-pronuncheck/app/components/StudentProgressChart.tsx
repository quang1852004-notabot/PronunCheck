'use client';

import React from 'react';
import { TrendingUp, Award, Clock, Volume2, CheckCircle2, XCircle } from 'lucide-react';
import { SubmissionData } from '@/app/lib/firestore';

interface StudentProgressChartProps {
  submissions: SubmissionData[];
  selectedSubmissionId?: string | null;
  onSelectSubmission?: (sub: SubmissionData) => void;
}

export default function StudentProgressChart({
  submissions,
  selectedSubmissionId,
  onSelectSubmission
}: StudentProgressChartProps) {
  if (!submissions || submissions.length === 0) return null;

  // Sort ascending by attemptNumber
  const sorted = [...submissions].sort((a, b) => (a.attemptNumber || 1) - (b.attemptNumber || 1));

  // Calculate scores list
  const attemptsData = sorted.map((s, idx) => {
    let total = 0;
    if (s.detailedScore?.hybrid_target_score !== undefined) {
      total = s.detailedScore.hybrid_target_score > 1 ? s.detailedScore.hybrid_target_score : s.detailedScore.hybrid_target_score * 100;
    } else if (s.scores?.total_score !== undefined) {
      total = s.scores.total_score * 100;
    }

    const phoneme = s.scores?.phoneme_score !== undefined 
      ? (s.scores.phoneme_score > 1 ? s.scores.phoneme_score : s.scores.phoneme_score * 100) 
      : 0;

    return {
      submission: s,
      attemptNumber: s.attemptNumber || idx + 1,
      total: Math.round(total),
      phoneme: Math.round(phoneme),
      isPassed: s.isPassed,
      id: s.id || `attempt-${idx}`
    };
  });

  const firstScore = attemptsData[0]?.total || 0;
  const lastScore = attemptsData[attemptsData.length - 1]?.total || 0;
  const bestScore = Math.max(...attemptsData.map(a => a.total), 0);
  const scoreDiff = lastScore - firstScore;

  // Generate SVG Points for Line Chart
  const svgWidth = 360;
  const svgHeight = 120;
  const paddingX = 30;
  const paddingY = 20;

  const points = attemptsData.map((d, i) => {
    const x = attemptsData.length === 1 
      ? svgWidth / 2 
      : paddingX + (i / (attemptsData.length - 1)) * (svgWidth - paddingX * 2);
    // Y: 0 score = height - paddingY, 100 score = paddingY
    const y = (svgHeight - paddingY) - (d.total / 100) * (svgHeight - paddingY * 2);
    return { x, y, data: d };
  });

  const pointsPath = points.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <div className="w-full bg-gray-900/90 backdrop-blur-md p-5 sm:p-6 rounded-3xl border border-gray-700/80 shadow-2xl space-y-6 select-none">
      {/* Header & Stats Cards */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center shadow-lg shadow-blue-500/10">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              Tiến độ &amp; Lịch sử Luyện tập ({attemptsData.length} lần thử)
            </h3>
            <p className="text-xs text-gray-400">Theo dõi sự tiến bộ điểm số qua từng lần nộp</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {scoreDiff > 0 ? (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-green-500/20 text-green-400 border border-green-500/30">
              +{scoreDiff}% tiến bộ 🎉
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
              Cao nhất: {bestScore}%
            </span>
          )}
        </div>
      </div>

      {/* Mini Line Chart SVG */}
      {attemptsData.length > 1 && (
        <div className="bg-gray-950/80 p-3 sm:p-4 rounded-2xl border border-gray-800/80 relative">
          <div className="text-[10px] text-gray-500 uppercase font-bold mb-1 flex justify-between">
            <span>Biểu đồ điểm số tổng kết (%)</span>
            <span>100%</span>
          </div>

          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-28 overflow-visible">
            {/* Horizontal Grid lines */}
            <line x1="0" y1={paddingY} x2={svgWidth} y2={paddingY} stroke="#374151" strokeDasharray="3 3" />
            <line x1="0" y1={svgHeight / 2} x2={svgWidth} y2={svgHeight / 2} stroke="#374151" strokeDasharray="3 3" />
            <line x1="0" y1={svgHeight - paddingY} x2={svgWidth} y2={svgHeight - paddingY} stroke="#374151" />

            {/* Filled Area below line */}
            <polygon
              points={`0,${svgHeight - paddingY} ${pointsPath} ${svgWidth},${svgHeight - paddingY}`}
              fill="url(#progressGradient)"
              opacity="0.3"
            />

            {/* Gradient definition */}
            <defs>
              <linearGradient id="progressGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a3e635" />
                <stop offset="100%" stopColor="#a3e635" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Line connecting points */}
            <polyline
              points={pointsPath}
              fill="none"
              stroke="#a3e635"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Interactive Points */}
            {points.map((p, idx) => {
              const isSelected = selectedSubmissionId === p.data.submission.id;
              return (
                <g 
                  key={idx} 
                  className="cursor-pointer group"
                  onClick={() => onSelectSubmission && onSelectSubmission(p.data.submission)}
                >
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isSelected ? 7 : 5}
                    fill={p.data.isPassed ? '#4ade80' : '#f87171'}
                    stroke="#030712"
                    strokeWidth="2"
                    className="transition-transform group-hover:scale-125"
                  />
                  <text
                    x={p.x}
                    y={p.y - 10}
                    textAnchor="middle"
                    fill="#e5e7eb"
                    fontSize="10"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    {p.data.total}%
                  </text>
                  <text
                    x={p.x}
                    y={svgHeight - 4}
                    textAnchor="middle"
                    fill="#9ca3af"
                    fontSize="9"
                    fontFamily="sans-serif"
                  >
                    #{p.data.attemptNumber}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}

      {/* Attempt Cards List - Clickable to review past attempt */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-gray-400" />
          <span>Danh sách các lần nộp (Bấm vào để xem lại chi tiết):</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {sorted.map((sub, idx) => {
            const isSelected = selectedSubmissionId === sub.id;
            let total = 0;
            if (sub.detailedScore?.hybrid_target_score !== undefined) {
              total = sub.detailedScore.hybrid_target_score > 1 ? sub.detailedScore.hybrid_target_score : sub.detailedScore.hybrid_target_score * 100;
            } else if (sub.scores?.total_score !== undefined) {
              total = sub.scores.total_score * 100;
            }

            return (
              <button
                key={sub.id || idx}
                type="button"
                onClick={() => onSelectSubmission && onSelectSubmission(sub)}
                className={`p-3.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer flex items-center justify-between gap-3 ${
                  isSelected 
                    ? 'bg-blue-950/60 border-blue-400 ring-2 ring-blue-400/40 shadow-lg shadow-blue-500/15 scale-[1.02]' 
                    : 'bg-gray-950/60 border-gray-800 hover:border-gray-700 hover:bg-gray-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-mono font-bold text-xs ${
                    sub.isPassed ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    #{sub.attemptNumber || idx + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-white">Lần thử {sub.attemptNumber || idx + 1}</span>
                      {sub.isPassed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-red-400" />
                      )}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {sub.createdAt ? (
                        sub.createdAt.toDate ? sub.createdAt.toDate().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Vừa xong'
                      ) : 'Vừa xong'}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-mono text-sm font-black text-lime-400 block">
                    {Math.round(total)}%
                  </span>
                  <span className={`text-[10px] font-medium ${sub.isPassed ? 'text-green-400' : 'text-red-400'}`}>
                    {sub.isPassed ? 'Đạt' : 'Chưa đạt'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
