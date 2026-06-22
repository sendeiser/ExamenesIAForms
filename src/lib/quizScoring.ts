import type { Question } from '../types/question';

export interface QuizScore {
  totalPoints: number;
  earnedPoints: number;
  percentage: number;
  results: Array<{
    questionId: string;
    questionTitle: string;
    correctAnswer: string | string[] | null;
    userAnswer: string | string[] | null;
    points: number;
    earned: number;
    isCorrect: boolean;
  }>;
}

export function scoreQuiz(
  questions: Question[],
  answers: Record<string, string | string[] | null>
): QuizScore {
  const quizQuestions = questions.filter((q) => q.quizSettings);
  let totalPoints = 0;
  let earnedPoints = 0;
  const results: QuizScore['results'] = [];

  for (const q of quizQuestions) {
    const settings = q.quizSettings!;
    const userAnswer = answers[q.id] ?? null;
    const correctAnswer = settings.correctAnswer;
    const points = settings.points ?? 1;
    let isCorrect = false;
    let earned = 0;

    if (correctAnswer !== null && correctAnswer !== undefined && userAnswer !== null && userAnswer !== undefined) {
      if (q.type === 'checkbox' && Array.isArray(correctAnswer) && Array.isArray(userAnswer)) {
        const correctSet = new Set(correctAnswer);
        const userSet = new Set(userAnswer);
        if (correctSet.size === userSet.size && [...correctSet].every((v) => userSet.has(v))) {
          isCorrect = true;
        }
      } else if (q.type === 'linearScale') {
        isCorrect = Number(userAnswer) === Number(correctAnswer);
      } else {
        isCorrect = String(userAnswer).toLowerCase().trim() === String(correctAnswer).toLowerCase().trim();
      }
    }

    if (isCorrect) {
      earned = points;
    }
    totalPoints += points;
    earnedPoints += earned;

    results.push({
      questionId: q.id,
      questionTitle: q.title || q.type,
      correctAnswer,
      userAnswer,
      points,
      earned,
      isCorrect,
    });
  }

  return {
    totalPoints,
    earnedPoints,
    percentage: totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0,
    results,
  };
}
