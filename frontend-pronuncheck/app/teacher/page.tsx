'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import AuthGuard from '@/app/components/AuthGuard';
import { useRouter } from 'next/navigation';
import { db } from '@/app/firebase';
import { collection, query, where, getDocs, doc, setDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { LogOut, Plus, Trash2, Users, FileText, ArrowLeft, Play, Settings } from 'lucide-react';

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
  const router = useRouter();
  
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<any>(null);
  
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
    const q = query(collection(db, 'classes'), where('teacherId', '==', user.uid));
    const snap = await getDocs(q);
    setClasses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const createClass = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = e.target as typeof e.target & { name: { value: string }, password: { value: string } };
    const name = target.name.value;
    const password = target.password.value;
    const classId = generateClassId();
    
    await setDoc(doc(db, 'classes', classId), {
      name,
      password,
      teacherId: user?.uid,
      createdAt: new Date().toISOString()
    });
    
    (e.target as HTMLFormElement).reset();
    loadClasses();
  };

  const deleteClass = async (id: string) => {
    if (confirm('Bạn có chắc muốn xóa lớp học này?')) {
      await deleteDoc(doc(db, 'classes', id));
      loadClasses();
      if(selectedClass?.id === id) setSelectedClass(null);
    }
  };

  return (
    <AuthGuard>
      <main className="min-h-screen bg-gray-900 text-white flex flex-col">
        {/* Header */}
        <header className="bg-gray-800 border-b border-gray-700 p-4 flex justify-between items-center shadow-md">
          <div className="flex items-center gap-3">
             {selectedClass && (
              <button onClick={() => setSelectedClass(null)} className="p-2 hover:bg-gray-700 rounded-full transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h1 className="text-xl font-bold text-blue-400">PronunCheck <span className="text-sm font-normal text-gray-400">| Giáo viên</span></h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-sm hidden sm:block">{user?.email}</span>
            <button onClick={handleLogout} className="text-red-400 hover:text-red-300 font-medium px-3 py-1.5 rounded-lg hover:bg-red-400/10 transition-colors flex items-center gap-2">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Đăng xuất</span>
            </button>
          </div>
        </header>

        <div className="flex-1 p-4 md:p-8 flex justify-center">
          <div className="w-full max-w-5xl">
            {!selectedClass ? (
              <div className="space-y-8">
                <div className="bg-gray-800 border border-gray-700 rounded-3xl p-6 md:p-8">
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Plus className="w-5 h-5 text-blue-400" /> Tạo lớp học mới</h2>
                  <form onSubmit={createClass} className="flex flex-col sm:flex-row gap-4">
                    <input type="text" name="name" required placeholder="Tên lớp (VD: Lớp Tiếng Đức A1)" className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    <input type="text" name="password" placeholder="Mật khẩu (tùy chọn)" className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    <button type="submit" className="py-3 px-6 bg-blue-500 hover:bg-blue-600 font-bold rounded-xl whitespace-nowrap">Tạo lớp</button>
                  </form>
                </div>

                <div>
                  <h2 className="text-xl font-bold mb-4">Lớp học của bạn ({classes.length})</h2>
                  {classes.length === 0 ? (
                    <p className="text-gray-500 italic">Bạn chưa tạo lớp học nào.</p>
                  ) : (
                    <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {classes.map(cls => (
                        <div key={cls.id} onClick={() => setSelectedClass(cls)} className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-blue-500/50 cursor-pointer transition-colors relative group">
                          <button onClick={(e) => { e.stopPropagation(); deleteClass(cls.id); }} className="absolute top-4 right-4 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-full hover:bg-gray-700">
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <h3 className="font-bold text-lg text-white pr-8">{cls.name}</h3>
                          <p className="text-blue-400 font-mono mt-1 text-sm">ID: {cls.id}</p>
                          <p className="text-gray-500 text-xs mt-4">Tạo ngày: {new Date(cls.createdAt).toLocaleDateString()}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <ClassDetailsView cls={selectedClass} />
            )}
          </div>
        </div>
      </main>
    </AuthGuard>
  );
}

function ClassDetailsView({ cls }: { cls: any }) {
  const [activeTab, setActiveTab] = useState<'tasks' | 'students'>('tasks');

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-3xl p-6 md:p-8">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-blue-400 mb-1">{cls.name}</h2>
        <p className="text-gray-400 font-mono">Mã lớp: <span className="bg-gray-900 px-2 py-1 rounded text-gray-300">{cls.id}</span> | Mật khẩu: <span className="bg-gray-900 px-2 py-1 rounded text-gray-300">{cls.password || '(Không có)'}</span></p>
      </div>

      <div className="flex border-b border-gray-700 mb-6">
        <button onClick={() => setActiveTab('tasks')} className={`px-4 py-3 font-semibold flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'tasks' ? 'border-blue-400 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-300'}`}>
          <FileText className="w-4 h-4" /> Bài tập
        </button>
        <button onClick={() => setActiveTab('students')} className={`px-4 py-3 font-semibold flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'students' ? 'border-blue-400 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-300'}`}>
          <Users className="w-4 h-4" /> Học sinh
        </button>
      </div>

      {activeTab === 'tasks' ? <TasksTab classId={cls.id} /> : <StudentsTab classId={cls.id} />}
    </div>
  );
}

function TasksTab({ classId }: { classId: string }) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTaskForSubmissions, setSelectedTaskForSubmissions] = useState<any>(null);

  useEffect(() => { loadTasks(); }, [classId]);

  const loadTasks = async () => {
    const q = query(collection(db, 'tasks'), where('classId', '==', classId));
    const snap = await getDocs(q);
    setTasks(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = e.target as any;
    await addDoc(collection(db, 'tasks'), {
      classId,
      word: t.word.value,
      targetPhoneme: t.phoneme.value,
      deadline: t.deadline.value || null,
      w1: parseFloat(t.w1.value) || 0.4,
      w2: parseFloat(t.w2.value) || 0.6,
      threshold: parseFloat(t.threshold.value) || 0.55,
      createdAt: new Date().toISOString()
    });
    setShowCreate(false);
    loadTasks();
  };
  
  if (selectedTaskForSubmissions) {
    return <SubmissionsView task={selectedTaskForSubmissions} goBack={() => setSelectedTaskForSubmissions(null)} />;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold">Danh sách Bài tập</h3>
        <button onClick={() => setShowCreate(!showCreate)} className="bg-blue-500 hover:bg-blue-600 px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1">
          {showCreate ? 'Hủy' : <><Plus className="w-4 h-4"/> Thêm bài tập</>}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={createTask} className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-6 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 text-blue-400 font-semibold mb-2 flex items-center gap-2"><Settings className="w-4 h-4"/> Cấu hình bài tập mới</div>
          <div><label className="text-xs text-gray-400 block mb-1">Từ cần đọc *</label><input type="text" name="word" placeholder="VD: Schule" required className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" /></div>
          <div><label className="text-xs text-gray-400 block mb-1">Âm mục tiêu *</label><input type="text" name="phoneme" placeholder="VD: sch hoặc ʃ" required className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" /></div>
          <div><label className="text-xs text-gray-400 block mb-1">Hạn nộp (tùy chọn)</label><input type="datetime-local" name="deadline" className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm focus:border-blue-400 focus:outline-none text-white" style={{colorScheme:'dark'}}/></div>
          <div className="grid grid-cols-3 gap-2">
            <div><label className="text-xs text-gray-400 block mb-1" title="Trọng số âm thanh thô (Mặc định 0.4)">w1 (Wav2Vec)</label><input type="number" step="0.1" name="w1" defaultValue="0.4" className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-center" /></div>
            <div><label className="text-xs text-gray-400 block mb-1" title="Trọng số khớp từ (Mặc định 0.6)">w2 (Whisper)</label><input type="number" step="0.1" name="w2" defaultValue="0.6" className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-center" /></div>
            <div><label className="text-xs text-gray-400 block mb-1" title="Điểm tối thiểu để ĐẠT (Mặc định 0.55)">Ngưỡng (Độ khó)</label><input type="number" step="0.05" name="threshold" defaultValue="0.55" className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-center" /></div>
          </div>
          <div className="sm:col-span-2 mt-2"><button type="submit" className="w-full bg-blue-500 hover:bg-blue-600 py-2 rounded-lg font-bold">Lưu bài tập</button></div>
        </form>
      )}

      {tasks.length === 0 ? (
        <p className="text-gray-500 italic">Chưa có bài tập nào.</p>
      ) : (
        <div className="space-y-3">
          {tasks.map(task => (
            <div key={task.id} className="bg-gray-900 border border-gray-700 rounded-xl p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <h4 className="font-bold text-lg">{task.word} <span className="text-sm font-normal text-gray-400 ml-2">/ {task.targetPhoneme} /</span></h4>
                <div className="text-xs text-gray-500 mt-1 flex gap-3">
                  <span>Khó: {task.threshold}</span>
                  <span>w1: {task.w1} | w2: {task.w2}</span>
                  {task.deadline && <span className="text-amber-400">Hạn: {new Date(task.deadline).toLocaleString()}</span>}
                </div>
              </div>
              <button onClick={() => setSelectedTaskForSubmissions(task)} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg text-sm text-white transition-colors">
                Xem bài nộp
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SubmissionsView({ task, goBack }: { task: any, goBack: () => void }) {
  const [submissions, setSubmissions] = useState<any[]>([]);

  useEffect(() => { loadSubmissions(); }, [task.id]);

  const loadSubmissions = async () => {
    const q = query(collection(db, 'submissions'), where('taskId', '==', task.id));
    const snap = await getDocs(q);
    const subs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Sort by timestamp desc
    subs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setSubmissions(subs);
  };

  return (
    <div>
       <button onClick={goBack} className="text-gray-400 hover:text-white mb-4 flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Quay lại Bài tập
        </button>
        <h3 className="text-lg font-bold mb-4 border-b border-gray-700 pb-2">
          Bài nộp: <span className="text-blue-400">{task.word}</span>
        </h3>

        {submissions.length === 0 ? (
          <p className="text-gray-500 italic">Chưa có học sinh nào nộp bài.</p>
        ) : (
          <div className="space-y-4">
            {submissions.map(sub => (
              <div key={sub.id} className="bg-gray-900 border border-gray-700 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <p className="font-semibold">{sub.studentEmail}</p>
                  <p className="text-xs text-gray-500">{new Date(sub.timestamp).toLocaleString()}</p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                  <audio controls src={sub.audioUrl} className="h-8 w-48" />
                  
                  <div className={`px-3 py-1.5 rounded-lg text-sm font-bold text-center w-24 ${sub.scores.is_passed ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {sub.scores.hybrid_target_score} / 100
                    <div className="text-[10px] font-normal opacity-80 mt-0.5">{sub.scores.is_passed ? 'ĐẠT' : 'KHÔNG ĐẠT'}</div>
                  </div>
                  
                  <div className="text-xs text-gray-400 w-32">
                    <p>Wav2Vec: {sub.scores.wav2vec_raw_score}</p>
                    <p>Whisper: {sub.scores.whisper_raw_score}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

function StudentsTab({ classId }: { classId: string }) {
  const [students, setStudents] = useState<any[]>([]);

  useEffect(() => { loadStudents(); }, [classId]);

  const loadStudents = async () => {
    const q = query(collection(db, 'class_members'), where('classId', '==', classId));
    const snap = await getDocs(q);
    setStudents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const removeStudent = async (id: string) => {
    if (confirm('Xóa học sinh này khỏi lớp?')) {
      await deleteDoc(doc(db, 'class_members', id));
      loadStudents();
    }
  };

  return (
    <div>
      <h3 className="text-lg font-bold mb-4">Danh sách Học sinh ({students.length})</h3>
      {students.length === 0 ? (
        <p className="text-gray-500 italic">Chưa có học sinh nào tham gia lớp này.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-900 text-gray-400">
              <tr>
                <th className="px-4 py-3 rounded-tl-lg">Email</th>
                <th className="px-4 py-3">Ngày tham gia</th>
                <th className="px-4 py-3 rounded-tr-lg">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {students.map(st => (
                <tr key={st.id} className="border-b border-gray-700/50 hover:bg-gray-800/50">
                  <td className="px-4 py-3 font-medium">{st.studentEmail}</td>
                  <td className="px-4 py-3 text-gray-400">{new Date(st.joinedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => removeStudent(st.id)} className="text-red-400 hover:text-red-300 text-xs font-semibold px-2 py-1 bg-red-400/10 rounded">Xóa</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
