import { db } from '@/app/firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  serverTimestamp, 
  Timestamp,
  FieldValue
} from 'firebase/firestore';

export interface ScoringConfig {
  threshold?: number;
  passing_threshold?: number;
  w1?: number;
  w2?: number;
  mode?: 'auto' | 'manual';
  L0?: number;
  k?: number;
  weights?: {
    wav2vec?: number;
    dtw?: number;
    whisper?: number;
  };
}

export interface ClassData {
  id?: string;
  name: string;
  className?: string;
  password?: string;
  teacherId: string;
  teacherEmail: string;
  scoringConfig?: ScoringConfig;
  createdAt?: any;
}

export interface AssignmentData {
  id?: string;
  classId: string;
  title?: string;
  word: string;
  targetPhoneme: string;
  maxAttempts: number;
  deadline?: any;
  isActive?: boolean;
  isPassed?: boolean;
  remainingAttempts?: number;
  submissions?: SubmissionData[];
  scoringConfig?: ScoringConfig;
  enableSampleAudio?: boolean;
  sampleAudioType?: 'tts' | 'teacher_record';
  sampleAudioUrl?: string;
  sampleAudioStoragePath?: string;
  createdAt?: any;
}

export interface SubmissionData {
  id?: string;
  classId?: string;
  assignmentId: string;
  studentId: string;
  studentEmail: string;
  word: string;
  targetPhoneme?: string;
  audioUrl?: string;
  audioStoragePath?: string;
  scores?: {
    phoneme_score?: number;
    dtw_score?: number;
    whisper_score?: number;
    total_score?: number;
  };
  detailedScore?: {
    wav2vec_score?: number;
    wav2vec_raw_score?: number;
    dtw_score?: number;
    whisper_score?: number;
    whisper_raw_score?: number;
    hybrid_target_score?: number;
    char_scores?: any[];
  };
  charScores?: {
    char: string;
    score: number;
    actual: string;
    duration_frames?: number;
    duration_multiplier?: number;
    duration_feedback?: string | null;
  }[];
  worstChar?: {
    char: string;
    score: number;
    actual: string;
  };
  feedback?: string;
  teacherNote?: string;
  teacherNoteUpdatedAt?: any;
  isPassed: boolean;
  attemptNumber: number;
  createdAt?: any;
}

export interface ClassMemberData {
  id?: string;
  classId: string;
  studentId: string;
  studentEmail: string;
  joinedAt?: any;
}

/**
 * Loại bỏ triệt để mọi giá trị undefined khỏi object trước khi ghi vào Firestore.
 * Giữ nguyên các đối tượng đặc biệt của Firebase như FieldValue (serverTimestamp), Timestamp, Date.
 */
export function cleanForFirestore<T>(data: T): T {
  if (data === null || data === undefined) return null as any;
  if (Array.isArray(data)) {
    return data
      .map(item => cleanForFirestore(item))
      .filter(item => item !== undefined) as any;
  }
  
  // Bảo toàn Date, Timestamp, FieldValue (serverTimestamp, arrayUnion, etc.)
  if (
    data instanceof Date || 
    data instanceof Timestamp || 
    data instanceof FieldValue ||
    (typeof data === 'object' && ('_methodName' in (data as any) || 'toMillis' in (data as any)))
  ) {
    return data;
  }

  if (typeof data === 'object') {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(data as any)) {
      if (value !== undefined) {
        cleaned[key] = cleanForFirestore(value);
      }
    }
    return cleaned;
  }
  return data;
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

