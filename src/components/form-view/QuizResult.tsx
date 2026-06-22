import { Card } from '../ui/Card';
import { CheckCircle2, XCircle } from 'lucide-react';
import type { QuizScore } from '../../lib/quizScoring';

interface QuizResultProps {
  score: QuizScore;
}

export function QuizResult({ score }: QuizResultProps) {
  const gradeColor = score.percentage >= 70 ? 'text-green-600' : score.percentage >= 50 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="space-y-6">
      <Card className="p-6 text-center">
        <h2 className="text-xl font-bold mb-2">Resultado del examen</h2>
        <div className={`text-5xl font-bold ${gradeColor} my-4`}>
          {score.percentage}%
        </div>
        <p className="text-gray-600">
          {score.earnedPoints} / {score.totalPoints} puntos
        </p>
      </Card>

      <div className="space-y-3">
        {score.results.map((r) => (
          <Card key={r.questionId} className={`p-4 border-l-4 ${r.isCorrect ? 'border-l-green-500' : 'border-l-red-500'}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                {r.isCorrect ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-medium text-sm">{r.questionTitle}</p>
                  <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                    {r.userAnswer !== null && (
                      <p>Tu respuesta: <span className="font-mono">{Array.isArray(r.userAnswer) ? r.userAnswer.join(', ') : String(r.userAnswer)}</span></p>
                    )}
                    {!r.isCorrect && r.correctAnswer !== null && (
                      <p>Respuesta correcta: <span className="font-mono font-medium text-green-600">
                        {Array.isArray(r.correctAnswer) ? r.correctAnswer.join(', ') : String(r.correctAnswer)}
                      </span></p>
                    )}
                  </div>
                </div>
              </div>
              <span className={`text-sm font-mono shrink-0 ${r.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                {r.earned}/{r.points}
              </span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
