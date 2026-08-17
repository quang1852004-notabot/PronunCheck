import * as XLSX from 'xlsx';
import { ClassData, AssignmentData, SubmissionData, ClassMemberData } from '@/app/lib/firestore';

function normalizeScore(val: any): number {
  if (val === undefined || val === null) return 0;
  let n = Number(val);
  if (isNaN(n) || !isFinite(n)) return 0;
  while (n > 100) n = n / 100;
  if (n <= 1.0 && n > 0) n = n * 100;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function parseSubmissionTime(sub: SubmissionData): string {
  if (sub.createdAt?.toDate) {
    const d = sub.createdAt.toDate();
    return d.toLocaleString('vi-VN');
  }
  if (sub.createdAt?.seconds) {
    const d = new Date(sub.createdAt.seconds * 1000);
    return d.toLocaleString('vi-VN');
  }
  // Extract from audio filename timestamp if available: studentId_1723854123456.webm
  const path = sub.audioStoragePath || sub.audioUrl || '';
  const match = path.match(/_(\d{13})\./);
  if (match && match[1]) {
    const d = new Date(Number(match[1]));
    return d.toLocaleString('vi-VN');
  }
  return '-';
}

export function exportClassDataToExcel({
  classData,
  assignments,
  submissions,
  members
}: {
  classData: ClassData;
  assignments: AssignmentData[];
  submissions: SubmissionData[];
  members: ClassMemberData[];
}) {
  const assignmentMap = new Map<string, AssignmentData>();
  assignments.forEach(a => {
    if (a.id) assignmentMap.set(a.id, a);
  });

  // Unique list of students (from members + submissions)
  const studentEmailSet = new Set<string>();
  members.forEach(m => {
    if (m.studentEmail) studentEmailSet.add(m.studentEmail.toLowerCase());
  });
  submissions.forEach(s => {
    if (s.studentEmail) studentEmailSet.add(s.studentEmail.toLowerCase());
  });
  const allStudentEmails = Array.from(studentEmailSet).sort();

  // 1. Build Sheet 1: Student Overview
  const sheet1Data = allStudentEmails.map((email, idx) => {
    const studentSubs = submissions.filter(s => s.studentEmail?.toLowerCase() === email);
    const memberInfo = members.find(m => m.studentEmail?.toLowerCase() === email);

    let joinedAtStr = '-';
    if (memberInfo?.joinedAt?.toDate) {
      joinedAtStr = memberInfo.joinedAt.toDate().toLocaleDateString('vi-VN');
    }

    const totalSubmissions = studentSubs.length;
    const passedCount = studentSubs.filter(s => s.isPassed).length;
    const passRate = totalSubmissions > 0 ? Math.round((passedCount / totalSubmissions) * 100) : 0;

    const avgPhoneme = totalSubmissions > 0
      ? Math.round(studentSubs.reduce((acc, s) => acc + normalizeScore(s.scores?.phoneme_score ?? s.detailedScore?.wav2vec_raw_score), 0) / totalSubmissions)
      : 0;

    const avgDtw = totalSubmissions > 0
      ? Math.round(studentSubs.reduce((acc, s) => acc + normalizeScore(s.scores?.dtw_score ?? s.detailedScore?.dtw_score), 0) / totalSubmissions)
      : 0;

    const avgWhisper = totalSubmissions > 0
      ? Math.round(studentSubs.reduce((acc, s) => acc + normalizeScore(s.scores?.whisper_score ?? s.detailedScore?.whisper_raw_score), 0) / totalSubmissions)
      : 0;

    const avgTotal = totalSubmissions > 0
      ? Math.round(studentSubs.reduce((acc, s) => acc + normalizeScore(s.scores?.total_score ?? s.detailedScore?.hybrid_target_score), 0) / totalSubmissions)
      : 0;

    return {
      'STT': idx + 1,
      'Email Học Sinh': email,
      'Ngày Tham Gia': joinedAtStr,
      'Số Bài Đã Nộp': totalSubmissions,
      'Số Bài Đạt': passedCount,
      'Tỷ Lệ Đạt (%)': `${passRate}%`,
      'Điểm TB Âm Vị': avgPhoneme,
      'Điểm TB Ngữ Điệu': avgDtw,
      'Điểm TB Trọn Vẹn': avgWhisper,
      'Điểm Tổng TB': avgTotal,
    };
  });

  // 2. Build Sheet 2: All Submissions Detail
  const sortedSubmissions = [...submissions].sort((a, b) => {
    const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
    const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
    return bTime - aTime;
  });

  const sheet2Data = sortedSubmissions.map((sub, idx) => {
    const assignment = assignmentMap.get(sub.assignmentId);
    const phonemeScore = normalizeScore(sub.scores?.phoneme_score ?? sub.detailedScore?.wav2vec_raw_score);
    const dtwScore = normalizeScore(sub.scores?.dtw_score ?? sub.detailedScore?.dtw_score);
    const whisperScore = normalizeScore(sub.scores?.whisper_score ?? sub.detailedScore?.whisper_raw_score);
    const totalScore = normalizeScore(sub.scores?.total_score ?? sub.detailedScore?.hybrid_target_score);

    return {
      'STT': idx + 1,
      'Thời Gian Nộp': parseSubmissionTime(sub),
      'Email Học Sinh': sub.studentEmail,
      'Tên Bài Tập': assignment?.title || '-',
      'Từ / Câu Mục Tiêu': sub.word,
      'Lần Thử': sub.attemptNumber || 1,
      'Điểm Âm Vị': phonemeScore,
      'Điểm Ngữ Điệu': dtwScore,
      'Điểm Trọn Vẹn': whisperScore,
      'Điểm Tổng': totalScore,
      'Kết Quả': sub.isPassed ? 'ĐẠT' : 'CHƯA ĐẠT',
      'Nhận Xét AI': sub.feedback || '-',
      'Link Audio': sub.audioUrl || '-'
    };
  });

  // Create workbook and worksheets
  const wb = XLSX.utils.book_new();

  const ws1 = XLSX.utils.json_to_sheet(sheet1Data);
  const ws2 = XLSX.utils.json_to_sheet(sheet2Data);

  // Auto-fit column widths
  ws1['!cols'] = [
    { wch: 6 },  // STT
    { wch: 28 }, // Email
    { wch: 15 }, // Ngày tham gia
    { wch: 14 }, // Số bài
    { wch: 12 }, // Số đạt
    { wch: 14 }, // Tỷ lệ
    { wch: 14 }, // TB Âm vị
    { wch: 15 }, // TB Ngữ điệu
    { wch: 15 }, // TB Trọn vẹn
    { wch: 14 }  // TB Tổng
  ];

  ws2['!cols'] = [
    { wch: 6 },  // STT
    { wch: 20 }, // Thời gian
    { wch: 28 }, // Email
    { wch: 25 }, // Tên bài
    { wch: 30 }, // Từ đọc
    { wch: 10 }, // Lần thử
    { wch: 12 }, // Âm vị
    { wch: 12 }, // Ngữ điệu
    { wch: 12 }, // Trọn vẹn
    { wch: 12 }, // Điểm tổng
    { wch: 12 }, // Kết quả
    { wch: 40 }, // Nhận xét
    { wch: 40 }  // Audio
  ];

  XLSX.utils.book_append_sheet(wb, ws1, 'Tổng Quan Học Sinh');
  XLSX.utils.book_append_sheet(wb, ws2, 'Chi Tiết Bài Nộp');

  // Generate filename: Báo_Cáo_Lớp_[TênLớp]_[YYYYMMDD].xlsx
  const safeClassName = (classData.className || classData.name || 'Class').replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]/g, '_');
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const fileName = `Bao_Cao_${safeClassName}_${dateStr}.xlsx`;

  XLSX.writeFile(wb, fileName);
}