export async function updateClass(classId: string, data: Partial<ClassData>): Promise<void> {
  const docRef = doc(db, 'classes', classId);
  await updateDoc(docRef, cleanForFirestore(data));
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
  const cleaned = cleanForFirestore(assignment);
  const ref = await addDoc(collection(db, `classes/${classId}/assignments`), {
    ...cleaned,
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
  await updateDoc(docRef, cleanForFirestore(data));
}

export async function deleteAssignment(classId: string, assignmentId: string): Promise<void> {
  const docRef = doc(db, `classes/${classId}/assignments`, assignmentId);
  await deleteDoc(docRef);
}

export async function deleteAssignmentWithSubmissions(
  classId: string, 
  assignmentId: string, 
  deleteSubmissions: boolean
): Promise<void> {
  const docRef = doc(db, `classes/${classId}/assignments`, assignmentId);
  await deleteDoc(docRef);

  if (deleteSubmissions) {
    const q = query(
      collection(db, `classes/${classId}/submissions`),
      where('assignmentId', '==', assignmentId)
    );
    const snap = await getDocs(q);
    const deletePromises = snap.docs.map(d => deleteDoc(d.ref));
    await Promise.all(deletePromises);
  }
}

export async function updateScoringConfig(classId: string, config: ScoringConfig): Promise<void> {
  const docRef = doc(db, 'classes', classId);
  await updateDoc(docRef, cleanForFirestore({
    scoringConfig: config
  }));
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
  const cleaned = cleanForFirestore(submission);
  const ref = await addDoc(collection(db, `classes/${classId}/submissions`), {
    ...cleaned,
    createdAt: serverTimestamp()
  });
  return ref.id;
}

export async function deleteSubmission(classId: string, submissionId: string): Promise<void> {
  const docRef = doc(db, `classes/${classId}/submissions`, submissionId);
  await deleteDoc(docRef);
}

export async function updateSubmissionNote(classId: string, submissionId: string, note: string): Promise<void> {
  const docRef = doc(db, `classes/${classId}/submissions`, submissionId);
  await updateDoc(docRef, cleanForFirestore({
    teacherNote: note.trim(),
    teacherNoteUpdatedAt: serverTimestamp()
  }));
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
  const cleaned = cleanForFirestore(classData);
  const payload = {
    ...cleaned,
    createdAt: serverTimestamp()
  };
  if (customId) {
    await setDoc(doc(db, 'classes', customId), payload);
    return customId;
  } else {
    const ref = await addDoc(collection(db, 'classes'), payload);
    return ref.id;
  }
}

export async function deleteClass(classId: string): Promise<void> {
  const docRef = doc(db, 'classes', classId);
  await deleteDoc(docRef);
}

export async function joinClass(classId: string, studentId: string, studentEmail: string): Promise<void> {
  await setDoc(doc(db, 'class_members', `${classId}_${studentId}`), {
    classId,
    studentId,
    studentEmail,
    joinedAt: serverTimestamp()
  }, { merge: true });
}

export async function isClassMember(classId: string, studentId: string): Promise<boolean> {
  const docRef = doc(db, 'class_members', `${classId}_${studentId}`);
  const snap = await getDoc(docRef);
  return snap.exists();
}

export async function getClassMembers(classId: string): Promise<ClassMemberData[]> {
  const q = query(collection(db, 'class_members'), where('classId', '==', classId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({
    id: d.id,
    ...d.data()
  } as ClassMemberData));
}

export async function addMemberByEmail(classId: string, studentEmail: string): Promise<string> {
  // Tạo unique id dựa trên email
  const cleanEmail = studentEmail.trim().toLowerCase();
  const safeId = cleanEmail.replace(/[^a-zA-Z0-9]/g, '_');
  const docRef = doc(db, 'class_members', `${classId}_manual_${safeId}`);
  await setDoc(docRef, {
    classId,
    studentId: `manual_${safeId}`,
    studentEmail: cleanEmail,
    joinedAt: serverTimestamp()
  }, { merge: true });
  return `manual_${safeId}`;
}

export async function removeMember(classId: string, memberDocIdOrStudentId: string): Promise<void> {
  let docId = memberDocIdOrStudentId;
  if (!docId.startsWith(`${classId}_`)) {
    docId = `${classId}_${memberDocIdOrStudentId}`;
  }
  const docRef = doc(db, 'class_members', docId);
  await deleteDoc(docRef);
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
