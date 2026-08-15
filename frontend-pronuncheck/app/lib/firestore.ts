import { db } from '@/app/firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  query, 
  where, 
  serverTimestamp 
} from 'firebase/firestore';

export interface ScoringConfig {
  threshold: number;
  w1: number;
  w2: number;
}

export interface ClassData {
  id?: string;
  name?: string;
  className?: string;
  password?: string;
  teacherId: string;
  teacherEmail?: string;
  scoringConfig: ScoringConfig;
  createdAt?: any;
}

export interface AssignmentData {
  id?: string;
  classId?: string;
  word: string;
  targetPhoneme: string;
  maxAttempts: number;
  deadline?: any;
  isActive?: boolean;
  createdAt?: any;
}

export interface DetailedScore {
  wav2vec_raw_score: number;
  whisper_raw_score: number;
  hybrid_target_score: number;
  is_passed: boolean;
  feedback: string;
}

export interface SubmissionData {
  id?: string;
  classId?: string;
  studentId: string;
  studentEmail: string;
  assignmentId: string;
  word: string;
  audioStoragePath: string;
  detailedScore: DetailedScore;
  isPassed: boolean;
  attemptNumber: number;
  createdAt?: any;
}

export async function getClass(classId: string): Promise<ClassData | null> {
  const docRef = doc(db, 'classes', classId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: snap.id,
    name: data.name || data.className || '',
    className: data.className || data.name || '',
    password: data.password || '',
    teacherId: data.teacherId || '',
    teacherEmail: data.teacherEmail || '',
    scoringConfig: data.scoringConfig || { threshold: 0.6, w1: 0.4, w2: 0.6 },
    createdAt: data.createdAt
  };
}

export async function getAssignments(classId: string): Promise<AssignmentData[]> {
  const q = query(collection(db, `classes/${classId}/assignments`));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({
    id: d.id,
    classId,
    ...d.data()
  } as AssignmentData));
}

export async function createAssignment(classId: string, assignment: Omit<AssignmentData, 'id' | 'classId'>): Promise<string> {
  const ref = await addDoc(collection(db, `classes/${classId}/assignments`), {
    ...assignment,
    createdAt: serverTimestamp()
  });
  return ref.id;
}

export async function updateScoringConfig(classId: string, config: ScoringConfig): Promise<void> {
  const docRef = doc(db, 'classes', classId);
  await updateDoc(docRef, {
    scoringConfig: config
  });
}

export async function getSubmissions(classId: string): Promise<SubmissionData[]> {
  const q = query(collection(db, `classes/${classId}/submissions`));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({
    id: d.id,
    classId,
    ...d.data()
  } as SubmissionData));
}

export async function getSubmissionsByStudent(classId: string, studentId: string, assignmentId: string): Promise<SubmissionData[]> {
  const q = query(
    collection(db, `classes/${classId}/submissions`),
    where('studentId', '==', studentId),
    where('assignmentId', '==', assignmentId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({
    id: d.id,
    classId,
    ...d.data()
  } as SubmissionData));
}

export async function createSubmission(classId: string, submission: Omit<SubmissionData, 'id' | 'classId'>): Promise<string> {
  const ref = await addDoc(collection(db, `classes/${classId}/submissions`), {
    ...submission,
    createdAt: serverTimestamp()
  });
  return ref.id;
}
