import { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { LatexRenderer } from '../ui/LatexRenderer';
import { QuestionTableView } from './QuestionTableView';
import {
  CheckCircle2,
  XCircle,
  Sparkles,
  Loader2,
  Clock,
  Camera,
  ZoomIn,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';
import {
  computeGrade1to10,
  formatGrade1to10,
  snapGrade1to10,
  getGrade1to10Label,
  type GradeRoundingMode,
  type QuizScore,
} from '../../lib/quizScoring';
import { callAi, parseJsonArrayFromAi } from '../../lib/aiClient';
import type { Question } from '../../types/question';
import type { FormResponse } from '../../types/response';

interface QuizResultProps {
  score: QuizScore;
  gradeRounding?: GradeRoundingMode;
  questions?: Question[];
  response?: FormResponse | null;
  isQuiz?: boolean;
  onBack?: () => void;
}

export function QuizResult({
  score,
  gradeRounding = 'quarter',
  questions,
  response,
  isQuiz = true,
  onBack,
}: QuizResultProps) {
  const [feedback, setFeedback] = useState<Record<string, string> | null>(null);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');
  const [zoomedPhoto, setZoomedPhoto] = useState<{ src: string; title: string } | null>(null);

  const effectiveEarned =
    response?.scoreOverride !== undefined && response?.scoreOverride !== null
      ? response.scoreOverride
      : score.earnedPoints;
  const effectivePct = score.totalPoints > 0 ? (effectiveEarned / score.totalPoints) * 100 : 0;

  const grade =
    response?.gradeOverride !== undefined && response?.gradeOverride !== null
      ? snapGrade1to10(response.gradeOverride, gradeRounding)
      : computeGrade1to10(effectiveEarned, score.totalPoints, gradeRounding);
  const gradeDisplay = formatGrade1to10(grade, gradeRounding);
  const gradeColor = grade >= 6 ? 'text-green-600' : grade >= 4 ? 'text-yellow-600' : 'text-red-600';

  const wrongResults = score.results.filter((r) => !r.isCorrect);
  const textResults = score.results.filter((r) => r.type === 'text' || r.type === 'paragraph');
  const hasWrong = wrongResults.length > 0;

  const pendingProcedureCount = score.results.filter(
    (r) => r.requireProcedurePhoto && r.procedureStatus === 'pending'
  ).length;
  const totalProcedureCount = score.results.filter((r) => r.requireProcedurePhoto).length;
  const hasManualOverride =
    response?.scoreOverride != null || response?.gradeOverride != null;
  const showNumericGrade = isQuiz || score.totalPoints > 0 || response?.gradeOverride != null;

  const scoreMap = new Map(score.results.map((r) => [r.questionId, r]));
  const questionList: Question[] = questions && questions.length > 0 ? questions : [];

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
      {onBack && (
        <div>
          <Button type="button" variant="secondary" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
            Volver al inicio del examen
          </Button>
        </div>
      )}

      {response && (
        <Card className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-sand-50/70">
          <div className="min-w-0">
            <p className="font-display text-sm font-bold text-ink truncate">
              {response.respondent?.name || 'Estudiante'}
            </p>
            <p className="text-xs text-ink-light truncate">
              {response.respondent?.email || response.respondentEmail || '—'}
            </p>
          </div>
          {response.submittedAt && (
            <span className="text-xs font-mono text-ink-subtle shrink-0">
              Entregado: {response.submittedAt.toLocaleString()}
            </span>
          )}
        </Card>
      )}

      {showNumericGrade ? (
        <Card className="p-6 text-center space-y-3">
          <h2 className="font-display text-xl font-bold text-ink">Resultado del examen</h2>
          <div className={`font-mono text-5xl font-bold ${gradeColor} py-2`}>
            {gradeDisplay} <span className="text-2xl opacity-70">/ 10</span>
          </div>
          <p className="text-sm font-semibold text-ink">
            {getGrade1to10Label(grade)} · {grade >= 6 ? 'Aprobado' : 'Reprobado'}
          </p>
          <p className="font-mono text-xs text-ink-subtle">
            Puntaje: {effectiveEarned} / {score.totalPoints} ({effectivePct.toFixed(1)}%) · Escala 1–10 (
            {gradeRounding === 'integer' ? 'redondeada' : 'cada 0.25'})
          </p>

          {pendingProcedureCount > 0 ? (
            <div className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              <Clock className="h-4 w-4 text-amber-600 shrink-0" />
              <span>
                Pendiente de validación docente ({pendingProcedureCount} actividad
                {pendingProcedureCount === 1 ? '' : 'es'}) — Calificación provisoria
              </span>
            </div>
          ) : (totalProcedureCount > 0 || hasManualOverride) ? (
            <div className="inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-medium text-green-800">
              <ShieldCheck className="h-4 w-4 text-green-600 shrink-0" />
              <span>Examen verificado por el docente — Calificación definitiva</span>
            </div>
          ) : null}
        </Card>
      ) : (
        <Card className="p-6 text-center space-y-2">
          <h2 className="font-display text-xl font-bold text-ink">Examen entregado</h2>
          <p className="text-sm text-ink-subtle">
            Aquí puedes revisar tus respuestas y las fotos de procedimiento enviadas.
          </p>
        </Card>
      )}

      {showNumericGrade && hasWrong && textResults.length > 0 && !feedback && (
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

      {/* Desglose completo de actividades */}
      <div className="space-y-3">
        {questionList.length > 0
          ? questionList.map((q, idx) => {
              const res = scoreMap.get(q.id);
              const rawUserAns = res ? res.userAnswer : response?.answers?.[q.id] ?? null;
              const photos = response?.procedurePhotos?.[q.id] ?? [];
              const procStatus = res?.procedureStatus ?? (q.settings?.requireProcedurePhoto ? 'pending' : undefined);
              const hasAnswer =
                rawUserAns !== null &&
                rawUserAns !== undefined &&
                String(rawUserAns).trim() !== '' &&
                (!Array.isArray(rawUserAns) || rawUserAns.length > 0);

              const borderClass = res
                ? res.isCorrect
                  ? 'border-l-green-500'
                  : 'border-l-red-500'
                : 'border-l-brand-500';

              return (
                <Card key={q.id} className={`p-4 border-l-4 ${borderClass} space-y-2.5`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      {res ? (
                        res.isCorrect ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                        )
                      ) : (
                        <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-50 text-[11px] font-mono font-bold text-brand-700 shrink-0">
                          {idx + 1}
                        </span>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-sm">
                            <LatexRenderer text={q.title || `Actividad ${idx + 1}`} />
                          </p>
                          {procStatus === 'pending' && (
                            <span className="rounded-full bg-amber-100 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                              Pendiente de validación docente
                            </span>
                          )}
                          {procStatus === 'validated' && (
                            <span className="rounded-full bg-green-100 border border-green-200 px-2 py-0.5 text-[10px] font-semibold text-green-800">
                              Procedimiento validado por el docente
                            </span>
                          )}
                          {procStatus === 'rejected' && (
                            <span className="rounded-full bg-red-100 border border-red-200 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                              Procedimiento rechazado (0 pts)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {res && (
                      <span className={`text-sm font-mono shrink-0 ${res.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                        {res.earned}/{res.points}
                      </span>
                    )}
                  </div>

                  {q.settings?.table && (
                    <QuestionTableView table={q.settings.table} value={rawUserAns} readOnly />
                  )}

                  <div className="text-xs text-gray-600 space-y-1">
                    <p>
                      Tu respuesta:{' '}
                      {hasAnswer ? (
                        <span className="font-mono text-ink">
                          <LatexRenderer text={Array.isArray(rawUserAns) ? rawUserAns.join(', ') : String(rawUserAns)} />
                        </span>
                      ) : (
                        <span className="italic text-ink-subtle">Sin responder</span>
                      )}
                    </p>
                    {res && !res.isCorrect && res.correctAnswer !== null && (
                      <p>
                        Respuesta correcta:{' '}
                        <span className="font-mono font-medium text-green-600">
                          <LatexRenderer
                            text={Array.isArray(res.correctAnswer) ? res.correctAnswer.join(', ') : String(res.correctAnswer)}
                          />
                        </span>
                      </p>
                    )}
                  </div>

                  {photos.length > 0 && (
                    <div className="pt-1 space-y-1.5">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-ink-light">
                        <Camera className="h-3.5 w-3.5 text-brand-600" />
                        Fotos de tu procedimiento ({photos.length})
                      </span>
                      <div className="grid grid-cols-3 gap-2">
                        {photos.map((src, pIdx) => (
                          <button
                            key={pIdx}
                            type="button"
                            onClick={() =>
                              setZoomedPhoto({ src, title: `Actividad ${idx + 1} · Foto ${pIdx + 1}` })
                            }
                            className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-sand-300 bg-white hover:border-brand-500"
                          >
                            <img src={src} alt={`Procedimiento ${pIdx + 1}`} className="h-full w-full object-cover" />
                            <span className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-colors">
                              <ZoomIn className="h-4 w-4 text-white opacity-0 group-hover:opacity-100" />
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {feedback && feedback[q.id] && (q.type === 'text' || q.type === 'paragraph') && (
                    <div className="mt-2 p-3 bg-brand-50 border border-brand-100 rounded-lg text-xs text-ink-muted leading-relaxed">
                      {feedback[q.id]}
                    </div>
                  )}
                </Card>
              );
            })
          : score.results.map((r) => (
              <Card key={r.questionId} className={`p-4 border-l-4 ${r.isCorrect ? 'border-l-green-500' : 'border-l-red-500'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    {r.isCorrect ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-sm"><LatexRenderer text={r.questionTitle} /></p>
                        {r.requireProcedurePhoto && r.procedureStatus === 'pending' && (
                          <span className="rounded-full bg-amber-100 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                            Pendiente de validación docente
                          </span>
                        )}
                      </div>
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

      <Modal
        open={zoomedPhoto !== null}
        onClose={() => setZoomedPhoto(null)}
        title={zoomedPhoto?.title ?? 'Foto del procedimiento'}
        size="lg"
        zIndexClass="z-[60]"
      >
        {zoomedPhoto && (
          <div className="space-y-3">
            <img
              src={zoomedPhoto.src}
              alt={zoomedPhoto.title}
              className="w-full max-h-[75vh] object-contain rounded-lg border border-sand-200 bg-sand-50"
            />
            <div className="flex justify-end">
              <Button type="button" variant="secondary" onClick={() => setZoomedPhoto(null)}>
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </Modal>
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
