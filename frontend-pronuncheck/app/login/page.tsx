'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useToast } from '@/app/contexts/ToastContext';
import { LanguageSelector } from '@/app/components/LanguageSelector';
import { Eye, EyeOff, Volume2, ArrowRight, KeyRound, Mail, X } from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/app/firebase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Forgot password modal
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const { login } = useAuth();
  const { t } = useLanguage();
  const { success, error: toastError } = useToast();
  const router = useRouter();

  const translateError = (code: string) => {
    switch (code) {
      case 'auth/invalid-email': return t('auth.invalid_email');
      case 'auth/user-not-found': return 'Không tìm thấy tài khoản với email này.';
      case 'auth/wrong-password': return 'Mật khẩu không chính xác.';
      case 'auth/invalid-credential': return 'Email hoặc mật khẩu không chính xác.';
      case 'auth/too-many-requests': return 'Quá nhiều lần đăng nhập không thành công. Vui lòng thử lại sau.';
      default: return 'Có lỗi xảy ra khi đăng nhập. Vui lòng thử lại.';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email.trim(), password);
      success('Đăng nhập thành công!');
      router.push('/');
    } catch (err: any) {
      console.error(err);
      toastError(translateError(err.code || ''));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotLoading(true);
    try {
      await sendPasswordResetEmail(auth, forgotEmail.trim());
      success(t('auth.reset_sent'));
      setShowForgotModal(false);
      setForgotEmail('');
    } catch (err: any) {
      console.error(err);
      toastError(err.message || 'Không thể gửi email khôi phục.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4 sm:p-6 relative w-full max-w-full overflow-x-hidden">
      {/* Language Selector Top Right */}
      <div className="absolute top-4 right-4 z-20">
        <LanguageSelector />
      </div>

      <div className="max-w-md w-full bg-gray-800/90 backdrop-blur-md border border-gray-700/80 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6">
        {/* App Branding */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-lime-400 to-green-500 flex items-center justify-center mx-auto shadow-xl shadow-lime-500/20">
            <Volume2 className="w-7 h-7 text-gray-950 stroke-[2.5]" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            {t('app.title')}
          </h1>
          <p className="text-gray-400 text-sm">
            {t('app.subtitle')}
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5 flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-gray-400" />
              {t('auth.email')}
            </label>
            <input 
              type="email" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.email_placeholder')}
              className="w-full bg-gray-900 border border-gray-700 rounded-2xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-lime-400 focus:ring-1 focus:ring-lime-400 transition-all text-sm"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-gray-400" />
                {t('auth.password')}
              </label>
              <button
                type="button"
                onClick={() => {
                  setForgotEmail(email);
                  setShowForgotModal(true);
                }}
                className="text-xs text-lime-400 hover:text-lime-300 transition-colors cursor-pointer"
              >
                {t('auth.forgot_password')}
              </button>
            </div>

            <div className="relative">
              <input 
                type={showPassword ? 'text' : 'password'} 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.password_placeholder')}
                className="w-full bg-gray-900 border border-gray-700 rounded-2xl px-4 py-3 pr-11 text-white placeholder-gray-500 focus:outline-none focus:border-lime-400 focus:ring-1 focus:ring-lime-400 transition-all text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors cursor-pointer p-1"
                title={showPassword ? t('auth.hide_password') : t('auth.show_password')}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-lime-400 to-green-500 hover:from-lime-300 hover:to-green-400 active:scale-98 text-gray-950 font-bold rounded-2xl transition-all shadow-lg shadow-lime-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer mt-3"
          >
            {loading ? (
              <span>{t('common.processing')}</span>
            ) : (
              <>
                <span>{t('auth.login')}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Switch to Register */}
        <div className="pt-2 border-t border-gray-700/60 text-center">
          <Link 
            href="/register"
            className="text-sm font-medium text-lime-400 hover:text-lime-300 transition-colors inline-block"
          >
            {t('auth.dont_have_account')}
          </Link>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in"
          onClick={() => setShowForgotModal(false)}
        >
          <div 
            className="bg-gray-900 border border-gray-700 text-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="font-bold text-lg text-white">
                {t('auth.forgot_password')}
              </h3>
              <button
                onClick={() => setShowForgotModal(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              {t('auth.forgot_password_desc')}
            </p>

            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  {t('auth.email')}
                </label>
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-lime-400 text-sm"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-medium text-sm transition-colors cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="flex-1 px-4 py-2.5 bg-lime-500 hover:bg-lime-400 text-gray-950 font-bold rounded-xl text-sm transition-all shadow-lg shadow-lime-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {forgotLoading ? t('common.processing') : t('auth.send_reset_link')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
