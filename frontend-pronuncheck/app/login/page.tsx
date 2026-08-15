'use client';

import React, { useState, Suspense } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginContent() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register, userRole } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const roleFromUrl = searchParams.get('role') as 'student' | 'teacher' | null;
  const targetRole = roleFromUrl || 'student'; // default to student if not provided

  const translateError = (code: string) => {
    switch (code) {
      case 'auth/invalid-email': return 'Email không hợp lệ.';
      case 'auth/user-not-found': return 'Không tìm thấy người dùng.';
      case 'auth/wrong-password': return 'Sai mật khẩu.';
      case 'auth/email-already-in-use': return 'Email đã được sử dụng.';
      case 'auth/weak-password': return 'Mật khẩu quá yếu (cần ít nhất 6 ký tự).';
      case 'auth/invalid-credential': return 'Thông tin đăng nhập không hợp lệ.';
      default: return 'Có lỗi xảy ra. Vui lòng thử lại.';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
        // Role is fetched in AuthContext, wait for it or rely on AuthGuard in respective pages.
        // For now, redirect to / to let root page route them, or just route to roleFromUrl if known.
        // It's safer to redirect to '/' and let the root page handle the routing based on fetched role.
        router.push('/');
      } else {
        await register(email, password, targetRole);
        router.push(`/${targetRole}`);
      }
    } catch (err: any) {
      setError(translateError(err.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
      <div className="max-w-md w-full bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-8 space-y-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-lime-400 mb-2">PronunCheck</h2>
          <p className="text-gray-400">
            {isLogin 
              ? `Đăng nhập (${targetRole === 'teacher' ? 'Giáo viên' : 'Học sinh'})` 
              : `Tạo tài khoản (${targetRole === 'teacher' ? 'Giáo viên' : 'Học sinh'})`}
          </p>
        </div>
        
        {error && <div className="p-3 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
            <input 
              type="email" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-transparent transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Mật khẩu</label>
            <input 
              type="password" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-transparent transition-all"
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3.5 px-4 bg-lime-400 hover:bg-lime-500 active:bg-lime-600 text-gray-950 font-bold rounded-xl transition-all shadow-lg hover:shadow-lime-400/20 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? 'Đang xử lý...' : (isLogin ? 'Đăng nhập' : 'Đăng ký')}
          </button>
        </form>

        <div className="text-center mt-4">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            type="button"
            className="text-sm text-lime-400 hover:text-lime-300 transition-colors"
          >
            {isLogin ? 'Chưa có tài khoản? Đăng ký ngay' : 'Đã có tài khoản? Đăng nhập'}
          </button>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Đang tải...</div>}>
      <LoginContent />
    </Suspense>
  );
}
