'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useToast } from '@/app/contexts/ToastContext';
import { LanguageSelector } from '@/app/components/LanguageSelector';
import { LogOut, GraduationCap, BookOpen, Volume2 } from 'lucide-react';

interface NavbarProps {
  currentRole?: 'student' | 'teacher';
}

export default function Navbar({ currentRole }: NavbarProps) {
  const { user, userRole, logout } = useAuth();
  const { t } = useLanguage();
  const { info } = useToast();
  const router = useRouter();

  const role = currentRole || userRole;

  const handleLogout = async () => {
    try {
      await logout();
      info(t('auth.logout') + '...');
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      router.push('/login');
    }
  };

  const dashboardHref = role === 'teacher' ? '/teacher' : '/student';

  return (
    <header className="bg-gray-800/95 backdrop-blur-md border-b border-gray-700/80 px-4 sm:px-8 py-3.5 flex justify-between items-center shadow-lg sticky top-0 z-40 w-full max-w-full">
      {/* Brand Logo & Title */}
      <Link 
        href={dashboardHref}
        className="flex items-center gap-3 group cursor-pointer select-none"
      >
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-lime-400 to-green-500 flex items-center justify-center shadow-lg shadow-lime-500/20 group-hover:scale-105 transition-transform">
          <Volume2 className="w-5 h-5 text-gray-950 stroke-[2.5]" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg sm:text-xl font-extrabold tracking-tight text-white group-hover:text-lime-400 transition-colors">
              {t('app.title')}
            </span>
            {role && (
              <span className={`hidden sm:inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                role === 'teacher' 
                  ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' 
                  : 'bg-lime-500/20 text-lime-400 border-lime-500/30'
              }`}>
                {role === 'teacher' ? <BookOpen className="w-3 h-3" /> : <GraduationCap className="w-3 h-3" />}
                {role === 'teacher' ? t('role.teacher') : t('role.student')}
              </span>
            )}
          </div>
          <p className="text-[10px] text-gray-400 hidden sm:block leading-none mt-0.5">
            {t('app.subtitle')}
          </p>
        </div>
      </Link>

      {/* Right Controls: User info, Language Selector, Logout */}
      <div className="flex items-center gap-2 sm:gap-4">
        {user?.email && (
          <div className="hidden md:flex flex-col text-right">
            <span className="text-xs font-semibold text-gray-200 truncate max-w-[180px]" title={user.email}>
              {user.email}
            </span>
            <span className="text-[10px] text-gray-400">
              {role === 'teacher' ? t('role.teacher') : t('role.student')}
            </span>
          </div>
        )}

        <LanguageSelector />

        {user && (
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl transition-all cursor-pointer active:scale-95"
            title={t('auth.logout')}
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">{t('auth.logout')}</span>
          </button>
        )}
      </div>
    </header>
  );
}
