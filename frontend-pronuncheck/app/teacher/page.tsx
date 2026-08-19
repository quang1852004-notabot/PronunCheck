'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useToast } from '@/app/contexts/ToastContext';
import AuthGuard from '@/app/components/AuthGuard';
import Navbar from '@/app/components/Navbar';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, BookOpen, KeyRound, ArrowRight, X, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { getClassesByTeacher, createClass, deleteClass, ClassData } from '@/app/lib/firestore';

function generateClassId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 7; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default function TeacherDashboard() {
  const { user, userRole } = useAuth();
  const { t } = useLanguage();
  const { success, error: toastError } = useToast();
  const router = useRouter();
  
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [loading, setLoading] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);

  // Delete modal state
  const [deletingClassId, setDeletingClassId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Guard role
  useEffect(() => {
    if (userRole && userRole !== 'teacher') {
      router.push('/');
    }
  }, [userRole, router]);

  const loadClasses = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getClassesByTeacher(user.uid);
      setClasses(data);
    } catch (err) {
      console.error('Error loading classes:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadClasses();
    }
  }, [user, loadClasses]);

  const handleCreateClass = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const form = e.currentTarget;
    const name = (form.elements.namedItem('name') as HTMLInputElement).value.trim();
    const password = (form.elements.namedItem('password') as HTMLInputElement).value.trim();
    const classId = generateClassId();
    
    setCreateLoading(true);
    try {
      await createClass({
        name,
        className: name,
        password,
        teacherId: user.uid,
        teacherEmail: user.email || ''
      }, classId);
      
      form.reset();
      success(t('teacher.class_created'));
      loadClasses();
    } catch (err: any) {
      console.error('Error creating class:', err);
      toastError(err.message || 'Có lỗi xảy ra khi tạo lớp.');
    } finally {
      setCreateLoading(false);
    }
  };

  const confirmDeleteClass = async () => {
    if (!deletingClassId) return;
    setIsDeleting(true);
    try {
      await deleteClass(deletingClassId);
      success(t('teacher.class_deleted'));
      setDeletingClassId(null);
      loadClasses();
    } catch (err: any) {
      console.error('Error deleting class:', err);
      toastError(err.message || 'Lỗi khi xóa lớp.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AuthGuard allowedRole="teacher">
      <main className="min-h-screen bg-gray-900 text-white flex flex-col w-full max-w-full overflow-x-hidden">
        {/* Universal Navbar */}
        <Navbar currentRole="teacher" />

        <div className="flex-1 p-4 sm:p-6 md:p-8 max-w-6xl mx-auto w-full space-y-10">
          {/* Create Class Section */}
          <div className="bg-gray-800/90 border border-gray-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-400" />
              {t('teacher.create_class')}
            </h2>
            <form onSubmit={handleCreateClass} className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4">
              <div className="sm:col-span-6">
                <input 
                  type="text" 
                  name="name" 
                  required 
                  placeholder={t('teacher.class_name_placeholder')} 
                  className="w-full bg-gray-900 border border-gray-700 rounded-2xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-400 text-sm" 
                />
              </div>
              <div className="sm:col-span-4">
                <input 
                  type="text" 
                  name="password" 
                  placeholder={t('teacher.class_password_optional')} 
                  className="w-full bg-gray-900 border border-gray-700 rounded-2xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-400 text-sm" 
                />
              </div>
              <div className="sm:col-span-2">
                <button 
                  type="submit" 
                  disabled={createLoading}
                  className="w-full h-full min-h-[46px] py-2.5 px-4 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>{createLoading ? t('common.processing') : t('teacher.btn_create_class')}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Classes List */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-400" />
              {t('teacher.my_classes')} ({classes.length})
            </h2>
            
            {loading ? (
              <div className="flex justify-center p-12">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-400"></div>
              </div>
            ) : classes.length === 0 ? (
              <div className="bg-gray-800/60 rounded-3xl p-8 sm:p-12 text-center text-gray-400 border border-gray-700/70">
                {t('teacher.no_classes')}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {classes.map(cls => (
                  <div 
                    key={cls.id} 
                    className="bg-gray-800/80 border border-gray-700/80 rounded-3xl p-6 hover:border-blue-500/50 hover:shadow-xl hover:shadow-blue-500/10 transition-all relative group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-bold text-xl text-white truncate flex-1" title={cls.name || cls.className}>
                          {cls.name || cls.className}
                        </h3>
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDeletingClassId(cls.id!);
                          }} 
                          className="text-gray-400 hover:text-red-400 p-1.5 rounded-xl hover:bg-gray-700/80 transition-colors cursor-pointer"
                          title="Xóa lớp học"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="bg-gray-900/90 inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border border-gray-700/80 mb-4">
                        <span className="text-blue-400 font-mono text-xs font-bold">ID: {cls.id}</span>
                      </div>

                      <div className="text-gray-400 text-xs flex items-center gap-2 mb-4">
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>{cls.password ? t('teacher.has_password') : t('teacher.open_free')}</span>
                      </div>
                    </div>

                    <Link 
                      href={`/teacher/class/${cls.id}`}
                      className="w-full py-2.5 bg-gray-700/60 hover:bg-blue-600 text-gray-200 hover:text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer mt-2"
                    >
                      <span>Quản lý lớp</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {deletingClassId && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in"
            onClick={() => setDeletingClassId(null)}
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
                  <h3 className="font-bold text-lg text-white">Xác nhận xóa lớp học?</h3>
                  <p className="text-xs text-gray-400">ID: {deletingClassId}</p>
                </div>
              </div>

              <p className="text-xs text-gray-300 leading-relaxed">
                {t('teacher.delete_class_confirm')}
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingClassId(null)}
                  className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-medium text-sm transition-colors cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteClass}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-red-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {isDeleting ? t('common.processing') : t('common.delete')}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </AuthGuard>
  );
}
