import { db } from '@/app/firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query, 
  where, 
  serverTimestamp,
  setDoc
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
  title?: string;
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
  dtw_score?: number;
  fluent_score?: number;
  char_scores?: any[];
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

export async function updateAssignment(
  classId: string, 
  assignmentId: string, 
  data: Partial<Omit<AssignmentData, 'id' | 'classId'>>
): Promise<void> {
  const docRef = doc(db, `classes/${classId}/assignments`, assignmentId);
  await updateDoc(docRef, data);
}

export async function deleteAssignment(classId: string, assignmentId: string): Promise<void> {
  const docRef = doc(db, `classes/${classId}/assignments`, assignmentId);
  await deleteDoc(docRef);
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
export async function getClassesByTeacher(teacherId: string): Promise<ClassData[]> {
  const q = query(collection(db, 'classes'), where('teacherId', '==', teacherId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({
    id: d.id,
    ...d.data()
  } as ClassData));
}

export async function createClass(classData: Omit<ClassData, 'id'>, customId?: string): Promise<string> {
  if (customId) {
    await setDoc(doc(db, 'classes', customId), {
      ...classData,
      createdAt: serverTimestamp()
    });
    return customId;
  } else {
    const ref = await addDoc(collection(db, 'classes'), {
      ...classData,
      createdAt: serverTimestamp()
    });
    return ref.id;
  }
}

export async function deleteClass(classId: string): Promise<void> {
  const { deleteDoc, doc } = await import('firebase/firestore');
  await deleteDoc(doc(db, 'classes', classId));
}

export async function joinClass(classId: string, studentId: string, studentEmail: string): Promise<void> {
  await setDoc(doc(db, 'class_members', `${classId}_${studentId}`), {
    classId,
    studentId,
    studentEmail,
    joinedAt: serverTimestamp()
  }, { merge: true });
}

export async function getJoinedClasses(studentId: string): Promise<(ClassData & { joinedAt?: any })[]> {
  const q = query(collection(db, 'class_members'), where('studentId', '==', studentId));
  const snap = await getDocs(q);
  
  const classPromises = snap.docs.map(async (d) => {
    const data = d.data();
    const classData = await getClass(data.classId);
    if (classData) {
      return { ...classData, joinedAt: data.joinedAt };
    }
    return null;
  });
  
  const classes = (await Promise.all(classPromises)).filter(c => c !== null) as (ClassData & { joinedAt?: any })[];
  return classes;
}
