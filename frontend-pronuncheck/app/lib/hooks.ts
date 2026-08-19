import useSWR from 'swr';
import { 
  getClass, 
  getAssignments, 
  getSubmissions, 
  getSubmissionsByStudent, 
  isClassMember,
  ClassData,
  AssignmentData,
  SubmissionData
} from './firestore';

// Fetchers
const classFetcher = (id: string) => getClass(id);
const assignmentsFetcher = (classId: string) => getAssignments(classId);
const submissionsFetcher = (classId: string) => getSubmissions(classId);
const studentSubmissionsFetcher = async ([classId, studentId]: [string, string]) => {
  const assignments = await getAssignments(classId);
  const assignmentsWithSubmissions = await Promise.all(
    assignments.map(async (assign) => {
      const subs = await getSubmissionsByStudent(classId, studentId, assign.id!);
      const isPassed = subs.some(s => s.isPassed);
      return {
        ...assign,
        submissions: subs,
        attemptsUsed: subs.length,
        isPassed
      };
    })
  );
  return assignmentsWithSubmissions;
};
const membershipFetcher = ([classId, userId]: [string, string]) => isClassMember(classId, userId);


// Hooks
export function useClassData(classId: string | null) {
  return useSWR<ClassData | null>(
    classId ? `class-${classId}` : null, 
    () => classFetcher(classId!)
  );
}

export function useClassAssignments(classId: string | null) {
  return useSWR<AssignmentData[]>(
    classId ? `assignments-${classId}` : null,
    () => assignmentsFetcher(classId!)
  );
}

export function useClassSubmissions(classId: string | null) {
  return useSWR<SubmissionData[]>(
    classId ? `submissions-${classId}` : null,
    () => submissionsFetcher(classId!)
  );
}

export function useStudentAssignmentsWithSubmissions(classId: string | null, studentId: string | null) {
  return useSWR<(AssignmentData & { submissions: SubmissionData[]; attemptsUsed: number; isPassed: boolean; })[]>(
    classId && studentId ? ['student-assignments', classId, studentId] : null,
    () => studentSubmissionsFetcher([classId!, studentId!])
  );
}

export function useClassMembership(classId: string | null, userId: string | null) {
  return useSWR<boolean>(
    classId && userId ? ['membership', classId, userId] : null,
    () => membershipFetcher([classId!, userId!])
  );
}
