import { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { LatexRenderer } from '../ui/LatexRenderer';
import { CheckCircle2, XCircle, Sparkles, Loader2 } from 'lucide-react';
import type { QuizScore } from '../../lib/quizScoring';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

interface QuizResultProps {
  score: QuizScore;
}

export function QuizResult({ score }: QuizResultProps) {
  const [feedback, setFeedback] = useState<Record<string, string> | null>(null);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');

  const gradeColor = score.percentage >= 70 ? 'text-green-600' : score.percentage >= 50 ? 'text-yellow-600' : 'text-red-600';
  const wrongResults = score.results.filter((r) => !r.isCorrect);
  const hasWrong = wrongResults.length > 0;

  async function handleGetFeedback() {
    setLoadingFeedback(true);
    setFeedbackError('');
    try {
      const result = await callGeminiForFeedback(wrongResults);
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
        <h2 className="text-xl font-bold mb-2">Resultado del examen</h2>
        <div className={`text-5xl font-bold ${gradeColor} my-4`}>{score.percentage}%</div>
        <p className="text-gray-500">{score.earnedPoints} / {score.totalPoints} puntos</p>
      </Card>

      {hasWrong && !feedback && (
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
                  {feedback && feedback[r.questionId] && !r.isCorrect && (
                    <div className="mt-2 p-3 bg-indigo-50 rounded-lg text-xs text-gray-700 leading-relaxed">
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

async function callGeminiForFeedback(
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

  const prompt = `Eres un profesor. Un estudiante respondió un examen y tuvo errores en las siguientes preguntas. Para cada pregunta, da una breve retroalimentación educativa en español que explique por qué su respuesta fue incorrecta y cuál es el concepto correcto.

${questionsText}

Responde ÚNICAMENTE con un array JSON donde cada elemento tenga:
{
  "index": número de pregunta (1-based),
  "feedback": "explicación clara y breve en español (2-3 oraciones)"
}

Sin markdown, sin \`\`\`, sin explicaciones adicionales.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-3.1-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.5, maxOutputTokens: 8192 },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Error de API: ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  const arrayStart = cleaned.indexOf('[');
  const arrayEnd = cleaned.lastIndexOf(']');

  if (arrayEnd === -1 || arrayEnd < arrayStart) {
    throw new Error(`La IA no completó la respuesta (JSON truncado). Respuesta: ${text.slice(0, 600)}`);
  }

  const jsonStr = cleaned.slice(arrayStart, arrayEnd + 1);

  try {
    const items: Array<{ index: number; feedback: string }> = JSON.parse(jsonStr);
    const map: Record<string, string> = {};
    items.forEach((item) => {
      const q = wrongResults[item.index - 1];
      if (q) map[q.questionId] = item.feedback;
    });
    return map;
  } catch {
    throw new Error(`No se pudo procesar la retroalimentación. Respuesta: ${text.slice(0, 600)}`);
  }
}
