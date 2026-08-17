'use client';

import React, { useState, useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from 'recharts';
import { AssignmentData, SubmissionData } from '@/app/lib/firestore';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { 
  Trophy, 
  Target, 
  TrendingUp, 
  Users, 
  CheckCircle2, 
  BarChart3,
  Layers
} from 'lucide-react';

interface StudentAnalyticsDashboardProps {
  submissions: SubmissionData[];
  assignments: AssignmentData[];
}

function normalizeScore(val: any): number {
  if (val === undefined || val === null) return 0;
  let n = Number(val);
  if (isNaN(n) || !isFinite(n)) return 0;
  while (n > 100) n = n / 100;
  if (n <= 1.0 && n > 0) n = n * 100;
  return Math.min(100, Math.max(0, Math.round(n)));
}

export default function StudentAnalyticsDashboard({
  submissions,
  assignments
}: StudentAnalyticsDashboardProps) {
  const { t } = useLanguage();
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('all');

  // Filter submissions by selected assignment
  const filteredSubs = useMemo(() => {
    if (selectedAssignmentId === 'all') return submissions;
    return submissions.filter(s => s.assignmentId === selectedAssignmentId);
  }, [submissions, selectedAssignmentId]);

  // Unique students count
  const uniqueStudentsCount = useMemo(() => {
    const set = new Set<string>();
    filteredSubs.forEach(s => {
      if (s.studentEmail) set.add(s.studentEmail.toLowerCase());
    });
    return set.size;
  }, [filteredSubs]);

  // Overall calculations
  const totalCount = filteredSubs.length;
  const passedCount = filteredSubs.filter(s => s.isPassed).length;
  const passRate = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;

  const avgPhoneme = totalCount > 0
    ? Math.round(filteredSubs.reduce((acc, s) => acc + normalizeScore(s.scores?.phoneme_score ?? s.detailedScore?.wav2vec_raw_score), 0) / totalCount)
    : 0;

  const avgDtw = totalCount > 0
    ? Math.round(filteredSubs.reduce((acc, s) => acc + normalizeScore(s.scores?.dtw_score ?? s.detailedScore?.dtw_score), 0) / totalCount)
    : 0;

  const avgWhisper = totalCount > 0
    ? Math.round(filteredSubs.reduce((acc, s) => acc + normalizeScore(s.scores?.whisper_score ?? s.detailedScore?.whisper_raw_score), 0) / totalCount)
    : 0;

  const avgTotal = totalCount > 0
    ? Math.round(filteredSubs.reduce((acc, s) => acc + normalizeScore(s.scores?.total_score ?? s.detailedScore?.hybrid_target_score), 0) / totalCount)
    : 0;

  // 1. Score Distribution Data (4 tiers)
  const scoreDistributionData = useMemo(() => {
    let excellent = 0; // >= 85
    let good = 0;      // 70 - 84
    let fair = 0;      // 50 - 69
    let needsWork = 0; // < 50

    filteredSubs.forEach(s => {
      const score = normalizeScore(s.scores?.total_score ?? s.detailedScore?.hybrid_target_score);
      if (score >= 85) excellent++;
      else if (score >= 70) good++;
      else if (score >= 50) fair++;
      else needsWork++;
    });

    return [
      { name: 'Xuất sắc (85-100)', count: excellent, color: '#4ade80' },
      { name: 'Khá (70-84)', count: good, color: '#60a5fa' },
      { name: 'Trung bình (50-69)', count: fair, color: '#facc15' },
      { name: 'Cần luyện thêm (<50)', count: needsWork, color: '#f87171' }
    ];
  }, [filteredSubs]);

  // 2. Average Skills Breakdown Data
  const skillsData = useMemo(() => {
    return [
      { skill: 'Âm vị (Phonetics)', score: avgPhoneme, color: '#60a5fa' },
      { skill: 'Ngữ điệu (Intonation)', score: avgDtw, color: '#c084fc' },
      { skill: 'Tính trọn vẹn (Completeness)', score: avgWhisper, color: '#f472b6' },
      { skill: 'Điểm tổng (Overall)', score: avgTotal, color: '#a3e635' }
    ];
  }, [avgPhoneme, avgDtw, avgWhisper, avgTotal]);

  if (submissions.length === 0) return null;

  return (
    <div className="bg-gray-800/90 p-5 sm:p-7 rounded-3xl border border-gray-700/80 shadow-2xl space-y-6 select-none animate-in fade-in duration-200">
      {/* Top Header & Assignment Filter Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-700/80 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30 shadow-lg shadow-blue-500/10">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
              <span>📊</span> {t('analytics.title')}
            </h3>
            <p className="text-xs sm:text-sm text-gray-400">
              {t('analytics.desc')}
            </p>
          </div>
        </div>

        {/* Assignment Filter Dropdown */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-gray-300 whitespace-nowrap">
            {t('analytics.filter_assignment')}:
          </label>
          <select
            value={selectedAssignmentId}
            onChange={(e) => setSelectedAssignmentId(e.target.value)}
            className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-blue-400 cursor-pointer max-w-[220px] truncate"
          >
            <option value="all">{t('analytics.all_assignments')} ({submissions.length} bài nộp)</option>
            {assignments.map((a) => {
              const count = submissions.filter(s => s.assignmentId === a.id).length;
              return (
                <option key={a.id} value={a.id}>
                  {a.title || a.word} ({count} bài nộp)
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* 3 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* KPI 1: Pass Rate */}
        <div className="bg-gray-900/90 p-4 sm:p-5 rounded-2xl border border-green-500/30 flex items-center justify-between shadow-md">
          <div className="space-y-1">
            <span className="text-xs font-bold text-gray-400 block uppercase">
              {t('analytics.pass_rate')}
            </span>
            <div className="flex items-baseline gap-2">
              <strong className="text-2xl sm:text-3xl font-black font-mono text-green-400">
                {passRate}%
              </strong>
              <span className="text-xs text-gray-400">
                ({passedCount} / {totalCount} bài Đạt)
              </span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-green-500/10 text-green-400 flex items-center justify-center border border-green-500/20 shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 2: Average Score */}
        <div className="bg-gray-900/90 p-4 sm:p-5 rounded-2xl border border-lime-500/30 flex items-center justify-between shadow-md">
          <div className="space-y-1">
            <span className="text-xs font-bold text-gray-400 block uppercase">
              {t('analytics.avg_score')}
            </span>
            <div className="flex items-baseline gap-2">
              <strong className="text-2xl sm:text-3xl font-black font-mono text-lime-400">
                {avgTotal}
              </strong>
              <span className="text-xs text-gray-400">/ 100</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-lime-500/10 text-lime-400 flex items-center justify-center border border-lime-500/20 shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 3: Active Students */}
        <div className="bg-gray-900/90 p-4 sm:p-5 rounded-2xl border border-blue-500/30 flex items-center justify-between shadow-md">
          <div className="space-y-1">
            <span className="text-xs font-bold text-gray-400 block uppercase">
              {t('analytics.active_students')}
            </span>
            <div className="flex items-baseline gap-2">
              <strong className="text-2xl sm:text-3xl font-black font-mono text-blue-400">
                {uniqueStudentsCount}
              </strong>
              <span className="text-xs text-gray-400">
                học sinh ({totalCount} lượt làm)
              </span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20 shrink-0">
            <Users className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 2 Interactive Recharts Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
        {/* Chart 1: Score Distribution */}
        <div className="bg-gray-900/80 p-5 rounded-2xl border border-gray-700/80 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-400" />
              <span>{t('analytics.chart_score_dist')}</span>
            </h4>
            <span className="text-[11px] text-gray-400 font-mono">
              Tổng {totalCount} bài nộp
            </span>
          </div>

          <div className="h-60 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scoreDistributionData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <XAxis 
                  dataKey="name" 
                  stroke="#9ca3af" 
                  fontSize={10} 
                  tickLine={false} 
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                  formatter={(value: any) => [`${value} bài nộp`, 'Số lượng']}
                />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {scoreDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Average Skills Breakdown */}
        <div className="bg-gray-900/80 p-5 rounded-2xl border border-gray-700/80 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
              <Target className="w-4 h-4 text-purple-400" />
              <span>{t('analytics.chart_skills_avg')}</span>
            </h4>
            <span className="text-[11px] text-gray-400 font-mono">
              Thang điểm 0 - 100
            </span>
          </div>

          <div className="h-60 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={skillsData} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                <XAxis type="number" domain={[0, 100]} stroke="#9ca3af" fontSize={11} tickLine={false} />
                <YAxis 
                  dataKey="skill" 
                  type="category" 
                  stroke="#9ca3af" 
                  fontSize={10} 
                  tickLine={false}
                  width={140}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                  formatter={(value: any) => [`${value} / 100`, 'Điểm trung bình']}
                />
                <Bar dataKey="score" radius={[0, 8, 8, 0]}>
                  {skillsData.map((entry, index) => (
                    <Cell key={`cell-skill-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
