'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useToast } from '@/app/contexts/ToastContext';
import { LanguageSelector } from '@/app/components/LanguageSelector';
import { 
  GraduationCap, 
  BookOpen, 
  Mail, 
  KeyRound, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  ShieldCheck, 
  RotateCw, 
  Volume2, 
  Sparkles,
  ArrowRight
} from 'lucide-react';

export default function RegisterPage() {
  const { register } = useAuth();
  const { t } = useLanguage();
  const { success, error: toastError } = useToast();
  const router = useRouter();

  // Step 1: Role
  const [role, setRole] = useState<'student' | 'teacher' | null>(null);

  // Step 2: Email
  const [email, setEmail] = useState('');
  const [isEmailValid, setIsEmailValid] = useState(false);

  // Step 3: Password
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isPasswordValid, setIsPasswordValid] = useState(false);

  // Step 4: Captcha
  const [captchaNum1, setCaptchaNum1] = useState(12);
  const [captchaNum2, setCaptchaNum2] = useState(7);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [isCaptchaValid, setIsCaptchaValid] = useState(false);

  // Loading state
  const [loading, setLoading] = useState(false);

  // Generate new math captcha
  const generateCaptcha = () => {
    const n1 = Math.floor(Math.random() * 20) + 5;
    const n2 = Math.floor(Math.random() * 15) + 3;
    setCaptchaNum1(n1);
    setCaptchaNum2(n2);
    setCaptchaAnswer('');
    setIsCaptchaValid(false);
  };

  useEffect(() => {
    generateCaptcha();
  }, []);

  // Validate Email
  useEffect(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    setIsEmailValid(emailRegex.test(email.trim()));
  }, [email]);

  // Validate Password
  useEffect(() => {
    const valid = password.length >= 6 && password === confirmPassword;
    setIsPasswordValid(valid);
  }, [password, confirmPassword]);

  // Validate Captcha
  useEffect(() => {
    const expected = captchaNum1 + captchaNum2;
    setIsCaptchaValid(parseInt(captchaAnswer.trim(), 10) === expected);
  }, [captchaAnswer, captchaNum1, captchaNum2]);

  // Password Strength calculation
  const passwordStrength = useMemo(() => {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 6) score += 1;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password) || /[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    return score; // 0 - 4
  }, [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) {
      toastError('Vui lòng chọn vai trò.');
      return;
    }
    if (!isEmailValid) {
      toastError(t('auth.invalid_email'));
      return;
    }
    if (!isPasswordValid) {
      toastError(password.length < 6 ? t('auth.password_too_short') : t('auth.password_mismatch'));
      return;
    }
    if (!isCaptchaValid) {
      toastError(t('auth.captcha_error'));
      generateCaptcha();
      return;
    }

    setLoading(true);
    try {
      await register(email.trim(), password, role);
      success('Đăng ký tài khoản thành công!');
      router.push(role === 'teacher' ? '/teacher' : '/student');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        toastError('Email này đã được đăng ký. Vui lòng đăng nhập.');
      } else {
        toastError(err.message || 'Có lỗi xảy ra khi tạo tài khoản.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4 sm:p-6 relative w-full max-w-full overflow-x-hidden">
      {/* Language Selector */}
      <div className="absolute top-4 right-4 z-20">
        <LanguageSelector />
      </div>

      <div className="max-w-xl w-full bg-gray-800/90 backdrop-blur-md border border-gray-700/80 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 my-8">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-lime-400 to-green-500 flex items-center justify-center mx-auto shadow-lg shadow-lime-500/20">
            <Volume2 className="w-6 h-6 text-gray-950 stroke-[2.5]" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            {t('auth.register')}
          </h1>
          <p className="text-gray-400 text-xs sm:text-sm">
            {t('app.subtitle')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* STEP 1: CHỌN VAI TRÒ */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-gray-200 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-lime-400/20 text-lime-400 flex items-center justify-center text-xs font-bold">1</span>
                {t('auth.step1_role')}
              </label>
              {role && <CheckCircle2 className="w-4 h-4 text-lime-400" />}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => setRole('student')}
                className={`p-4 rounded-2xl border text-left transition-all duration-300 flex flex-col gap-2 cursor-pointer ${
                  role === 'student'
                    ? 'bg-lime-500/15 border-lime-400 shadow-lg shadow-lime-400/10 scale-[1.02]'
                    : 'bg-gray-900/60 border-gray-700 hover:border-gray-600 hover:bg-gray-900'
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-lime-400/20 text-lime-400 flex items-center justify-center">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">{t('role.student')}</h3>
                  <p className="text-[11px] text-gray-400 leading-tight mt-0.5 line-clamp-2">{t('role.student_desc')}</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setRole('teacher')}
                className={`p-4 rounded-2xl border text-left transition-all duration-300 flex flex-col gap-2 cursor-pointer ${
                  role === 'teacher'
                    ? 'bg-blue-500/15 border-blue-400 shadow-lg shadow-blue-400/10 scale-[1.02]'
                    : 'bg-gray-900/60 border-gray-700 hover:border-gray-600 hover:bg-gray-900'
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-blue-400/20 text-blue-400 flex items-center justify-center">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">{t('role.teacher')}</h3>
                  <p className="text-[11px] text-gray-400 leading-tight mt-0.5 line-clamp-2">{t('role.teacher_desc')}</p>
                </div>
              </button>
            </div>
          </div>

          {/* STEP 2: NHẬP EMAIL (FLOAT DOWN KHI ĐÃ CHỌN ROLE) */}
          {role && (
            <div className="space-y-2 pt-2 border-t border-gray-700/60 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-gray-200 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-lime-400/20 text-lime-400 flex items-center justify-center text-xs font-bold">2</span>
                  {t('auth.step2_email')}
                </label>
                {isEmailValid && <CheckCircle2 className="w-4 h-4 text-lime-400" />}
              </div>

              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={t('auth.email_placeholder')}
                  className={`w-full bg-gray-900 border rounded-2xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none transition-all text-sm ${
                    isEmailValid 
                      ? 'border-lime-400/60 focus:border-lime-400 focus:ring-1 focus:ring-lime-400' 
                      : 'border-gray-700 focus:border-gray-500'
                  }`}
                />
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                  <Mail className={`w-4 h-4 ${isEmailValid ? 'text-lime-400' : 'text-gray-500'}`} />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: THIẾT LẬP MẬT KHẨU (FLOAT DOWN KHI EMAIL HỢP LỆ) */}
          {role && isEmailValid && (
            <div className="space-y-3 pt-2 border-t border-gray-700/60 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-gray-200 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-lime-400/20 text-lime-400 flex items-center justify-center text-xs font-bold">3</span>
                  {t('auth.step3_password')}
                </label>
                {isPasswordValid && <CheckCircle2 className="w-4 h-4 text-lime-400" />}
              </div>

              <div className="space-y-2.5">
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={t('auth.password_placeholder')}
                    className="w-full bg-gray-900 border border-gray-700 rounded-2xl px-4 py-3 pr-11 text-white placeholder-gray-500 focus:outline-none focus:border-lime-400 focus:ring-1 focus:ring-lime-400 transition-all text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors p-1 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password Strength Bar */}
                {password && (
                  <div className="space-y-1 px-1">
                    <div className="flex gap-1 h-1.5 w-full bg-gray-900 rounded-full overflow-hidden">
                      <div className={`flex-1 transition-all ${passwordStrength >= 1 ? (passwordStrength === 1 ? 'bg-red-500' : passwordStrength === 2 ? 'bg-yellow-500' : 'bg-green-500') : 'bg-gray-800'}`}></div>
                      <div className={`flex-1 transition-all ${passwordStrength >= 2 ? (passwordStrength === 2 ? 'bg-yellow-500' : 'bg-green-500') : 'bg-gray-800'}`}></div>
                      <div className={`flex-1 transition-all ${passwordStrength >= 3 ? 'bg-green-500' : 'bg-gray-800'}`}></div>
                      <div className={`flex-1 transition-all ${passwordStrength >= 4 ? 'bg-lime-400' : 'bg-gray-800'}`}></div>
                    </div>
                    <p className="text-[10px] text-gray-400">
                      {passwordStrength <= 1 ? 'Mật khẩu yếu' : passwordStrength <= 2 ? 'Mật khẩu trung bình' : 'Mật khẩu an toàn'}
                    </p>
                  </div>
                )}

                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder={t('auth.confirm_password_placeholder')}
                    className={`w-full bg-gray-900 border rounded-2xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none transition-all text-sm ${
                      confirmPassword && (password === confirmPassword ? 'border-lime-400/60' : 'border-red-500/60')
                    }`}
                  />
                  {confirmPassword && (
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                      {password === confirmPassword ? (
                        <CheckCircle2 className="w-4 h-4 text-lime-400" />
                      ) : (
                        <span className="text-xs text-red-400">Không khớp</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: CAPTCHA CHỐNG BOT / DDOS (FLOAT DOWN KHI PASSWORD HỢP LỆ) */}
          {role && isEmailValid && isPasswordValid && (
            <div className="space-y-3 pt-2 border-t border-gray-700/60 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-gray-200 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-lime-400/20 text-lime-400 flex items-center justify-center text-xs font-bold">4</span>
                  {t('auth.step4_captcha')}
                </label>
                {isCaptchaValid && <CheckCircle2 className="w-4 h-4 text-lime-400" />}
              </div>

              <div className="bg-gray-900/90 p-4 rounded-2xl border border-gray-700/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-300 flex items-center gap-1.5 font-medium">
                    <ShieldCheck className="w-4 h-4 text-lime-400" />
                    {t('auth.captcha_question')}
                  </span>
                  <button
                    type="button"
                    onClick={generateCaptcha}
                    className="p-1 text-gray-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                    title="Đổi câu hỏi khác"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <div className="px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl font-mono text-base font-bold text-lime-400 tracking-wider select-none shadow-inner">
                    {captchaNum1} + {captchaNum2} = ?
                  </div>
                  <input
                    type="number"
                    required
                    value={captchaAnswer}
                    onChange={e => setCaptchaAnswer(e.target.value)}
                    placeholder={t('auth.captcha_placeholder')}
                    className={`flex-1 bg-gray-800 border rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none text-sm ${
                      isCaptchaValid ? 'border-lime-400 text-lime-400 font-bold' : 'border-gray-700 focus:border-blue-400'
                    }`}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: NÚT ĐĂNG KÝ (FLOAT DOWN KHI CAPTCHA HỢP LỆ) */}
          {role && isEmailValid && isPasswordValid && isCaptchaValid && (
            <div className="pt-2 animate-in fade-in slide-in-from-top-4 duration-500">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 px-6 bg-gradient-to-r from-lime-400 to-green-500 hover:from-lime-300 hover:to-green-400 active:scale-98 text-gray-950 font-extrabold text-base rounded-2xl transition-all shadow-xl shadow-lime-500/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <span>{t('common.processing')}</span>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>{t('auth.register')} ({role === 'teacher' ? t('role.teacher') : t('role.student')})</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          )}
        </form>

        {/* Switch to Login */}
        <div className="pt-2 border-t border-gray-700/60 text-center">
          <Link
            href="/login"
            className="text-sm font-medium text-lime-400 hover:text-lime-300 transition-colors inline-block"
          >
            {t('auth.already_have_account')}
          </Link>
        </div>
      </div>
    </main>
  );
}
