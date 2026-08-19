'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function AuthGuard({ children, allowedRole, fallback }: { children: React.ReactNode; allowedRole?: string; fallback?: React.ReactNode }) {
  const { user, userRole, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (allowedRole && userRole && userRole !== allowedRole) {
        router.push(userRole === 'teacher' ? '/teacher' : '/student');
      }
    }
  }, [user, userRole, loading, router, allowedRole]);

  if (loading) {
    if (fallback) return <>{fallback}</>;
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-lime-400"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
