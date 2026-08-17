'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { LanguageSelector } from '@/app/components/LanguageSelector';
import { GraduationCap, BookOpen, Volume2 } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/app/firebase';

export default function RootPage() {
  const { user, userRole, loading, logout } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (userRole === 'teacher') {
        router.push('/teacher');
      } else if (userRole === 'student') {
        router.push('/student');
      }
    }
  }, [user, userRole, loading, router]);

  if (loading) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-lime-400 to-green-500 flex items-center justify-center animate-pulse mb-4 shadow-xl shadow-lime-500/20">
          <Volume2 className="w-6 h-6 text-gray-950 stroke-[2.5]" />
        </div>
        <div className="animate-pulse text-lime-400 font-semibold text-sm">
          {t('common.loading')}
        </div>
      </main>
    );
  }

  // Truong hop dac biet: Da dang nhap nhung chua co role trong Firestore
  if (user && !userRole) {
    const handleAssignRole = async (role: 'student' | 'teacher') => {
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        role: role
      }, { merge: true });
      window.location.reload();
    };

    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4 space-y-8 relative">
        <div className="absolute top-4 right-4">
          <LanguageSelector />
        </div>
        <div className="text-center max-w-md">
          <h2 className="text-2xl text-lime-400 font-bold mb-2">{t('role.select_prompt')}</h2>
          <p className="text-gray-400 text-sm">Tài khoản của bạn chưa có vai trò. Vui lòng chọn vai trò để tiếp tục.</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => handleAssignRole('student')}
            className="px-6 py-3.5 bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-lime-400 rounded-2xl font-bold flex items-center gap-2 transition-all cursor-pointer"
          >
            <GraduationCap className="w-5 h-5 text-lime-400" /> {t('role.student')}
          </button>
          <button 
            onClick={() => handleAssignRole('teacher')}
            className="px-6 py-3.5 bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-blue-400 rounded-2xl font-bold flex items-center gap-2 transition-all cursor-pointer"
          >
            <BookOpen className="w-5 h-5 text-blue-400" /> {t('role.teacher')}
          </button>
        </div>
        <button 
          onClick={async () => {
            await logout();
            router.push('/login');
          }}
          className="text-gray-500 hover:text-gray-400 underline text-sm cursor-pointer"
        >
          {t('auth.logout')}
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-lime-400"></div>
    </main>
  );
}