'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useToast } from '@/app/contexts/ToastContext';
import AuthGuard from '@/app/components/AuthGuard';
import Navbar from '@/app/components/Navbar';
import { useRouter } from 'next/navigation';
import { Mic, BookOpen, Plus, KeyRound, Hash, X, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { getJoinedClasses, getClass, joinClass, ClassData } from '@/app/lib/firestore';

export default function StudentDashboard() {
  const { user, userRole } = useAuth();
  const { t } = useLanguage();
  const { success, error: toastError } = useToast();
  const router = useRouter();
  
  const [joinedClasses, setJoinedClasses] = useState<(ClassData & { joinedAt?: any })[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Join Class Form State
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [classId, setClassId] = useState('');
  const [password, setPassword] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);

  // Guard role
  useEffect(() => {
    if (userRole && userRole !== 'student') {
      router.push('/');
    }
  }, [userRole, router]);

  const loadClasses = useCallback(async () => {
    if (!user) return;
    try {
      const classes = await getJoinedClasses(user.uid);
      setJoinedClasses(classes);
    } catch (err) {
      console.error('Error fetching joined classes:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadClasses();
    }
  }, [user, loadClasses]);

  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setJoinLoading(true);
    try {
      const targetClass = await getClass(classId.trim());
      if (!targetClass) {
        toastError(t('student.class_not_found'));
        return;
      }
      if (targetClass.password && targetClass.password !== password.trim()) {
        toastError(t('student.wrong_password'));
        return;
      }
      
      await joinClass(classId.trim(), user.uid, user.email || '');
      success(t('student.join_success'));
      
      setShowJoinForm(false);
      setClassId('');
      setPassword('');
      loadClasses();
    } catch (err: any) {
      console.error(err);
      toastError(err.message || 'Lỗi khi tham gia lớp học.');
    } finally {
      setJoinLoading(false);
    }
  };

  return (
    <AuthGuard allowedRole="student">
      <main className="min-h-screen bg-gray-900 text-white flex flex-col w-full max-w-full overflow-x-hidden">
        {/* Universal Navbar */}
        <Navbar currentRole="student" />

        <div className="flex-1 p-4 sm:p-6 md:p-8 max-w-6xl mx-auto w-full space-y-10">
          {/* Main Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <Link 
              href="/student/free"
              className="bg-gray-800/80 border border-gray-700/80 rounded-3xl p-6 sm:p-8 hover:bg-gray-800 transition-all hover:border-lime-400/50 hover:shadow-2xl hover:shadow-lime-400/10 flex flex-col items-center justify-center text-center group cursor-pointer"
            >
              <div className="w-16 h-16 bg-lime-400/15 text-lime-400 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg shadow-lime-500/10">
                <Mic className="w-8 h-8" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold mb-2 text-white group-hover:text-lime-400 transition-colors">
                {t('student.free_practice')}
              </h2>
              <p className="text-gray-400 text-xs sm:text-sm max-w-sm">
                {t('student.free_practice_desc')}
              </p>
            </Link>
            
            <button 
              onClick={() => setShowJoinForm(true)}
              className="bg-gray-800/80 border border-gray-700/80 rounded-3xl p-6 sm:p-8 hover:bg-gray-800 transition-all hover:border-blue-400/50 hover:shadow-2xl hover:shadow-blue-400/10 flex flex-col items-center justify-center text-center group cursor-pointer"
            >
              <div className="w-16 h-16 bg-blue-400/15 text-blue-400 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg shadow-blue-500/10">
                <Plus className="w-8 h-8" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold mb-2 text-white group-hover:text-blue-400 transition-colors">
                {t('student.join_class')}
              </h2>
              <p className="text-gray-400 text-xs sm:text-sm max-w-sm">
                {t('student.join_class_desc')}
              </p>
            </button>
          </div>

          {/* Joined Classes Section */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-lime-400" />
              {t('student.my_classes')} ({joinedClasses.length})
            </h3>
            
            {loading ? (
              <div className="flex justify-center p-12">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-lime-400"></div>
              </div>
            ) : joinedClasses.length === 0 ? (
              <div className="bg-gray-800/60 rounded-3xl p-8 sm:p-12 text-center text-gray-400 border border-gray-700/70 space-y-3">
                <p className="text-sm">{t('student.no_classes')}</p>
                <button
                  onClick={() => setShowJoinForm(true)}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-blue-500/20 cursor-pointer"
                >
                  {t('student.join_class')}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {joinedClasses.map((cls) => (
                  <Link 
                    href={`/student/class/${cls.id}`} 
                    key={cls.id}
                    className="bg-gray-800/80 rounded-2xl p-6 border border-gray-700/80 hover:border-lime-400/50 hover:shadow-xl hover:shadow-lime-500/5 transition-all text-left group block"
                  >
                    <h4 className="font-bold text-lg text-white mb-1 group-hover:text-lime-400 transition-colors truncate">
                      {cls.className || cls.name}
                    </h4>
                    <p className="text-xs text-gray-400 mb-4 truncate">{cls.teacherEmail}</p>
                    <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-700/60">
                      <span className="font-mono text-gray-400">ID: {cls.id}</span>
                      <span className="text-lime-400 font-medium flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                        Vào học <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Join Class Modal */}
      {showJoinForm && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in"
          onClick={() => setShowJoinForm(false)}
        >
          <div 
            className="bg-gray-900 border border-gray-700 text-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-400" />
                {t('student.join_class')}
              </h2>
              <button
                onClick={() => setShowJoinForm(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleJoinClass} className="space-y-4">
              <div>
                <label className="block text-gray-300 text-xs font-bold mb-1.5 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-gray-400" />
                  {t('student.class_id')} *
                </label>
                <input 
                  type="text" 
                  value={classId}
                  onChange={e => setClassId(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm font-mono"
                  placeholder="VD: CMiEyck"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-300 text-xs font-bold mb-1.5 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-gray-400" />
                  {t('student.class_password')}
                </label>
                <input 
                  type="password" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
                  placeholder={t('student.class_password_placeholder')}
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowJoinForm(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-medium text-sm transition-colors cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
                <button 
                  type="submit" 
                  disabled={joinLoading}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {joinLoading ? t('common.processing') : t('student.join_submit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AuthGuard>
  );
}
