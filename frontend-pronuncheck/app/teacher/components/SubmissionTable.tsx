'use client';

import { useState } from 'react';
import { SubmissionData, AssignmentData } from '@/app/lib/firestore';
import { getAudioUrl } from '@/app/lib/storage';

interface SubmissionTableProps {
  submissions: SubmissionData[];
  assignments: AssignmentData[];
}

export default function SubmissionTable({ submissions, assignments }: SubmissionTableProps) {
  const [filterAssignmentId, setFilterAssignmentId] = useState<string>('all');
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);

  const filteredSubmissions = filterAssignmentId === 'all'
    ? submissions
    : submissions.filter(s => s.assignmentId === filterAssignmentId);

  const handlePlayAudio = async (storagePath: string) => {
    try {
      const url = await getAudioUrl(storagePath);
      const audio = new Audio(url);
      setPlayingAudio(storagePath);
      audio.onended = () => setPlayingAudio(null);
      await audio.play();
    } catch (error) {
      console.error(error);
      alert('Không thể phát audio.');
      setPlayingAudio(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold">Kết quả học sinh</h3>
        <select
          value={filterAssignmentId}
          onChange={(e) => setFilterAssignmentId(e.target.value)}
          className="bg-gray-900 border border-gray-700 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
        >
          <option value="all">Tất cả bài tập</option>
          {assignments.map(a => (
            <option key={a.id} value={a.id}>{a.word}</option>
          ))}
        </select>
      </div>

      <div className="relative overflow-x-auto rounded-xl border border-gray-700">
        <table className="w-full text-sm text-left text-gray-400">
          <thead className="text-xs text-gray-300 uppercase bg-gray-900">
            <tr>
              <th scope="col" className="px-5 py-4">Email học sinh</th>
              <th scope="col" className="px-5 py-4">Từ / Câu</th>
              <th scope="col" className="px-3 py-4 text-center">Lần thử</th>
              <th scope="col" className="px-4 py-4 text-center" title="Độ chuẩn xác âm vị (Wav2Vec2 + Luật ngữ âm)">Âm vị</th>
              <th scope="col" className="px-4 py-4 text-center" title="So khớp cao độ ngữ điệu (F0 DTW)">Ngữ điệu</th>
              <th scope="col" className="px-4 py-4 text-center" title="Độ trọn vẹn nhận diện (Faster-Whisper)">Whisper</th>
              <th scope="col" className="px-4 py-4 text-center" title="Điểm tổng hợp Dynamic Sigmoid">Tổng kết</th>
              <th scope="col" className="px-4 py-4 text-center">Kết quả</th>
              <th scope="col" className="px-4 py-4 text-center">Nghe</th>
            </tr>
          </thead>
          <tbody>
            {filteredSubmissions.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                  Chưa có bài nộp
                </td>
              </tr>
            ) : (
              filteredSubmissions.map(sub => (
                <tr key={sub.id} className="bg-gray-800 border-b border-gray-700 hover:bg-gray-750">
                  <td className="px-5 py-4 font-medium text-white whitespace-nowrap">
                    {sub.studentEmail}
                  </td>
                  <td className="px-5 py-4 font-medium text-gray-200">{sub.word}</td>
                  <td className="px-3 py-4 text-center">
                    {sub.attemptNumber} / {assignments.find(a => a.id === sub.assignmentId)?.maxAttempts || '?'}
                  </td>
                  <td className="px-4 py-4 text-center font-medium text-blue-400">
                    {(sub.detailedScore.wav2vec_raw_score > 1 ? sub.detailedScore.wav2vec_raw_score : sub.detailedScore.wav2vec_raw_score * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-4 text-center font-medium text-purple-400">
                    {((sub.detailedScore.dtw_score ?? 80) > 1 ? (sub.detailedScore.dtw_score ?? 80) : (sub.detailedScore.dtw_score ?? 0.8) * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-4 text-center text-gray-300">
                    {(sub.detailedScore.whisper_raw_score > 1 ? sub.detailedScore.whisper_raw_score : sub.detailedScore.whisper_raw_score * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-4 text-center font-bold text-white text-base">
                    {(sub.detailedScore.hybrid_target_score > 1 ? sub.detailedScore.hybrid_target_score : sub.detailedScore.hybrid_target_score * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      sub.isPassed ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}>
                      {sub.isPassed ? 'Đạt' : 'Chưa đạt'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => handlePlayAudio(sub.audioStoragePath)}
                      disabled={playingAudio === sub.audioStoragePath}
                      className="p-2 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors disabled:opacity-50"
                      title="Nghe audio"
                    >
                      {playingAudio === sub.audioStoragePath ? (
                        <svg className="w-4 h-4 text-blue-400 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
