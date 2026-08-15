'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { LanguageSelector } from '@/app/components/LanguageSelector';
import Link from 'next/link';
import { GraduationCap, BookOpen } from 'lucide-react';

import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/app/firebase';

export default function RoleSelectionPage() {
  const { user, userRole, loading, logout } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      if (userRole === 'teacher') {
        router.push('/teacher');
      } else if (userRole === 'student') {
        router.push('/student');
      }
    }
  }, [user, userRole, loading, router]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="animate-pulse text-lime-400 font-semibold">{t('home.loading')}</div>
      </main>
    );
  }

  const handleAssignRole = async (role: 'student' | 'teacher') => {
    if (user) {
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        role: role
      }, { merge: true });
      window.location.reload(); // reload to fetch new role from context
    }
  };

  // If already logged in but missing role (e.g. old account)
  if (!loading && user && !userRole) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4 space-y-8 relative">
        <div className="absolute top-4 right-4">
          <LanguageSelector />
        </div>
        <div className="text-center">
          <h2 className="text-2xl text-lime-400 font-bold mb-2">{t('home.update_account')}</h2>
          <p className="text-gray-400">{t('home.update_account.desc')}</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => handleAssignRole('student')}
            className="px-6 py-3 bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-lime-400 rounded-xl font-bold flex items-center gap-2"
          >
            <GraduationCap className="w-5 h-5 text-lime-400" /> {t('role.student')}
          </button>
          <button 
            onClick={() => handleAssignRole('teacher')}
            className="px-6 py-3 bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-blue-400 rounded-xl font-bold flex items-center gap-2"
          >
            <BookOpen className="w-5 h-5 text-blue-400" /> {t('role.teacher')}
          </button>
        </div>
        <button 
          onClick={async () => {
            await logout();
            router.push('/login');
          }}
          className="text-gray-500 hover:text-gray-400 underline text-sm"
        >
          {t('home.or_logout')}
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4 relative">
      <div className="absolute top-4 right-4">
        <LanguageSelector />
      </div>
      <div className="max-w-2xl w-full text-center space-y-12">
        <div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-lime-400 mb-4">
            {t('app.title')}
          </h1>
          <p className="text-gray-400 text-lg">
            {t('home.question')}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Link href="/login?role=student" className="group relative bg-gray-800 border border-gray-700 rounded-3xl p-8 hover:bg-gray-750 transition-all hover:border-lime-400/50 hover:shadow-2xl hover:shadow-lime-400/10 cursor-pointer overflow-hidden flex flex-col items-center">
            <div className="w-20 h-20 bg-lime-400/10 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <GraduationCap className="w-10 h-10 text-lime-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">{t('role.student')}</h2>
            <p className="text-gray-400 text-sm text-center">
              {t('home.student.desc')}
            </p>
          </Link>

          <Link href="/login?role=teacher" className="group relative bg-gray-800 border border-gray-700 rounded-3xl p-8 hover:bg-gray-750 transition-all hover:border-blue-400/50 hover:shadow-2xl hover:shadow-blue-400/10 cursor-pointer overflow-hidden flex flex-col items-center">
            <div className="w-20 h-20 bg-blue-400/10 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <BookOpen className="w-10 h-10 text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">{t('role.teacher')}</h2>
            <p className="text-gray-400 text-sm text-center">
              {t('home.teacher.desc')}
            </p>
          </Link>
        </div>
      </div>
    </main>
  );
}