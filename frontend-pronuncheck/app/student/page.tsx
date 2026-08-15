'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { useLanguage } from '@/app/contexts/LanguageContext';
import AuthGuard from '@/app/components/AuthGuard';
import { LanguageSelector } from '@/app/components/LanguageSelector';
import { useRouter } from 'next/navigation';
import { Mic, Upload, LogOut, Search, Plus } from 'lucide-react';
import Link from 'next/link';
import { getJoinedClasses, getClass, joinClass, ClassData } from '@/app/lib/firestore';

export default function StudentDashboard() {
  const { user, userRole, logout } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  
  const [joinedClasses, setJoinedClasses] = useState<(ClassData & { joinedAt?: any })[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Join Class Form State
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [classId, setClassId] = useState('');
  const [password, setPassword] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState('');

  // Guard role
  useEffect(() => {
    if (userRole && userRole !== 'student') {
      router.push('/');
    }
  }, [userRole, router]);

  useEffect(() => {
    if (!user) return;
    const fetchClasses = async () => {
      try {
        const classes = await getJoinedClasses(user.uid);
        setJoinedClasses(classes);
      } catch (err) {
        console.error("Lỗi khi tải danh sách lớp:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchClasses();
  }, [user]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setJoinLoading(true);
    setJoinError('');
    try {
      const classData = await getClass(classId);
      if (!classData) {
        setJoinError('Không tìm thấy lớp học này.');
        return;
      }
      if (classData.password && classData.password !== password) {
        setJoinError('Sai mật khẩu lớp học.');
        return;
      }
      
      await joinClass(classId, user.uid, user.email || '');
      
      const newClass = { ...classData, joinedAt: new Date() };
      setJoinedClasses(prev => {
        if (!prev.find(c => c.id === newClass.id)) {
          return [...prev, newClass];
        }
        return prev;
      });
      
      setShowJoinForm(false);
      setClassId('');
      setPassword('');
      
    } catch (err: any) {
      setJoinError(err.message);
    } finally {
      setJoinLoading(false);
    }
  };

  return (
    <AuthGuard allowedRole="student">
      <main className="min-h-screen bg-gray-900 text-white flex flex-col">
        {/* Header Bar */}
        <header className="bg-gray-800 border-b border-gray-700 p-4 flex justify-between items-center shadow-md">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-lime-400">{t('app.title')} <span className="text-sm font-normal text-gray-400">| {t('role.student')}</span></h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-sm hidden sm:block">{user?.email}</span>
            <LanguageSelector />
            <button onClick={handleLogout} className="text-red-400 hover:text-red-300 font-medium px-3 py-1.5 rounded-lg hover:bg-red-400/10 transition-colors flex items-center gap-2">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">{t('auth.logout')}</span>
            </button>
          </div>
        </header>

        <div className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full">
          {/* Main Action Cards */}
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            <Link 
              href="/student/free"
              className="bg-gray-800 border border-gray-700 rounded-3xl p-8 hover:bg-gray-750 transition-all hover:border-lime-400/50 hover:shadow-2xl hover:shadow-lime-400/10 flex flex-col items-center justify-center text-center group"
            >
              <div className="w-16 h-16 bg-lime-400/10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Mic className="w-8 h-8 text-lime-400" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Tự do luyện tập</h2>
              <p className="text-gray-400 text-sm">Nhập từ bạn muốn luyện, ghi âm và nhận phản hồi ngay lập tức.</p>
            </Link>
            
            <button 
              onClick={() => setShowJoinForm(true)}
              className="bg-gray-800 border border-gray-700 rounded-3xl p-8 hover:bg-gray-750 transition-all hover:border-blue-400/50 hover:shadow-2xl hover:shadow-blue-400/10 flex flex-col items-center justify-center text-center group"
            >
              <div className="w-16 h-16 bg-blue-400/10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Plus className="w-8 h-8 text-blue-400" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Tham gia lớp học</h2>
              <p className="text-gray-400 text-sm">Nhập mã lớp và mật khẩu do giáo viên cung cấp để làm bài tập.</p>
            </button>
          </div>

          {/* Joined Classes Section */}
          <div>
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Upload className="w-5 h-5 text-gray-400" />
              Lớp học của tôi
            </h3>
            
            {loading ? (
              <div className="flex justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-lime-400"></div>
              </div>
            ) : joinedClasses.length === 0 ? (
              <div className="bg-gray-800 rounded-2xl p-8 text-center text-gray-400 border border-gray-700">
                Bạn chưa tham gia lớp học nào.
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {joinedClasses.map((cls) => (
                  <Link 
                    href={`/student/class/${cls.id}?pwd=${cls.password}`} 
                    key={cls.id}
                    className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-blue-400/50 hover:shadow-lg transition-all text-left"
                  >
                    <h4 className="font-bold text-lg text-white mb-1">{cls.className || cls.name}</h4>
                    <p className="text-sm text-gray-400 mb-4">{cls.teacherEmail}</p>
                    <div className="text-xs text-gray-500">
                      ID: {cls.id}
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 p-8 rounded-2xl max-w-md w-full shadow-2xl border border-gray-700">
            <h2 className="text-2xl font-bold text-white mb-6">Tham gia lớp học</h2>
            
            {joinError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg mb-4 text-sm">
                {joinError}
              </div>
            )}
            
            <form onSubmit={handleJoinClass} className="space-y-4">
              <div>
                <label className="block text-gray-400 text-sm font-medium mb-1">Mã lớp</label>
                <input 
                  type="text" 
                  value={classId}
                  onChange={e => setClassId(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                  placeholder="Nhập mã lớp"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm font-medium mb-1">Mật khẩu</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                  placeholder="Nhập mật khẩu (nếu có)"
                />
              </div>
              
              <div className="flex gap-3 mt-8">
                <button 
                  type="button" 
                  onClick={() => setShowJoinForm(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-colors"
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  disabled={joinLoading}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                >
                  {joinLoading ? 'Đang xử lý...' : 'Tham gia'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AuthGuard>
  );
}
