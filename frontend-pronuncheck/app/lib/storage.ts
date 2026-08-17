import { storage } from '@/app/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export interface UploadAudioParams {
  classId: string;
  assignmentId: string;
  studentId: string;
  blob: Blob;
}

export interface UploadAudioResult {
  storagePath: string;
  downloadUrl: string;
}

/**
 * Upload an audio blob to Firebase Storage and return both storagePath and public downloadUrl.
 * Supports both object parameter and positional parameters for backwards compatibility.
 */
export async function uploadAudio(
  param1: string | UploadAudioParams | Blob,
  param2?: string,
  param3?: string,
  param4?: Blob
): Promise<UploadAudioResult> {
  let classId = '';
  let assignmentId = '';
  let studentId = '';
  let audioBlob: Blob | null = null;

  if (typeof param1 === 'object' && !(param1 instanceof Blob)) {
    classId = param1.classId;
    assignmentId = param1.assignmentId;
    studentId = param1.studentId;
    audioBlob = param1.blob;
  } else if (param1 instanceof Blob) {
    // Handle inverted legacy call (blob, classId, studentId, assignmentId)
    audioBlob = param1;
    classId = param2 || 'default_class';
    studentId = param3 || 'unknown_student';
    assignmentId = (param4 as unknown as string) || 'default_assignment';
  } else {
    // Positional call (classId, assignmentId, studentId, blob)
    classId = param1;
    assignmentId = param2 || 'default_assignment';
    studentId = param3 || 'unknown_student';
    audioBlob = param4 || null;
  }

  if (!audioBlob) {
    throw new Error('No audio blob provided for upload.');
  }

  let extension = 'webm';
  if (audioBlob instanceof File && audioBlob.name) {
    const parts = audioBlob.name.split('.');
    if (parts.length > 1) {
      extension = parts.pop() || 'webm';
    }
  }

  const storagePath = `classes/${classId}/assignments/${assignmentId}/${studentId}_${Date.now()}.${extension}`;
  const storageRef = ref(storage, storagePath);
  
  await uploadBytes(storageRef, audioBlob);
  const downloadUrl = await getDownloadURL(storageRef);

  return { storagePath, downloadUrl };
}

export async function getAudioUrl(storagePathOrUrl: string): Promise<string> {
  if (!storagePathOrUrl) return '';
  // If already a full http(s) URL or blob URL, return as is
  if (storagePathOrUrl.startsWith('http://') || storagePathOrUrl.startsWith('https://') || storagePathOrUrl.startsWith('blob:')) {
    return storagePathOrUrl;
  }
  const storageRef = ref(storage, storagePathOrUrl);
  return await getDownloadURL(storageRef);
}
