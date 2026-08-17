'use client';

import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  ChevronDown, 
  Volume2
} from 'lucide-react';
import { SubmissionData } from '@/app/lib/firestore';
import { getAudioUrl } from '@/app/lib/storage';
import { useLanguage } from '@/app/contexts/LanguageContext';
import DarkAudioPlayer from '@/app/components/DarkAudioPlayer';
import PhonemeKaraokeVisualizer from '@/app/components/PhonemeKaraokeVisualizer';
import { CharScoreItem } from '@/app/components/PhonemeDiagnosticCard';

interface StudentProgressChartProps {
  submissions: SubmissionData[];
  expectedWord: string;
}

// Safely normalize any score value to integer [0, 100] (Fixes 9477% and 10000% bug)
function normalizeScore(val: any): number {
  if (val === undefined || val === null) return 0;
  let n = Number(val);
  if (isNaN(n) || !isFinite(n)) return 0;
  while (n > 100) n = n / 100;
  if (n <= 1.0 && n > 0) n = n * 100;
  return Math.min(100, Math.max(0, Math.round(n)));
}

// Single Expandable Attempt Accordion Item
function AttemptAccordionItem({
  submission,
  attemptNumber,
  expectedWord
}: {
  submission: SubmissionData;
  attemptNumber: number;
  expectedWord: string;
}) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [resolvedAudioUrl, setResolvedAudioUrl] = useState<string | null>(submission.audioUrl || null);
  const [audioLoading, setAudioLoading] = useState(false);

  // Playback sync for Karaoke
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Load storage audio url if not present
  useEffect(() => {
    if (isOpen && !resolvedAudioUrl) {
      const storagePath = submission.audioStoragePath || (submission as any).audioPath;
      if (storagePath) {
        setAudioLoading(true);
        getAudioUrl(storagePath)
          .then(url => {
            setResolvedAudioUrl(url);
          })
          .catch(err => {
            console.error('Error fetching audio url:', err);
          })
          .finally(() => {
            setAudioLoading(false);
          });
      }
    }
  }, [isOpen, resolvedAudioUrl, submission]);

  // Normalize scores to clean integers [0 - 100]
  const rawTotal = submission.detailedScore?.hybrid_target_score !== undefined
    ? submission.detailedScore.hybrid_target_score
    : (submission.scores?.total_score !== undefined ? submission.scores.total_score : 0);
  const totalScore = normalizeScore(rawTotal);

  const rawPhoneme = submission.scores?.phoneme_score !== undefined 
    ? submission.scores.phoneme_score 
    : (submission.detailedScore?.wav2vec_raw_score !== undefined ? submission.detailedScore.wav2vec_raw_score : 0);
  const phonemeScore = normalizeScore(rawPhoneme);

  const rawDtw = submission.scores?.dtw_score !== undefined 
    ? submission.scores.dtw_score 
    : (submission.detailedScore?.dtw_score !== undefined ? submission.detailedScore.dtw_score : 0);
  const dtwScore = normalizeScore(rawDtw);

  const rawWhisper = submission.scores?.whisper_score !== undefined 
    ? submission.scores.whisper_score 
    : (submission.detailedScore?.whisper_raw_score !== undefined ? submission.detailedScore.whisper_raw_score : 0);
  const whisperScore = normalizeScore(rawWhisper);

  // Generate fallback charScores if legacy submission doesn't have it
  const charScores: CharScoreItem[] = submission.charScores || submission.detailedScore?.char_scores || (
    expectedWord.split('').filter(c => c !== ' ').map((char) => ({
      char,
      score: phonemeScore > 0 ? phonemeScore / 100 : 0.75,
      actual: char,
      duration_feedback: null
    }))
  );

  return (
    <div className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
      isOpen 
        ? 'bg-gray-950/95 border-lime-400/60 shadow-2xl shadow-lime-500/10' 
        : 'bg-gray-950/60 border-gray-800 hover:border-gray-700 hover:bg-gray-900/80'
    }`}>
      {/* Accordion Header (Clickable) */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="p-4 flex items-center justify-between gap-3 cursor-pointer select-none"
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono font-black text-xs shadow-sm ${
            submission.isPassed 
              ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            #{attemptNumber}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white">Attempt #{attemptNumber}</span>
              {submission.isPassed ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                  <CheckCircle2 className="w-3 h-3" /> {t('practice.status_passed')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                  <XCircle className="w-3 h-3" /> {t('practice.status_failed')}
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {submission.createdAt?.toDate 
                ? submission.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) 
                : 'Just now'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="font-mono text-lg font-black text-lime-400 block leading-tight">
              {totalScore}
            </span>
            <span className="text-[10px] text-gray-500">{t('practice.score_overall')}</span>
          </div>

          <div className={`p-1.5 rounded-xl bg-gray-900 text-gray-400 border border-gray-800 transition-transform duration-300 ${
            isOpen ? 'rotate-180 text-lime-400 border-lime-400/40' : ''
          }`}>
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Expanded Accordion Body */}
      {isOpen && (
        <div className="p-4 sm:p-6 border-t border-gray-800/80 bg-gray-900/90 space-y-5 animate-in fade-in duration-200">
          {/* 1. Score Breakdown 4 Clean Cards (Integers 0 - 100 without %) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="bg-gray-950/80 p-3 rounded-2xl border border-gray-800">
              <span className="text-gray-400 block text-[10px] uppercase font-bold">{t('practice.score_phonetics')}</span>
              <strong className="text-blue-400 font-mono text-xl font-black">{phonemeScore}</strong>
            </div>
            <div className="bg-gray-950/80 p-3 rounded-2xl border border-gray-800">
              <span className="text-gray-400 block text-[10px] uppercase font-bold">{t('practice.score_intonation')}</span>
              <strong className="text-purple-400 font-mono text-xl font-black">{dtwScore}</strong>
            </div>
            <div className="bg-gray-950/80 p-3 rounded-2xl border border-gray-800">
              <span className="text-gray-400 block text-[10px] uppercase font-bold">{t('practice.score_completeness')}</span>
              <strong className="text-pink-400 font-mono text-xl font-black">{whisperScore}</strong>
            </div>
            <div className="bg-gray-950/80 p-3 rounded-2xl border border-gray-800">
              <span className="text-gray-400 block text-[10px] uppercase font-bold">{t('practice.score_overall')}</span>
              <strong className="text-lime-400 font-mono text-xl font-black">{totalScore}</strong>
            </div>
          </div>

          {/* 2. Playback Audio Player */}
          {audioLoading ? (
            <div className="flex items-center justify-center p-6 bg-gray-950/80 rounded-2xl border border-gray-800 text-lime-400 text-xs gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-lime-400"></div>
              <span>Loading audio...</span>
            </div>
          ) : resolvedAudioUrl ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray-300">
                <Volume2 className="w-4 h-4 text-lime-400" />
                <span>Audio Playback (Attempt #{attemptNumber}):</span>
              </div>
              <DarkAudioPlayer
                audioUrl={resolvedAudioUrl}
                onTimeUpdate={(cTime, dur) => {
                  setCurrentTime(cTime);
                  setDuration(dur);
                  setIsPlaying(true);
                }}
                onEnded={() => {
                  setIsPlaying(false);
                  setCurrentTime(0);
                }}
              />
            </div>
          ) : null}

          {/* 3. Word-Level Karaoke Visualizer */}
          <PhonemeKaraokeVisualizer
            expectedWord={expectedWord}
            charScores={charScores}
            currentTime={currentTime}
            duration={duration}
            isPlaying={isPlaying}
          />
        </div>
      )}
    </div>
  );
}

export default function StudentProgressChart({
  submissions,
  expectedWord
}: StudentProgressChartProps) {
  const { t } = useLanguage();
  if (!submissions || submissions.length === 0) return null;

  // Sort ascending by attemptNumber
  const sorted = [...submissions].sort((a, b) => (a.attemptNumber || 1) - (b.attemptNumber || 1));

  // Calculate scores list
  const attemptsData = sorted.map((s, idx) => {
    const rawTotal = s.detailedScore?.hybrid_target_score !== undefined
      ? s.detailedScore.hybrid_target_score
      : (s.scores?.total_score !== undefined ? s.scores.total_score : 0);

    return {
      submission: s,
      attemptNumber: s.attemptNumber || idx + 1,
      total: normalizeScore(rawTotal),
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
  const svgHeight = 110;
  const paddingX = 30;
  const paddingY = 20;

  const points = attemptsData.map((d, i) => {
    const x = attemptsData.length === 1 
      ? svgWidth / 2 
      : paddingX + (i / (attemptsData.length - 1)) * (svgWidth - paddingX * 2);
    const y = (svgHeight - paddingY) - (d.total / 100) * (svgHeight - paddingY * 2);
    return { x, y, data: d };
  });

  const pointsPath = points.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <div className="w-full bg-gray-900/90 backdrop-blur-md p-5 sm:p-6 rounded-3xl border border-gray-700/80 shadow-2xl space-y-6 select-none">
      {/* Header & Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center shadow-lg shadow-blue-500/10">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              Practice Progress &amp; History ({attemptsData.length} attempts)
            </h3>
            <p className="text-xs text-gray-400">Score progress across your attempts</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {scoreDiff > 0 ? (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-green-500/20 text-green-400 border border-green-500/30">
              +{scoreDiff} points improvement 🎉
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
              Best Score: {bestScore}
            </span>
          )}
        </div>
      </div>

      {/* Mini Line Chart SVG */}
      {attemptsData.length > 1 && (
        <div className="bg-gray-950/80 p-3 sm:p-4 rounded-2xl border border-gray-800/80 relative">
          <div className="text-[10px] text-gray-500 uppercase font-bold mb-1 flex justify-between">
            <span>Progress Score (0 - 100)</span>
            <span>100</span>
          </div>

          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-24 overflow-visible">
            <line x1="0" y1={paddingY} x2={svgWidth} y2={paddingY} stroke="#374151" strokeDasharray="3 3" />
            <line x1="0" y1={svgHeight / 2} x2={svgWidth} y2={svgHeight / 2} stroke="#374151" strokeDasharray="3 3" />
            <line x1="0" y1={svgHeight - paddingY} x2={svgWidth} y2={svgHeight - paddingY} stroke="#374151" />

            <polygon
              points={`0,${svgHeight - paddingY} ${pointsPath} ${svgWidth},${svgHeight - paddingY}`}
              fill="url(#progressGradient)"
              opacity="0.3"
            />

            <defs>
              <linearGradient id="progressGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a3e635" />
                <stop offset="100%" stopColor="#a3e635" stopOpacity="0" />
              </linearGradient>
            </defs>

            <polyline
              points={pointsPath}
              fill="none"
              stroke="#a3e635"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {points.map((p, idx) => (
              <g key={idx}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={5}
                  fill={p.data.isPassed ? '#4ade80' : '#f87171'}
                  stroke="#030712"
                  strokeWidth="2"
                />
                <text
                  x={p.x}
                  y={p.y - 8}
                  textAnchor="middle"
                  fill="#e5e7eb"
                  fontSize="10"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  {p.data.total}
                </text>
                <text
                  x={p.x}
                  y={svgHeight - 3}
                  textAnchor="middle"
                  fill="#9ca3af"
                  fontSize="9"
                  fontFamily="sans-serif"
                >
                  #{p.data.attemptNumber}
                </text>
              </g>
            ))}
          </svg>
        </div>
      )}

      {/* Accordion List for Each Attempt */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-gray-400" />
          <span>Attempts History (Click to expand Playback &amp; Karaoke):</span>
        </h4>

        <div className="space-y-3">
          {sorted.map((sub, idx) => (
            <AttemptAccordionItem
              key={sub.id || idx}
              submission={sub}
              attemptNumber={sub.attemptNumber || idx + 1}
              expectedWord={expectedWord}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
