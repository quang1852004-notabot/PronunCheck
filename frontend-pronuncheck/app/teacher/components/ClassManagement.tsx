'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  ClassData, 
  AssignmentData, 
  SubmissionData, 
  ClassMemberData,
  updateClass,
  getClassMembers,
  addMemberByEmail,
  removeMember
} from '@/app/lib/firestore';
import { exportClassDataToExcel } from '@/app/lib/excelExport';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useToast } from '@/app/contexts/ToastContext';
import { 
  Settings, 
  Edit3, 
  KeyRound, 
  Users, 
  UserPlus, 
  Trash2, 
  FileSpreadsheet, 
  Eye, 
  EyeOff, 
  Save, 
  CheckCircle2, 
  ShieldCheck, 
  Lock, 
  Unlock,
  AlertTriangle,
  Search
} from 'lucide-react';

interface ClassManagementProps {
  classId: string;
  classData: ClassData;
  assignments: AssignmentData[];
  submissions: SubmissionData[];
  onClassUpdated: () => void;
}

export default function ClassManagement({
  classId,
  classData,
  assignments,
  submissions,
  onClassUpdated
}: ClassManagementProps) {
  const { t } = useLanguage();
  const { success, error: toastError } = useToast();

  // Class Name State
  const [className, setClassName] = useState(classData.className || classData.name || '');
  const [savingName, setSavingName] = useState(false);

  // Password State
  const [password, setPassword] = useState(classData.password || '');
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Members State
  const [members, setMembers] = useState<ClassMemberData[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');

  // Delete Member Modal State
  const [deletingMember, setDeletingMember] = useState<ClassMemberData | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  // Load Members
  const loadMembers = useCallback(async () => {
    setLoadingMembers(true);
    try {
      const data = await getClassMembers(classId);
      setMembers(data);
    } catch (err) {
      console.error('Error fetching members:', err);
    } finally {
      setLoadingMembers(false);
    }
  }, [classId]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  // Handle Save Class Name
  const handleSaveClassName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!className.trim()) {
      toastError('Tên lớp học không được để trống.');
      return;
    }
    setSavingName(true);
    try {
      await updateClass(classId, {
        name: className.trim(),
        className: className.trim()
      });
      success(t('mgmt.name_updated'));
      onClassUpdated();
    } catch (err: any) {
      console.error(err);
      toastError(err.message || 'Lỗi khi cập nhật tên lớp học.');
    } finally {
      setSavingName(false);
    }
  };

  // Handle Save Password
  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPassword(true);
    try {
      await updateClass(classId, {
        password: password.trim()
      });
      success(password.trim() ? t('mgmt.password_updated') : t('mgmt.password_removed'));
      onClassUpdated();
    } catch (err: any) {
      console.error(err);
      toastError(err.message || 'Lỗi khi cập nhật mật khẩu.');
    } finally {
      setSavingPassword(false);
    }
  };

  // Handle Add Member
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberEmail.trim()) return;

    setAddingMember(true);
    try {
      await addMemberByEmail(classId, newMemberEmail.trim());
      success(t('mgmt.member_added'));
      setNewMemberEmail('');
      loadMembers();
    } catch (err: any) {
      console.error(err);
      toastError(err.message || 'Lỗi khi thêm học sinh.');
    } finally {
      setAddingMember(false);
    }
  };

  // Handle Delete Member
  const handleConfirmDeleteMember = async () => {
    if (!deletingMember?.id && !deletingMember?.studentId) return;
    setDeletingLoading(true);
    try {
      const idToRemove = deletingMember.id || deletingMember.studentId;
      await removeMember(classId, idToRemove);
      success(t('mgmt.member_removed'));
      setDeletingMember(null);
      loadMembers();
    } catch (err: any) {
      console.error(err);
      toastError(err.message || 'Lỗi khi xóa học sinh.');
    } finally {
      setDeletingLoading(false);
    }
  };

  // Handle Export Excel
  const handleExportExcel = () => {
    try {
      exportClassDataToExcel({
        classData,
        assignments,
        submissions,
        members
      });
      success(t('mgmt.excel_exported'));
    } catch (err) {
      console.error('Export excel error:', err);
      toastError('Có lỗi xảy ra khi xuất file Excel.');
    }
  };

  // Filtered members by search query
  const filteredMembers = members.filter(m => 
    m.studentEmail?.toLowerCase().includes(memberSearchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 select-none animate-in fade-in duration-200">
      {/* 1. Quick Export Excel & General Header */}
      <div className="bg-gradient-to-r from-emerald-950/60 to-gray-900 p-6 rounded-3xl border border-emerald-500/30 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shadow-lg shadow-emerald-500/10">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white">
              {t('mgmt.export_title')}
            </h3>
            <p className="text-xs text-gray-300 mt-0.5">
              {t('mgmt.export_desc')}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleExportExcel}
          className="px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-gray-950 font-black text-sm rounded-2xl shadow-xl shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 shrink-0"
        >
          <FileSpreadsheet className="w-4 h-4 fill-current" />
          <span>{t('mgmt.export_btn')} (.xlsx)</span>
        </button>
      </div>

      {/* 2. Grid: Class Settings (Name & Password) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Box A: Edit Class Name */}
        <form onSubmit={handleSaveClassName} className="bg-gray-800/90 p-5 sm:p-6 rounded-3xl border border-gray-700/80 shadow-xl space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-blue-400 font-bold text-base">
              <Edit3 className="w-5 h-5" />
              <span>{t('mgmt.rename_class')}</span>
            </div>
            <p className="text-xs text-gray-400">
              {t('mgmt.rename_desc')}
            </p>

            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1.5">
                {t('teacher.class_name')}
              </label>
              <input
                type="text"
                required
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-white font-bold placeholder-gray-500 focus:outline-none focus:border-blue-400 text-sm font-sans"
                placeholder="Nhập tên lớp học mới..."
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingName || className.trim() === (classData.className || classData.name)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              {savingName ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>{t('common.save')}</span>
            </button>
          </div>
        </form>

        {/* Box B: Password Protection */}
        <form onSubmit={handleSavePassword} className="bg-gray-800/90 p-5 sm:p-6 rounded-3xl border border-gray-700/80 shadow-xl space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-purple-400 font-bold text-base">
                <KeyRound className="w-5 h-5" />
                <span>{t('mgmt.password_title')}</span>
              </div>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                classData.password 
                  ? 'bg-purple-500/15 text-purple-300 border-purple-500/30' 
                  : 'bg-green-500/15 text-green-300 border-green-500/30'
              }`}>
                {classData.password ? t('teacher.has_password') : t('teacher.open_free')}
              </span>
            </div>

            <p className="text-xs text-gray-400">
              {t('mgmt.password_desc')}
            </p>

            <div className="relative">
              <label className="block text-xs font-bold text-gray-300 mb-1.5">
                {t('mgmt.class_password')}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-4 pr-10 py-2.5 text-white font-mono placeholder-gray-500 focus:outline-none focus:border-purple-400 text-sm"
                  placeholder="Để trống nếu muốn mở tự do không cần mật khẩu"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white cursor-pointer p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            {password && (
              <button
                type="button"
                onClick={() => setPassword('')}
                className="text-xs text-red-400 hover:underline cursor-pointer"
              >
                {t('mgmt.clear_password')}
              </button>
            )}
            <button
              type="submit"
              disabled={savingPassword || password === (classData.password || '')}
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95 ml-auto"
            >
              {savingPassword ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>{t('mgmt.save_password')}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 3. Class Members Management */}
      <div className="bg-gray-800/90 p-5 sm:p-7 rounded-3xl border border-gray-700/80 shadow-2xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-700/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <span>{t('mgmt.members_title')}</span>
                <span className="text-xs bg-blue-500/20 text-blue-400 font-bold px-2.5 py-0.5 rounded-full border border-blue-500/30">
                  {members.length} {t('mgmt.members_count')}
                </span>
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {t('mgmt.members_desc')}
              </p>
            </div>
          </div>

          {/* Quick Search Member */}
          <div className="flex items-center gap-2 bg-gray-900 px-3 py-2 rounded-xl border border-gray-700 w-full sm:w-64">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder={t('mgmt.search_members')}
              value={memberSearchQuery}
              onChange={(e) => setMemberSearchQuery(e.target.value)}
              className="bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none w-full"
            />
          </div>
        </div>

        {/* Add Member Form */}
        <form onSubmit={handleAddMember} className="bg-gray-900/80 p-4 rounded-2xl border border-gray-700/80 flex flex-col sm:flex-row items-center gap-3">
          <div className="flex-1 w-full">
            <input
              type="email"
              required
              value={newMemberEmail}
              onChange={(e) => setNewMemberEmail(e.target.value)}
              placeholder="Nhập email học sinh (VD: student@example.com)..."
              className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-400 font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={addingMember || !newMemberEmail.trim()}
            className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
          >
            {addingMember ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <UserPlus className="w-4 h-4" />
            )}
            <span>{t('mgmt.add_member_btn')}</span>
          </button>
        </form>

        {/* Members Table */}
        <div className="relative overflow-x-auto rounded-2xl border border-gray-700/80 bg-gray-900/50">
          <table className="w-full text-xs sm:text-sm text-left text-gray-300">
            <thead className="text-[11px] uppercase bg-gray-900/90 text-gray-400 border-b border-gray-700">
              <tr>
                <th className="px-4 py-3.5">#</th>
                <th className="px-4 py-3.5">{t('sub.th_email')}</th>
                <th className="px-4 py-3.5 text-center">{t('mgmt.th_joined')}</th>
                <th className="px-4 py-3.5 text-center">{t('mgmt.th_progress')}</th>
                <th className="px-4 py-3.5 text-center">{t('mgmt.th_pass_rate')}</th>
                <th className="px-4 py-3.5 text-center">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loadingMembers ? (
                <tr>
                  <td colSpan={6} className="text-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-400 mx-auto"></div>
                  </td>
                </tr>
              ) : filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">
                    {members.length === 0 ? t('mgmt.no_members') : t('mgmt.no_search_match')}
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member, idx) => {
                  const studentSubs = submissions.filter(s => s.studentEmail?.toLowerCase() === member.studentEmail?.toLowerCase());
                  const submittedCount = studentSubs.length;
                  const passedCount = studentSubs.filter(s => s.isPassed).length;
                  const passRate = submittedCount > 0 ? Math.round((passedCount / submittedCount) * 100) : 0;

                  let joinedStr = '-';
                  if (member.joinedAt?.toDate) {
                    joinedStr = member.joinedAt.toDate().toLocaleDateString('vi-VN');
                  }

                  return (
                    <tr key={member.id || idx} className="hover:bg-gray-800/40 transition-colors">
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{idx + 1}</td>
                      <td className="px-4 py-3 font-mono font-bold text-white max-w-[200px] truncate" title={member.studentEmail}>
                        {member.studentEmail}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-400 font-mono text-xs whitespace-nowrap">
                        {joinedStr}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className="bg-gray-800 px-2.5 py-1 rounded-lg border border-gray-700 text-xs font-mono font-bold text-blue-400">
                          {submittedCount} {t('sub.submissions_count')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-black border ${
                          passRate >= 70 
                            ? 'bg-green-500/15 text-green-400 border-green-500/30' 
                            : passRate >= 50
                            ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
                            : 'bg-red-500/15 text-red-400 border-red-500/30'
                        }`}>
                          {passRate}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => setDeletingMember(member)}
                          className="p-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors cursor-pointer"
                          title={t('mgmt.remove_member')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Member Confirmation Modal */}
      {deletingMember && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in"
          onClick={() => setDeletingMember(null)}
        >
          <div
            className="bg-gray-900 border border-gray-700 text-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-10 h-10 rounded-2xl bg-red-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">{t('mgmt.remove_confirm_title')}</h3>
                <p className="text-xs text-gray-400 font-mono">{deletingMember.studentEmail}</p>
              </div>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              {t('mgmt.remove_confirm_desc')}
            </p>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingMember(null)}
                className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-medium text-sm transition-colors cursor-pointer"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteMember}
                disabled={deletingLoading}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-red-500/20 disabled:opacity-50 cursor-pointer"
              >
                {deletingLoading ? t('common.processing') : t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
