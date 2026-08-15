'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { useLanguage } from '@/app/contexts/LanguageContext';
import AuthGuard from '@/app/components/AuthGuard';
import { LanguageSelector } from '@/app/components/LanguageSelector';
import { useRouter } from 'next/navigation';
import { LogOut, Plus, Trash2, GraduationCap } from 'lucide-react';
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
  const { user, userRole, logout } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Guard role
  useEffect(() => {
    if (userRole && userRole !== 'teacher') {
      router.push('/');
    }
  }, [userRole, router]);

  useEffect(() => {
    if (user) {
      loadClasses();
    }
  }, [user]);

  const loadClasses = async () => {
    if (!user) return;
    try {
      const data = await getClassesByTeacher(user.uid);
      setClasses(data);
    } catch (err) {
      console.error("Error loading classes:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const target = e.target as typeof e.target & { name: { value: string }, password: { value: string } };
    const name = target.name.value;
    const password = target.password.value;
    const classId = generateClassId();
    
    try {
      await createClass({
        name,
        className: name,
        password,
        teacherId: user.uid,
        teacherEmail: user.email || '',
        scoringConfig: { threshold: 0.6, w1: 0.4, w2: 0.6 }
      }, classId);
      
      (e.target as HTMLFormElement).reset();
      loadClasses();
    } catch (err) {
      console.error("Error creating class:", err);
      alert("Có lỗi xảy ra khi tạo lớp.");
    }
  };

  const handleDeleteClass = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm('Bạn có chắc muốn xóa lớp học này? Dữ liệu bài tập và bài nộp cũng sẽ bị mất.')) {
      try {
        await deleteClass(id);
        loadClasses();
      } catch (err) {
        console.error("Error deleting class:", err);
        alert("Lỗi khi xóa lớp.");
      }
    }
  };

  return (
    <AuthGuard allowedRole="teacher">
      <main className="min-h-screen bg-gray-900 text-white flex flex-col">
        {/* Header */}
        <header className="bg-gray-800 border-b border-gray-700 p-4 flex justify-between items-center shadow-md">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-blue-400">{t('app.title')} <span className="text-sm font-normal text-gray-400">| {t('role.teacher')}</span></h1>
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
          <div className="space-y-8">
            <div className="bg-gray-800 border border-gray-700 rounded-3xl p-6 md:p-8 shadow-xl">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Plus className="w-5 h-5 text-blue-400" /> Tạo lớp học mới</h2>
              <form onSubmit={handleCreateClass} className="flex flex-col sm:flex-row gap-4">
                <input 
                  type="text" 
                  name="name" 
                  required 
                  placeholder="Tên lớp (VD: Lớp Tiếng Đức A1)" 
                  className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-400" 
                />
                <input 
                  type="text" 
                  name="password" 
                  placeholder="Mật khẩu (tùy chọn)" 
                  className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-400" 
                />
                <button type="submit" className="py-3 px-8 bg-blue-600 hover:bg-blue-700 font-bold rounded-xl whitespace-nowrap transition-colors shadow-lg shadow-blue-500/20">
                  Tạo lớp
                </button>
              </form>
            </div>

            <div>
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <GraduationCap className="w-6 h-6 text-gray-400" />
                Lớp học của bạn ({classes.length})
              </h2>
              
              {loading ? (
                <div className="flex justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-400"></div>
                </div>
              ) : classes.length === 0 ? (
                <div className="bg-gray-800 border border-gray-700 rounded-2xl p-8 text-center text-gray-500">
                  Bạn chưa tạo lớp học nào.
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {classes.map(cls => (
                    <Link 
                      href={`/teacher/class/${cls.id}`}
                      key={cls.id} 
                      className="bg-gray-800 border border-gray-700 rounded-2xl p-6 hover:border-blue-500/50 hover:shadow-xl hover:shadow-blue-500/10 transition-all relative group block"
                    >
                      <button 
                        onClick={(e) => handleDeleteClass(cls.id!, e)} 
                        className="absolute top-4 right-4 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-full hover:bg-gray-700"
                        title="Xóa lớp học"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                      <h3 className="font-bold text-xl text-white pr-8 mb-2 truncate">{cls.name || cls.className}</h3>
                      <div className="bg-gray-900 inline-block px-3 py-1 rounded-lg border border-gray-700 mb-4">
                        <p className="text-blue-400 font-mono text-sm">ID: {cls.id}</p>
                      </div>
                      <div className="text-gray-500 text-sm flex justify-between items-center">
                        <span>{cls.password ? '🔒 Có mật khẩu' : '🔓 Mở tự do'}</span>
                        <span>{cls.createdAt && new Date(cls.createdAt.seconds ? cls.createdAt.seconds * 1000 : cls.createdAt).toLocaleDateString()}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </AuthGuard>
  );
}
