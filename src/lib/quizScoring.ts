import type { Question } from '../types/question';
import type { ProcedureValidationStatus } from '../types/response';

export type GradeRoundingMode = 'quarter' | 'integer';

export function snapGrade1to10(
  grade: number,
  mode: GradeRoundingMode = 'quarter'
): number {
  const clamped = Math.max(1, Math.min(10, grade));
  if (mode === 'integer') {
    return Math.round(clamped);
  }
  return Math.round(clamped * 4) / 4;
}

/** Calcula la nota en escala del 1 al 10 con redondeo cada 0.25 o al entero más cercano. */
export function computeGrade1to10(
  earnedPoints: number,
  totalPoints: number,
  mode: GradeRoundingMode = 'quarter'
): number {
  if (totalPoints <= 0) return 1;
  const raw = Math.max(1, Math.min(10, (earnedPoints / totalPoints) * 10));
  return snapGrade1to10(raw, mode);
}

/** Formatea una nota 1-10 eliminando ceros decimales innecesarios. */
export function formatGrade1to10(
  grade: number,
  mode: GradeRoundingMode = 'quarter'
): string {
  const snapped = snapGrade1to10(grade, mode);
  if (mode === 'integer') {
    return String(Math.round(snapped));
  }
  return Number(snapped.toFixed(2)).toString();
}

export function getGrade1to10Label(grade: number): string {
  if (grade >= 9) return 'Excelente';
  if (grade >= 8) return 'Muy bueno';
  if (grade >= 7) return 'Bueno';
  if (grade >= 6) return 'Suficiente';
  return 'Insuficiente';
}

/** Cuenta cuántas actividades del examen tienen una respuesta no vacía. */
export function countCompletedActivities(
  questions: Question[],
  answers: Record<string, any> | undefined | null
): number {
  if (!answers) return 0;
  let count = 0;
  for (const q of questions) {
    const val = answers[q.id];
    if (val === undefined || val === null) continue;
    if (Array.isArray(val)) {
      if (val.length > 0) count++;
    } else if (typeof val === 'object') {
      if (Object.values(val).some((v) => String(v ?? '').trim() !== '')) count++;
    } else if (String(val).trim() !== '') {
      count++;
    }
  }
  return count;
}

export interface QuizScore {
  totalPoints: number;
  earnedPoints: number;
  percentage: number;
  results: Array<{
    questionId: string;
    questionTitle: string;
    type: string;
    correctAnswer: string | string[] | null;
    userAnswer: string | string[] | null;
    points: number;
    earned: number;
    isCorrect: boolean;
    requireProcedurePhoto?: boolean;
    procedureStatus?: 'pending' | 'validated' | 'rejected';
  }>;
}

export function scoreQuiz(
  questions: Question[],
  answers: Record<string, string | string[] | null>,
  procedureValidations?: Record<string, ProcedureValidationStatus>
): QuizScore {
  const quizQuestions = questions.filter((q) => q.quizSettings || q.settings?.requireProcedurePhoto);
  let totalPoints = 0;
  let earnedPoints = 0;
  const results: QuizScore['results'] = [];

  for (const q of quizQuestions) {
    const settings = q.quizSettings;
    const userAnswer = answers[q.id] ?? null;
    const correctAnswer = settings?.correctAnswer ?? null;
    const points = settings?.points ?? 1;
    const requireProcedurePhoto = Boolean(q.settings?.requireProcedurePhoto);
    let isCorrect = false;
    let earned = 0;

    if (correctAnswer !== null && correctAnswer !== undefined && userAnswer !== null && userAnswer !== undefined) {
      if (q.type === 'checkbox' && Array.isArray(correctAnswer) && Array.isArray(userAnswer)) {
        const stripLatex = (s: string) => s.replace(/\$\$/g, '').replace(/\$/g, '').replace(/\\[\(\)]/g, '').replace(/\\[\[\]]/g, '');
        const correctSet = new Set(correctAnswer.map(stripLatex));
        const userSet = new Set(userAnswer.map(stripLatex));
        if (correctSet.size === userSet.size && [...correctSet].every((v) => userSet.has(v))) {
          isCorrect = true;
        }
      } else if (q.type === 'linearScale') {
        isCorrect = Number(userAnswer) === Number(correctAnswer);
      } else if (q.type === 'paragraph') {
        const normalize = (s: string) =>
          s.toLowerCase().trim()
            .replace(/\s+/g, ' ')
            .replace(/[.,!¡¿?;:]+$/g, '').replace(/^[.,!¡¿?;:]+/g, '')
            .replace(/\$\$/g, '').replace(/\$/g, '').replace(/\\[\(\)]/g, '').replace(/\\[\[\]]/g, '');
        isCorrect = normalize(String(userAnswer)).includes(normalize(String(correctAnswer)));
      } else {
        const normalize = (s: string) =>
          s.toLowerCase().trim()
            .replace(/\s+/g, ' ')
            .replace(/[.,!¡¿?;:]+$/g, '').replace(/^[.,!¡¿?;:]+/g, '')
            .replace(/\$\$/g, '').replace(/\$/g, '').replace(/\\[\(\)]/g, '').replace(/\\[\[\]]/g, '');
        isCorrect = normalize(String(userAnswer)) === normalize(String(correctAnswer));
      }
    }

    if (isCorrect) {
      earned = points;
    }

    let procedureStatus: 'pending' | 'validated' | 'rejected' | undefined;
    if (requireProcedurePhoto) {
      const validation = procedureValidations?.[q.id];
      if (validation === 'validated') {
        isCorrect = true;
        earned = points;
        procedureStatus = 'validated';
      } else if (validation === 'rejected') {
        isCorrect = false;
        earned = 0;
        procedureStatus = 'rejected';
      } else {
        procedureStatus = 'pending';
      }
    }

    totalPoints += points;
    earnedPoints += earned;

    results.push({
      questionId: q.id,
      questionTitle: q.title || q.type,
      type: q.type,
      correctAnswer,
      userAnswer,
      points,
      earned,
      isCorrect,
      ...(requireProcedurePhoto ? { requireProcedurePhoto: true, procedureStatus } : {}),
    });
  }

  return {
    totalPoints,
    earnedPoints,
    percentage: totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0,
    results,
  };
}
