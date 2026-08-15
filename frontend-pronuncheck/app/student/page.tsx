'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import AuthGuard from '@/app/components/AuthGuard';
import { useRouter } from 'next/navigation';
import { Mic, Upload, LogOut, ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import { db, storage } from '@/app/firebase';
import { collection, query, where, getDocs, doc, getDoc, setDoc, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface AssessmentResult {
  is_passed: boolean;
  feedback: string;
}

export default function StudentDashboard() {
  const { user, userRole, logout } = useAuth();
  const router = useRouter();
  
  const [mode, setMode] = useState<'dashboard' | 'free' | 'class'>('dashboard');
  
  // Guard role
  useEffect(() => {
    if (userRole && userRole !== 'student') {
      router.push('/');
    }
  }, [userRole, router]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <AuthGuard>
      <main className="min-h-screen bg-gray-900 text-white flex flex-col">
        {/* Header Bar */}
        <header className="bg-gray-800 border-b border-gray-700 p-4 flex justify-between items-center shadow-md">
          <div className="flex items-center gap-3">
            {mode !== 'dashboard' && (
              <button onClick={() => setMode('dashboard')} className="p-2 hover:bg-gray-700 rounded-full transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <h1 className="text-xl font-bold text-lime-400">PronunCheck <span className="text-sm font-normal text-gray-400">| Học sinh</span></h1>
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
          <div className="w-full max-w-4xl">
            {mode === 'dashboard' && <DashboardView setMode={setMode} />}
            {mode === 'free' && <FreeModeView />}
            {mode === 'class' && <ClassModeView user={user} />}
          </div>
        </div>
      </main>
    </AuthGuard>
  );
}

function DashboardView({ setMode }: { setMode: (mode: 'free' | 'class') => void }) {
  return (
    <div className="grid md:grid-cols-2 gap-6 mt-8">
      <div 
        onClick={() => setMode('free')}
        className="bg-gray-800 border border-gray-700 rounded-3xl p-8 hover:bg-gray-750 transition-all hover:border-lime-400/50 hover:shadow-2xl hover:shadow-lime-400/10 cursor-pointer flex flex-col items-center justify-center text-center group"
      >
        <div className="w-16 h-16 bg-lime-400/10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
          <Mic className="w-8 h-8 text-lime-400" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Tự do luyện tập</h2>
        <p className="text-gray-400 text-sm">Nhập từ bạn muốn luyện, ghi âm và nhận phản hồi ngay lập tức.</p>
      </div>
      
      <div 
        onClick={() => setMode('class')}
        className="bg-gray-800 border border-gray-700 rounded-3xl p-8 hover:bg-gray-750 transition-all hover:border-blue-400/50 hover:shadow-2xl hover:shadow-blue-400/10 cursor-pointer flex flex-col items-center justify-center text-center group"
      >
        <div className="w-16 h-16 bg-blue-400/10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
          <Upload className="w-8 h-8 text-blue-400" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Làm bài tập lớp</h2>
        <p className="text-gray-400 text-sm">Tham gia lớp học bằng Mã lớp, hoàn thành bài tập giáo viên giao.</p>
      </div>
    </div>
  );
}

// ---------------- FREE MODE ----------------
function FreeModeView() {
  const [word, setWord] = useState('');
  const [phoneme, setPhoneme] = useState('');
  
  const [isRecording, setIsRecording] = useState(false);
  const [isAssessing, setIsAssessing] = useState(false);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    if (!word || !phoneme) {
      alert("Vui lòng nhập Từ và Âm mục tiêu trước khi ghi âm.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      mediaRecorderRef.current = new MediaRecorder(stream);

      mediaRecorderRef.current.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioChunksRef.current = [];
        setRecordedBlob(audioBlob);
        setPreviewAudioUrl(URL.createObjectURL(audioBlob));
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setResult(null);
      setRecordedBlob(null);
      setPreviewAudioUrl(null);
    } catch (err) {
      alert('Không thể truy cập Micro!');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  const submitRecording = async () => {
    if (!recordedBlob) return;
    setIsAssessing(true);
    await sendAudioToAPI(recordedBlob);
  };

  const cancelRecording = () => {
    setRecordedBlob(null);
    setPreviewAudioUrl(null);
  };

  const sendAudioToAPI = async (audioBlob: Blob) => {
    const formData = new FormData();
    formData.append('audio_file', audioBlob, 'record.webm');
    formData.append('expected_word', word);
    formData.append('target_phoneme', phoneme);

    try {
      const response = await fetch('http://127.0.0.1:8000/api/v1/assess', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('Server API error');
      const data = await response.json();
      setResult({ is_passed: data.assessment.is_passed, feedback: data.assessment.feedback });
    } catch (error) {
      alert('Lỗi kết nối máy chủ API.');
    } finally {
      setIsAssessing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!word || !phoneme) {
      alert("Vui lòng nhập Từ và Âm mục tiêu trước khi tải file lên.");
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    setIsAssessing(true);
    setResult(null);
    setRecordedBlob(null);
    setPreviewAudioUrl(null);
    await sendAudioToAPI(file);
    e.target.value = ''; // reset input
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-3xl p-6 md:p-10 mx-auto max-w-xl">
      <h2 className="text-2xl font-bold mb-6 text-center text-lime-400">Luyện tập tự do</h2>
      <div className="space-y-4 mb-8">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Từ cần luyện (ví dụ: Schule)</label>
          <input type="text" value={word} onChange={e=>setWord(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-lime-400 text-white" placeholder="Nhập từ..." />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">Âm mục tiêu (ví dụ: ʃ)</label>
          <input type="text" value={phoneme} onChange={e=>setPhoneme(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-lime-400 text-white" placeholder="Nhập âm..." />
        </div>
      </div>

      <div className="space-y-4">
        {!isRecording && !recordedBlob && (
          <button onClick={startRecording} disabled={isAssessing} className="w-full py-4 px-4 bg-lime-400 hover:bg-lime-500 text-gray-950 font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            <Mic className="w-5 h-5" />
            {isAssessing ? 'Đang chấm điểm...' : 'Bắt đầu ghi âm'}
          </button>
        )}
        
        {isRecording && (
          <button onClick={stopRecording} className="w-full py-4 px-4 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-all animate-pulse flex items-center justify-center gap-2">
            Dừng ghi âm
          </button>
        )}

        {recordedBlob && previewAudioUrl && !isAssessing && !result && (
          <div className="bg-gray-900 p-4 rounded-xl border border-gray-700 space-y-4">
            <p className="text-center text-gray-300 font-medium">Nghe lại bản thu của bạn:</p>
            <audio src={previewAudioUrl} controls className="w-full" />
            <div className="flex gap-3 mt-4">
              <button onClick={cancelRecording} className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors">
                Thu âm lại
              </button>
              <button onClick={submitRecording} className="flex-1 py-3 bg-lime-500 hover:bg-lime-600 text-gray-950 font-bold rounded-lg transition-colors">
                Nộp bài
              </button>
            </div>
          </div>
        )}

        {isAssessing && (
           <div className="w-full py-4 px-4 bg-gray-700 text-gray-300 font-bold rounded-xl flex items-center justify-center">
             Đang chấm điểm...
           </div>
        )}
        
        {!recordedBlob && !isRecording && !isAssessing && (
          <>
            <div className="relative flex items-center justify-center">
               <span className="bg-gray-800 px-3 text-sm text-gray-500 z-10">hoặc</span>
               <div className="absolute w-full h-px bg-gray-700"></div>
            </div>
            
            <label className="w-full py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-xl cursor-pointer flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
              <Upload className="w-5 h-5" />
              Tải file âm thanh (.wav, .mp3, .webm)
              <input type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} disabled={isAssessing || isRecording} />
            </label>
          </>
        )}
      </div>

      {result && (
        <div className={`mt-8 p-6 border rounded-2xl text-center space-y-3 ${result.is_passed ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
          {result.is_passed ? (
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto" />
          ) : (
            <XCircle className="w-12 h-12 text-red-400 mx-auto" />
          )}
          <h3 className={`text-2xl font-bold ${result.is_passed ? 'text-green-400' : 'text-red-400'}`}>
            {result.is_passed ? 'ĐẠT' : 'CHƯA ĐẠT'}
          </h3>
          <p className="text-gray-300">{result.feedback}</p>
          <button onClick={() => { setResult(null); setRecordedBlob(null); setPreviewAudioUrl(null); }} className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-white transition-colors">
            Thử từ khác
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------- CLASS MODE ----------------
function ClassModeView({ user }: { user: any }) {
  const [viewMode, setViewMode] = useState<'list' | 'join' | 'inside_class' | 'task'>('list');
  const [joinedClasses, setJoinedClasses] = useState<any[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);

  const [classId, setClassId] = useState('');
  const [password, setPassword] = useState('');
  const [currentClass, setCurrentClass] = useState<any>(null);
  
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [selectedTask, setSelectedTask] = useState<any>(null);

  // Ghi âm variables
  const [isRecording, setIsRecording] = useState(false);
  const [isAssessing, setIsAssessing] = useState(false);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!user) return;
    
    const fetchClasses = async () => {
      setLoadingClasses(true);
      try {
        const q = query(collection(db, 'class_members'), where('studentId', '==', user.uid));
        const snap = await getDocs(q);
        
        const classPromises = snap.docs.map(async (d) => {
          const data = d.data();
          const classRef = doc(db, 'classes', data.classId);
          const classSnap = await getDoc(classRef);
          if (classSnap.exists()) {
            return { id: classSnap.id, ...classSnap.data(), joinedAt: data.joinedAt };
          }
          return null;
        });
        
        const classes = (await Promise.all(classPromises)).filter(c => c !== null);
        setJoinedClasses(classes);
      } catch (err) {
        console.error("Lỗi khi tải danh sách lớp:", err);
      } finally {
        setLoadingClasses(false);
      }
    };
    
    fetchClasses();
  }, [user]);

  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const classRef = doc(db, 'classes', classId);
      const classSnap = await getDoc(classRef);
      if (!classSnap.exists()) {
        setError('Không tìm thấy lớp học này.');
        return;
      }
      const classData = classSnap.data();
      if (classData.password && classData.password !== password) {
        setError('Sai mật khẩu lớp học.');
        return;
      }
      const newClass = { id: classSnap.id, ...classData };
      
      // Save to class_members
      await setDoc(doc(db, 'class_members', `${classSnap.id}_${user.uid}`), {
        classId: classSnap.id,
        studentId: user.uid,
        studentEmail: user.email,
        joinedAt: new Date().toISOString()
      }, { merge: true });

      // Add to list and go to inside_class
      setJoinedClasses(prev => {
        if (!prev.find(c => c.id === newClass.id)) {
          return [...prev, newClass];
        }
        return prev;
      });
      
      handleOpenClass(newClass);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenClass = async (cls: any) => {
    setCurrentClass(cls);
    setViewMode('inside_class');
    setLoading(true);
    try {
      const q = query(collection(db, 'tasks'), where('classId', '==', cls.id));
      const querySnapshot = await getDocs(q);
      const t = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTasks(t);
    } catch(err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioChunksRef.current = [];
        setRecordedBlob(audioBlob);
        setPreviewAudioUrl(URL.createObjectURL(audioBlob));
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setResult(null);
      setRecordedBlob(null);
      setPreviewAudioUrl(null);
    } catch (err) {
      alert('Không thể truy cập Micro!');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };
  
  const submitRecording = async () => {
    if (!recordedBlob || !selectedTask) return;
    setIsAssessing(true);
    await sendAudioToAPIAndSave(recordedBlob, selectedTask);
  };

  const cancelRecording = () => {
    setRecordedBlob(null);
    setPreviewAudioUrl(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsAssessing(true);
    setResult(null);
    setRecordedBlob(null);
    setPreviewAudioUrl(null);
    await sendAudioToAPIAndSave(file, selectedTask);
    e.target.value = '';
  };

  const sendAudioToAPIAndSave = async (audioBlob: Blob, task: any) => {
    const formData = new FormData();
    formData.append('audio_file', audioBlob, 'record.webm');
    formData.append('expected_word', task.word);
    formData.append('target_phoneme', task.targetPhoneme);
    if(task.w1) formData.append('w1', task.w1);
    if(task.w2) formData.append('w2', task.w2);
    if(task.threshold) formData.append('threshold', task.threshold);

    try {
      // 1. Call API
      const response = await fetch('http://127.0.0.1:8000/api/v1/assess', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('API error');
      const data = await response.json();
      
      // 2. Upload audio to Firebase Storage for Teacher
      const audioRef = ref(storage, `submissions/${currentClass.id}/${task.id}/${user.uid}_${Date.now()}.webm`);
      await uploadBytes(audioRef, audioBlob);
      const audioUrl = await getDownloadURL(audioRef);
      
      // 3. Save submission to Firestore
      await addDoc(collection(db, 'submissions'), {
        taskId: task.id,
        classId: currentClass.id,
        studentId: user.uid,
        studentEmail: user.email,
        audioUrl: audioUrl,
        scores: data.assessment,
        timestamp: new Date().toISOString()
      });

      setResult({ is_passed: data.assessment.is_passed, feedback: data.assessment.feedback });
    } catch (error) {
      alert('Lỗi khi chấm bài. Vui lòng thử lại.');
      console.error(error);
    } finally {
      setIsAssessing(false);
    }
  };

  if (viewMode === 'list') {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-3xl p-6 md:p-10 mx-auto max-w-3xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-blue-400">Lớp học của tôi</h2>
          <button onClick={() => setViewMode('join')} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl transition-colors">
            + Tham gia lớp mới
          </button>
        </div>
        
        {loadingClasses ? (
          <p className="text-gray-400 text-center py-8">Đang tải danh sách lớp...</p>
        ) : joinedClasses.length === 0 ? (
          <div className="text-center py-12 bg-gray-900/50 rounded-2xl border border-gray-700">
            <p className="text-gray-400 mb-4">Bạn chưa tham gia lớp học nào.</p>
            <button onClick={() => setViewMode('join')} className="px-6 py-3 bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white rounded-xl font-medium transition-all">
              Tham gia lớp học ngay
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {joinedClasses.map(cls => (
              <div key={cls.id} onClick={() => handleOpenClass(cls)} className="bg-gray-900 border border-gray-700 rounded-xl p-5 cursor-pointer hover:border-blue-500/50 transition-all flex justify-between items-center group">
                <div>
                  <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">{cls.name || 'Lớp học không tên'}</h3>
                  <p className="text-sm text-gray-400 mt-1">Mã lớp: {cls.id}</p>
                </div>
                <div className="text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  Vào lớp →
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (viewMode === 'join') {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-3xl p-6 md:p-10 mx-auto max-w-md">
        <button onClick={() => setViewMode('list')} className="text-gray-400 hover:text-white mb-6 flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Quay lại danh sách
        </button>
        <h2 className="text-2xl font-bold mb-6 text-center text-blue-400">Tham gia lớp học</h2>
        {error && <div className="p-3 mb-4 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl">{error}</div>}
        <form onSubmit={handleJoinClass} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Mã lớp (Class ID)</label>
            <input type="text" required value={classId} onChange={e=>setClassId(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="VD: 7A1X8Z2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Mật khẩu lớp</label>
            <input type="password" required value={password} onChange={e=>setPassword(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="Nhập mật khẩu" />
          </div>
          <button type="submit" disabled={loading} className="w-full py-4 px-4 bg-blue-500 hover:bg-blue-600 font-bold text-white rounded-xl disabled:opacity-50">
            {loading ? 'Đang vào lớp...' : 'Vào lớp'}
          </button>
        </form>
      </div>
    );
  }

  if (viewMode === 'task' && selectedTask) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-3xl p-6 md:p-10 mx-auto max-w-xl">
        <button onClick={() => { setViewMode('inside_class'); setSelectedTask(null); setResult(null); setRecordedBlob(null); setPreviewAudioUrl(null); }} className="text-gray-400 hover:text-white mb-6 flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Quay lại danh sách bài tập
        </button>
        
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-blue-400 mb-2">Bài tập: Phát âm vần "{selectedTask.targetPhoneme}"</h2>
          <p className="text-gray-400">Hãy đọc từ: <strong className="text-white text-xl ml-2">{selectedTask.word}</strong></p>
        </div>

        <div className="space-y-4">
          {!isRecording && !recordedBlob && (
            <button onClick={startRecording} disabled={isAssessing} className="w-full py-4 px-4 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              <Mic className="w-5 h-5" />
              {isAssessing ? 'Đang nộp và chấm điểm...' : 'Bắt đầu ghi âm'}
            </button>
          )}
          
          {isRecording && (
            <button onClick={stopRecording} className="w-full py-4 px-4 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-all animate-pulse flex items-center justify-center gap-2">
              Dừng ghi âm
            </button>
          )}

          {recordedBlob && previewAudioUrl && !isAssessing && !result && (
            <div className="bg-gray-900 p-4 rounded-xl border border-gray-700 space-y-4">
              <p className="text-center text-gray-300 font-medium">Nghe lại bản thu của bạn:</p>
              <audio src={previewAudioUrl} controls className="w-full" />
              <div className="flex gap-3 mt-4">
                <button onClick={cancelRecording} className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors">
                  Thu âm lại
                </button>
                <button onClick={submitRecording} className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-lg transition-colors">
                  Nộp bài
                </button>
              </div>
            </div>
          )}

          {isAssessing && (
             <div className="w-full py-4 px-4 bg-gray-700 text-gray-300 font-bold rounded-xl flex items-center justify-center">
               Đang nộp và chấm điểm...
             </div>
          )}
          
          {!recordedBlob && !isRecording && !isAssessing && (
            <>
              <div className="relative flex items-center justify-center">
                 <span className="bg-gray-800 px-3 text-sm text-gray-500 z-10">hoặc</span>
                 <div className="absolute w-full h-px bg-gray-700"></div>
              </div>
              
              <label className="w-full py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-xl cursor-pointer flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
                <Upload className="w-5 h-5" />
                Tải file âm thanh (.wav, .mp3, .webm)
                <input type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} disabled={isAssessing || isRecording} />
              </label>
            </>
          )}
        </div>

        {result && (
          <div className={`mt-8 p-6 border rounded-2xl text-center space-y-3 ${result.is_passed ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
            {result.is_passed ? (
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto" />
            ) : (
              <XCircle className="w-12 h-12 text-red-400 mx-auto" />
            )}
            <h3 className={`text-2xl font-bold ${result.is_passed ? 'text-green-400' : 'text-red-400'}`}>
              {result.is_passed ? 'ĐẠT' : 'CHƯA ĐẠT'}
            </h3>
            <p className="text-gray-300">{result.feedback}</p>
            <p className="text-sm text-blue-300 mt-4">Kết quả và bản thu âm đã được gửi cho Giáo viên.</p>
            <button onClick={() => { setResult(null); setRecordedBlob(null); setPreviewAudioUrl(null); }} className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-white transition-colors">
              Làm lại
            </button>
          </div>
        )}
      </div>
    );
  }

  // viewMode === 'inside_class'
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-3xl p-6 md:p-10 mx-auto max-w-3xl">
      <button onClick={() => setViewMode('list')} className="text-gray-400 hover:text-white mb-6 flex items-center gap-2">
        <ArrowLeft className="w-4 h-4" /> Quay lại danh sách lớp
      </button>
      
      <h2 className="text-2xl font-bold mb-2">Lớp: <span className="text-blue-400">{currentClass?.name}</span></h2>
      <p className="text-gray-400 mb-6">Mã lớp: {currentClass?.id}</p>
      
      <h3 className="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">Danh sách bài tập</h3>
      {loading ? (
        <p className="text-gray-400 text-center py-8">Đang tải bài tập...</p>
      ) : tasks.length === 0 ? (
        <p className="text-gray-500 italic text-center py-8">Chưa có bài tập nào được giao.</p>
      ) : (
        <div className="grid gap-4">
          {tasks.map(task => (
            <div key={task.id} className="bg-gray-900 border border-gray-700 rounded-xl p-4 flex justify-between items-center hover:border-blue-500/50 transition-colors">
              <div>
                <h4 className="font-bold text-lg text-white">Từ: {task.word}</h4>
                <p className="text-sm text-gray-400">Âm mục tiêu: {task.targetPhoneme}</p>
                {task.deadline && <p className="text-xs text-red-400 mt-1">Hạn: {new Date(task.deadline).toLocaleString()}</p>}
              </div>
              <button onClick={() => { setSelectedTask(task); setViewMode('task'); setResult(null); setRecordedBlob(null); setPreviewAudioUrl(null); }} className="px-4 py-2 bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white rounded-lg font-medium transition-all">
                Làm bài
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
