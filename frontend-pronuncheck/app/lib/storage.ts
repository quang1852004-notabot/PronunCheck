import { storage } from '@/app/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export async function uploadAudio(
  classId: string,
  assignmentId: string,
  studentId: string,
  audioBlob: Blob
): Promise<string> {
  const path = `classes/${classId}/assignments/${assignmentId}/${studentId}_${Date.now()}.webm`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, audioBlob);
  return path;
}

export async function getAudioUrl(storagePath: string): Promise<string> {
  const storageRef = ref(storage, storagePath);
  return await getDownloadURL(storageRef);
}
