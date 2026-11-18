import { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { LatexRenderer } from '../ui/LatexRenderer';
import { CheckCircle2, XCircle, Sparkles, Loader2 } from 'lucide-react';
import {
  computeGrade1to10,
  formatGrade1to10,
  getGrade1to10Label,
  type GradeRoundingMode,
  type QuizScore,
} from '../../lib/quizScoring';
import { callAi, parseJsonArrayFromAi } from '../../lib/aiClient';

interface QuizResultProps {
  score: QuizScore;
  gradeRounding?: GradeRoundingMode;
}

export function QuizResult({ score, gradeRounding = 'quarter' }: QuizResultProps) {
  const [feedback, setFeedback] = useState<Record<string, string> | null>(null);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');

  const grade = computeGrade1to10(score.earnedPoints, score.totalPoints, gradeRounding);
  const gradeDisplay = formatGrade1to10(grade, gradeRounding);
  const gradeColor = grade >= 6 ? 'text-green-600' : grade >= 4 ? 'text-yellow-600' : 'text-red-600';
  const wrongResults = score.results.filter((r) => !r.isCorrect);
  const textResults = score.results.filter((r) => r.type === 'text' || r.type === 'paragraph');
  const hasWrong = wrongResults.length > 0;

  async function handleGetFeedback() {
    setLoadingFeedback(true);
    setFeedbackError('');
    try {
      const result = await callAiForFeedback(textResults);
      setFeedback(result);
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : 'Error al obtener retroalimentación');
    } finally {
      setLoadingFeedback(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 text-center">
        <h2 className="font-display text-xl font-bold text-ink mb-2">Resultado del examen</h2>
        <div className={`font-mono text-5xl font-bold ${gradeColor} my-4`}>
          {gradeDisplay} <span className="text-2xl opacity-70">/ 10</span>
        </div>
        <p className="text-sm font-semibold text-ink mb-1">
          {getGrade1to10Label(grade)} · {grade >= 6 ? 'Aprobado' : 'Reprobado'}
        </p>
        <p className="font-mono text-xs text-ink-subtle">
          Puntaje: {score.earnedPoints} / {score.totalPoints} ({score.percentage.toFixed(1)}%) · Escala 1–10 ({gradeRounding === 'integer' ? 'redondeada' : 'cada 0.25'})
        </p>
      </Card>

      {hasWrong && textResults.length > 0 && !feedback && (
        <div className="text-center">
          <Button onClick={handleGetFeedback} disabled={loadingFeedback}>
            {loadingFeedback ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {loadingFeedback ? 'Generando retroalimentación...' : 'Obtener retroalimentación IA'}
          </Button>
          {feedbackError && <p className="text-sm text-red-500 mt-2">{feedbackError}</p>}
        </div>
      )}

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
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm"><LatexRenderer text={r.questionTitle} /></p>
                  <div className="text-xs text-gray-600 mt-1 space-y-0.5">
                    {r.userAnswer !== null && (
                      <p>Tu respuesta: <span className="font-mono"><LatexRenderer text={Array.isArray(r.userAnswer) ? r.userAnswer.join(', ') : String(r.userAnswer)} /></span></p>
                    )}
                    {!r.isCorrect && r.correctAnswer !== null && (
                      <p>Respuesta correcta: <span className="font-mono font-medium text-green-600">
                        <LatexRenderer text={Array.isArray(r.correctAnswer) ? r.correctAnswer.join(', ') : String(r.correctAnswer)} />
                      </span></p>
                    )}
                  </div>
                  {feedback && feedback[r.questionId] && (r.type === 'text' || r.type === 'paragraph') && (
                    <div className="mt-2 p-3 bg-brand-50 border border-brand-100 rounded-lg text-xs text-ink-muted leading-relaxed">
                      {feedback[r.questionId]}
                    </div>
                  )}
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

async function callAiForFeedback(
  wrongResults: QuizScore['results']
): Promise<Record<string, string>> {
  const questionsText = wrongResults
    .map(
      (r, i) =>
        `Pregunta ${i + 1}: "${r.questionTitle}"
- Tu respuesta: ${Array.isArray(r.userAnswer) ? r.userAnswer.join(', ') : r.userAnswer ?? '(sin responder)'}
- Respuesta correcta: ${Array.isArray(r.correctAnswer) ? r.correctAnswer.join(', ') : r.correctAnswer ?? '(no disponible)'}`
    )
    .join('\n\n');

  const prompt = `Eres un profesor con un tono cercano y alentador. Un estudiante respondió las siguientes preguntas abiertas en un examen. Para cada una, evalúa si su respuesta es correcta o incorrecta y da una breve retroalimentación en español que sea útil, motivadora y con un toque personal. Si la respuesta está bien, felicítalo y explícale por qué es correcta. Si no, explícale con amabilidad en qué se equivocó y cómo mejorarlo.

${questionsText}

Responde ÚNICAMENTE con un array JSON donde cada elemento tenga:
{
  "index": número de pregunta (1-based),
  "feedback": "retroalimentación cálida y educativa en español (2-3 oraciones)"
}

Sin markdown, sin \`\`\`, sin explicaciones adicionales.`;

  const text = await callAi({
    prompt,
    temperature: 0.5,
    maxTokens: 8192,
  });

  const items = parseJsonArrayFromAi<{ index: number; feedback: string }>(text);
  const map: Record<string, string> = {};
  items.forEach((item) => {
    const q = wrongResults[item.index - 1];
    if (q) map[q.questionId] = item.feedback;
  });
  return map;
}
