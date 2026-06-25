import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useEditorStore } from '../store/editorStore';
import { useResponses } from '../hooks/useResponses';
import { scoreQuiz, type QuizScore } from '../lib/quizScoring';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { exportToCsv } from '../utils/export-csv';
import { ArrowLeft, Download, ChevronDown, ChevronRight, CheckCircle2, XCircle, Trash2, Edit3, Save, Printer, X } from 'lucide-react';
import { LatexRenderer } from '../components/ui/LatexRenderer';
import type { FormResponse } from '../types/response';
import type { Question } from '../types/question';

export default function ExamResultsPage() {
  const { formId } = useParams<{ formId: string }>();
  const form = useEditorStore((s) => s.form);
  const questions = useEditorStore((s) => s.questions);
  const loadForm = useEditorStore((s) => s.loadForm);
  const { responses, loading, deleteResponse, updateResponse } = useResponses(formId!);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [editAnswers, setEditAnswers] = useState<Record<string, any>>({});

  useEffect(() => { if (formId) loadForm(formId); }, [formId]);

  const scored = useMemo(() => {
    if (!form?.settings?.isQuiz) return null;
    return responses.map((r) => ({
      response: r,
      score: scoreQuiz(questions, r.answers),
    }));
  }, [responses, questions, form]);

  if (loading) return <LoadingSpinner />;

  const totalRespondents = scored?.length ?? responses.length;
  const avgScore = scored && scored.length > 0
    ? scored.reduce((s, r) => s + r.score.percentage, 0) / scored.length
    : 0;
  const sorted = scored ? [...scored].sort((a, b) => b.score.percentage - a.score.percentage) : [];
  const highest = sorted[0]?.score.percentage ?? 0;
  const lowest = sorted[sorted.length - 1]?.score.percentage ?? 0;
  const passed = scored ? scored.filter((r) => r.score.percentage >= 70).length : 0;
  const passRate = scored && scored.length > 0 ? (passed / scored.length) * 100 : 0;

  function toggleRow(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleExport() {
    if (!form?.settings?.isQuiz || !scored) {
      const headers = ['Nombre', 'Email', 'Fecha', ...questions.map((q) => q.title)];
      const rows = responses.map((r) => [
        r.respondent?.name ?? '',
        r.respondent?.email ?? r.respondentEmail ?? '',
        r.submittedAt?.toLocaleString() ?? '',
        ...questions.map((q) => String(r.answers[q.id] ?? '')),
      ]);
      exportToCsv(`${form?.title ?? 'resultados'}.csv`, [headers, ...rows]);
      return;
    }

    const headers = [
      'Nombre', 'Email', 'Puntaje', 'Total', 'Porcentaje', 'Aprobado',
      ...questions.flatMap((q) => [
        `${q.title} (respuesta)`,
        `${q.title} (correcta)`,
        `${q.title} (puntos)`,
      ]),
    ];

    const rows = scored.map(({ response: r, score: s }) => [
      r.respondent?.name ?? '',
      r.respondent?.email ?? r.respondentEmail ?? '',
      String(s.earnedPoints),
      String(s.totalPoints),
      `${s.percentage}%`,
      s.percentage >= 70 ? 'Sí' : 'No',
      ...s.results.flatMap((res) => [
        Array.isArray(res.userAnswer) ? res.userAnswer.join('; ') : String(res.userAnswer ?? ''),
        Array.isArray(res.correctAnswer) ? res.correctAnswer.join('; ') : String(res.correctAnswer ?? ''),
        `${res.earned}/${res.points}`,
      ]),
    ]);

    exportToCsv(`${form?.title ?? 'resultados'}_calificaciones.csv`, [headers, ...rows]);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteResponse(deleteTarget);
    setDeleteTarget(null);
  }

  function startEdit(r: FormResponse) {
    setEditTarget(r.id);
    setEditAnswers({ ...r.answers });
  }

  function cancelEdit() {
    setEditTarget(null);
    setEditAnswers({});
  }

  async function saveEdit() {
    if (!editTarget) return;
    await updateResponse(editTarget, { answers: editAnswers });
    setEditTarget(null);
    setEditAnswers({});
  }

  function renderAnswerInput(q: Question, value: any, onChange: (v: any) => void) {
    switch (q.type) {
      case 'text':
      case 'paragraph':
        return (
          <input
            type="text"
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            className="w-full text-xs border rounded px-2 py-1"
          />
        );
      case 'multipleChoice':
        return (
          <select value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} className="text-xs border rounded px-2 py-1">
            <option value="">—</option>
            {(q.options ?? []).map((opt, i) => (
              <option key={i} value={opt}>{opt}</option>
            ))}
          </select>
        );
      case 'checkbox': {
        const selected: string[] = Array.isArray(value) ? value : [];
        return (
          <div className="flex flex-wrap gap-1">
            {(q.options ?? []).map((opt, i) => {
              const checked = selected.includes(opt);
              return (
                <label key={i} className="flex items-center gap-1 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const next = selected.includes(opt)
                        ? selected.filter((s) => s !== opt)
                        : [...selected, opt];
                      onChange(next);
                    }}
                  />
                  {opt}
                </label>
              );
            })}
          </div>
        );
      }
      case 'dropdown':
        return (
          <select value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} className="text-xs border rounded px-2 py-1">
            <option value="">—</option>
            {(q.options ?? []).map((opt, i) => (
              <option key={i} value={opt}>{opt}</option>
            ))}
          </select>
        );
      default:
        return <span className="text-xs text-gray-400">{String(value ?? '')}</span>;
    }
  }

  function renderAnswerReadonly(q: Question, value: any) {
    if (Array.isArray(value)) return value.join(', ');
    return String(value ?? '—');
  }

  return (
    <div className="space-y-6 print:space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Link to={`/form/${formId}/analytics`}>
            <Button variant="ghost"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <h1 className="text-xl font-bold">{form?.title ?? 'Resultados'} — Informe</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Exportar PDF
          </Button>
          <Button variant="secondary" onClick={handleExport}>
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* ── Header visible in print ── */}
      <div className="hidden print:block">
        <h1 className="text-xl font-bold">{form?.title ?? 'Resultados'} — Informe</h1>
        <p className="text-xs text-gray-500">Generado el {new Date().toLocaleString()}</p>
      </div>

      {/* ── Stats cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 print:grid-cols-5 print:gap-2">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{totalRespondents}</p>
          <p className="text-xs text-gray-500">Total estudiantes</p>
        </Card>
        {scored && (
          <>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-indigo-600">{avgScore.toFixed(1)}%</p>
              <p className="text-xs text-gray-500">Promedio</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{highest.toFixed(0)}%</p>
              <p className="text-xs text-gray-500">Nota más alta</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{lowest.toFixed(0)}%</p>
              <p className="text-xs text-gray-500">Nota más baja</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{passRate.toFixed(0)}%</p>
              <p className="text-xs text-gray-500">Tasa de aprobación</p>
            </Card>
          </>
        )}
      </div>

      {/* ── Responses table ── */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-8 print:hidden" />
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                {scored && (
                  <>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Puntaje</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">%</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Aprobado</th>
                  </>
                )}
                <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-24 print:hidden">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {(scored ?? responses).map((item: any) => {
                const r: FormResponse = scored ? (item as typeof scored[0]).response : item;
                const s: QuizScore | null = scored ? (item as typeof scored[0]).score : null;
                const expanded = expandedRows.has(r.id);
                const editing = editTarget === r.id;
                const currentAnswers = editing ? editAnswers : r.answers;

                return (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    {/* Expand toggle */}
                    <td className="px-4 py-3 text-gray-400 print:hidden">
                      {s && (
                        <button onClick={() => toggleRow(r.id)} className="p-1">
                          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">{r.respondent?.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{r.respondent?.email || r.respondentEmail || '—'}</td>
                    {s && (
                      <>
                        <td className="px-4 py-3 text-center">{s.earnedPoints}/{s.totalPoints}</td>
                        <td className="px-4 py-3 text-center font-mono">{s.percentage}%</td>
                        <td className="px-4 py-3 text-center">
                          {s.percentage >= 70 ? (
                            <span className="text-green-600 font-medium">Aprobado</span>
                          ) : (
                            <span className="text-red-600 font-medium">Reprobado</span>
                          )}
                        </td>
                      </>
                    )}
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {r.submittedAt?.toLocaleString() ?? ''}
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3 print:hidden">
                      <div className="flex items-center gap-1">
                        {editing ? (
                          <>
                            <button onClick={saveEdit} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Guardar">
                              <Save className="h-4 w-4" />
                            </button>
                            <button onClick={cancelEdit} className="p-1 text-gray-400 hover:bg-gray-100 rounded" title="Cancelar">
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(r)} className="p-1 text-indigo-600 hover:bg-indigo-50 rounded" title="Editar respuestas">
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button onClick={() => setDeleteTarget(r.id)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Eliminar">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {responses.length === 0 && (
          <div className="text-center py-12 text-gray-400">Sin respuestas aún</div>
        )}
      </Card>

      {/* ── Expandable quiz detail ── */}
      {scored?.map(({ response: r, score: s }) => {
        if (!expandedRows.has(r.id)) return null;
        const editing = editTarget === r.id;
        const currentAnswers = editing ? editAnswers : r.answers;

        return (
          <Card key={`${r.id}-detail`} className="p-6 print:break-inside-avoid">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4">
              Detalle — {r.respondent?.name || '—'}
            </p>
            <div className="space-y-3">
              {s.results.map((res) => {
                const q = questions.find((qq) => qq.id === res.questionId);
                return (
                  <div key={res.questionId} className="flex items-start gap-3 py-2 border-b border-gray-200 last:border-0">
                    {res.isCorrect ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium"><LatexRenderer text={res.questionTitle} /></p>
                      <div className="text-xs text-gray-500 mt-0.5 space-y-1">
                        {editing && q ? (
                          <div className="mt-1">
                            <span className="text-gray-400 text-[10px] block mb-1">Editar respuesta:</span>
                            {renderAnswerInput(q, currentAnswers[q.id], (v) =>
                              setEditAnswers((prev) => ({ ...prev, [q.id]: v })),
                            )}
                          </div>
                        ) : (
                          <span>
                            Respuesta:{' '}
                            <span className="font-mono">
                              <LatexRenderer text={q ? renderAnswerReadonly(q, r.answers[q.id]) : String(r.answers[res.questionId] ?? '')} />
                            </span>
                          </span>
                        )}
                        {!res.isCorrect && res.correctAnswer !== null && (
                          <br />
                        )}
                        {!res.isCorrect && res.correctAnswer !== null && (
                          <span>
                            Correcta:{' '}
                            <span className="font-mono text-green-600">
                              <LatexRenderer text={Array.isArray(res.correctAnswer) ? res.correctAnswer.join(', ') : String(res.correctAnswer)} />
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`text-xs font-mono shrink-0 ${res.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                      {res.earned}/{res.points}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}

      {/* ── Non-quiz expanded detail ── */}
      {!scored && responses.map((r) => {
        if (!expandedRows.has(r.id)) return null;
        const editing = editTarget === r.id;
        const currentAnswers = editing ? editAnswers : r.answers;

        return (
          <Card key={`${r.id}-detail`} className="p-6 print:break-inside-avoid">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4">
              Detalle — {r.respondent?.name || '—'}
            </p>
            <div className="space-y-2">
              {questions.map((q) => (
                <div key={q.id} className="py-1 border-b border-gray-100 last:border-0">
                  <p className="text-xs font-medium"><LatexRenderer text={q.title} /></p>
                  {editing ? (
                    <div className="mt-1">
                      {renderAnswerInput(q, currentAnswers[q.id], (v) =>
                        setEditAnswers((prev) => ({ ...prev, [q.id]: v })),
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 mt-0.5 font-mono">
                      <LatexRenderer text={renderAnswerReadonly(q, r.answers[q.id])} />
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        );
      })}

      {/* ── Non-quiz hint ── */}
      {!scored && (
        <Card className="p-6 text-center text-gray-600 text-sm print:hidden">
          Este formulario no tiene modo examen activado. Los resultados muestran solo las respuestas sin calificación.
          <br />
          <Link to={`/form/${formId}`} className="text-indigo-600 hover:underline">Activar modo examen en el editor</Link>
        </Card>
      )}

      {/* ── Delete confirmation modal ── */}
      <Modal open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} title="Eliminar respuesta" size="sm">
        <p className="text-sm text-gray-600 mb-4">¿Estás seguro de eliminar esta respuesta? Esta acción no se puede deshacer.</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
          <Button onClick={handleDelete} className="!bg-red-600 hover:!bg-red-700">Eliminar</Button>
        </div>
      </Modal>
    </div>
  );
}
