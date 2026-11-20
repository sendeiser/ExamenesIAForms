import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useEditorStore } from '../store/editorStore';
import { useResponses } from '../hooks/useResponses';
import {
  scoreQuiz,
  computeGrade1to10,
  formatGrade1to10,
  snapGrade1to10,
  countCompletedActivities,
  type GradeRoundingMode,
} from '../lib/quizScoring';
import {
  filterQuestionsByVersion,
  getFormVersions,
  getQuestionsForResponse,
  getVersionLabel,
  hasMultipleVersions,
  normalizeVersionId,
} from '../lib/examVersions';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { LatexRenderer } from '../components/ui/LatexRenderer';
import { toOptionItem } from '../types/question';
import { ArrowLeft, BarChart3, List, GraduationCap, ClipboardList, Layers } from 'lucide-react';
import { exportToCsv } from '../utils/export-csv';

export default function AnalyticsPage() {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const form = useEditorStore((s) => s.form);
  const allQuestions = useEditorStore((s) => s.allQuestions);
  const loadForm = useEditorStore((s) => s.loadForm);
  const { responses, loading } = useResponses(formId!);
  const [versionFilter, setVersionFilter] = useState<'all' | string>('all');

  useEffect(() => {
    setVersionFilter('all');
    if (formId) loadForm(formId);
  }, [formId]);

  const gradeRounding: GradeRoundingMode = form?.settings?.gradeRounding ?? 'quarter';
  const isQuiz = Boolean(form?.settings?.isQuiz);
  const versions = useMemo(() => getFormVersions(form), [form]);
  const multiVersion = hasMultipleVersions(form);

  const summaryRows = useMemo(() => {
    return responses.map((r) => {
      const studentQuestions = getQuestionsForResponse(allQuestions, r);
      const resolvedVersionId = normalizeVersionId(r.versionId ?? studentQuestions[0]?.versionId);
      const versionLabel = getVersionLabel(form, resolvedVersionId, r.versionLabel);
      const completedCount = countCompletedActivities(studentQuestions, r.answers);
      const totalActivities = studentQuestions.length;
      const quizScore = isQuiz
        ? scoreQuiz(studentQuestions, r.answers, r.procedureValidations)
        : null;
      const effectiveEarned = quizScore
        ? (typeof r.scoreOverride === 'number' ? r.scoreOverride : quizScore.earnedPoints)
        : 0;
      const pct = quizScore
        ? (quizScore.totalPoints > 0 ? (effectiveEarned / quizScore.totalPoints) * 100 : 0)
        : (totalActivities > 0 ? (completedCount / totalActivities) * 100 : 0);
      const grade = quizScore
        ? (typeof r.gradeOverride === 'number'
            ? snapGrade1to10(r.gradeOverride, gradeRounding)
            : computeGrade1to10(effectiveEarned, quizScore.totalPoints, gradeRounding))
        : null;
      const correctCount = quizScore
        ? quizScore.results.filter((res) => res.isCorrect).length
        : null;

      return {
        response: r,
        versionId: resolvedVersionId,
        versionLabel,
        completedCount,
        totalActivities,
        correctCount,
        quizTotal: quizScore?.results.length ?? null,
        grade,
        pct,
      };
    });
  }, [responses, allQuestions, form, isQuiz, gradeRounding]);

  const versionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const row of summaryRows) {
      counts[row.versionId] = (counts[row.versionId] ?? 0) + 1;
    }
    return counts;
  }, [summaryRows]);

  const filteredRows = useMemo(() => {
    if (!multiVersion || versionFilter === 'all') return summaryRows;
    return summaryRows.filter((row) => row.versionId === versionFilter);
  }, [summaryRows, multiVersion, versionFilter]);

  const displayedQuestions = useMemo(() => {
    if (!multiVersion || versionFilter === 'all') return allQuestions;
    return filterQuestionsByVersion(allQuestions, versionFilter);
  }, [allQuestions, multiVersion, versionFilter]);

  if (loading) return <LoadingSpinner />;

  function handleExport() {
    if (multiVersion) {
      const headers = ['Fecha', 'Nombre', 'Email', 'Tema', 'Actividades', 'Nota (1-10)', '%'];
      const rows = filteredRows.map((row) => [
        row.response.submittedAt?.toLocaleString('es-ES') ?? '',
        row.response.respondent?.name ?? '',
        row.response.respondent?.email ?? row.response.respondentEmail ?? '',
        row.versionLabel,
        `${row.completedCount}/${row.totalActivities}`,
        row.grade !== null ? formatGrade1to10(row.grade, gradeRounding) : '',
        `${row.pct.toFixed(0)}%`,
      ]);
      exportToCsv(`${form?.title ?? 'respuestas'}.csv`, [headers, ...rows]);
      return;
    }

    const headers = ['Fecha', 'Nombre', 'Email', ...allQuestions.map((q) => q.title)];
    const rows = filteredRows.map(({ response: r }) => [
      r.submittedAt?.toLocaleString('es-ES') ?? '',
      r.respondent?.name ?? '',
      r.respondent?.email ?? r.respondentEmail ?? '',
      ...allQuestions.map((q) => String(r.answers[q.id] ?? '')),
    ]);
    exportToCsv(`${form?.title ?? 'respuestas'}.csv`, [headers, ...rows]);
  }

  function getQuestionSummary(questionId: string) {
    const q = allQuestions.find((item) => item.id === questionId);
    if (!q) return null;
    const qVerId = normalizeVersionId(q.versionId);
    const matchingRows = multiVersion
      ? summaryRows.filter((row) => row.versionId === qVerId)
      : summaryRows;
    const answers = matchingRows
      .map((row) => row.response.answers[questionId])
      .filter((a) => a !== undefined && a !== '');

    if (q.type === 'multipleChoice' || q.type === 'checkbox' || q.type === 'dropdown') {
      const counts: Record<string, number> = {};
      const items = q.type === 'checkbox' ? answers.flat() : answers;
      items.forEach((a: any) => { const key = String(a); counts[key] = (counts[key] ?? 0) + 1; });
      const total = items.length;
      return { type: 'choice' as const, counts, total, options: q.options };
    }

    if (q.type === 'linearScale') {
      const nums = answers.map(Number).filter((n) => !isNaN(n));
      const avg = nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
      return { type: 'scale' as const, avg, min: Math.min(...nums, 0), max: Math.max(...nums, 0), total: nums.length };
    }

    return { type: 'text' as const, answers, total: answers.length };
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link to={`/form/${formId}`}>
            <Button variant="ghost"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <h1 className="font-display text-2xl font-bold text-ink">{form?.title ?? 'Análisis'}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link to={`/form/${formId}/exam-results`}>
            <Button variant="secondary">
              <GraduationCap className="h-4 w-4" />
              <span className="hidden sm:inline">Calificaciones</span>
            </Button>
          </Link>
          <Button variant="secondary" onClick={handleExport}>
            <List className="h-4 w-4" />
            <span className="hidden sm:inline">Exportar CSV</span>
          </Button>
        </div>
      </div>

      {multiVersion && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-xs font-mono uppercase tracking-wider text-ink-light mr-1">
            <Layers className="h-3.5 w-3.5 text-brand-600" />
            Filtrar tema:
          </span>
          <button
            type="button"
            onClick={() => setVersionFilter('all')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors ${
              versionFilter === 'all'
                ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                : 'bg-white text-ink border-sand-300 hover:bg-sand-100'
            }`}
          >
            Todos ({summaryRows.length})
          </button>
          {versions.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setVersionFilter(v.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors ${
                versionFilter === v.id
                  ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                  : 'bg-white text-ink border-sand-300 hover:bg-sand-100'
              }`}
            >
              {v.label} ({versionCounts[v.id] ?? 0})
            </button>
          ))}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-sand-200 bg-sand-50/70 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <ClipboardList className="h-4 w-4 text-brand-600" />
            <h2 className="font-display text-base font-bold text-ink">
              Tabla general de notas ({filteredRows.length})
            </h2>
          </div>
          <Link to={`/form/${formId}/exam-results`}>
            <Button variant="secondary" className="text-xs px-3 py-1.5">
              <GraduationCap className="h-3.5 w-3.5" />
              Ver detalle / Validar procedimientos
            </Button>
          </Link>
        </div>

        {filteredRows.length === 0 ? (
          <div className="p-8 text-center text-sm text-ink-subtle flex flex-col items-center gap-1.5">
            <BarChart3 className="h-5 w-5 text-ink-light" />
            <span>Aún no hay entregas registradas{multiVersion && versionFilter !== 'all' ? ' para esta versión' : ' en este examen'}.</span>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto hidden sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-sand-50 border-b border-sand-200">
                    <th className="text-left px-4 py-3 font-medium text-ink-subtle w-12">N°</th>
                    <th className="text-left px-4 py-3 font-medium text-ink-subtle">Estudiante</th>
                    {multiVersion && (
                      <th className="text-center px-4 py-3 font-medium text-ink-subtle">Tema</th>
                    )}
                    <th className="text-center px-4 py-3 font-medium text-ink-subtle">Actividades</th>
                    <th className="text-center px-4 py-3 font-medium text-ink-subtle">Nota (1–10)</th>
                    <th className="text-center px-4 py-3 font-medium text-ink-subtle">%</th>
                    <th className="text-left px-4 py-3 font-medium text-ink-subtle">Fecha y hora</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, idx) => (
                    <tr
                      key={row.response.id}
                      onClick={() => navigate(`/form/${formId}/exam-results`)}
                      className="border-b border-sand-200/80 hover:bg-brand-50/40 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-ink-light">{idx + 1}</td>
                      <td className="px-4 py-3 font-medium text-ink">
                        {row.response.respondent?.name ||
                          row.response.respondent?.email ||
                          row.response.respondentEmail ||
                          'Sin nombre'}
                      </td>
                      {multiVersion && (
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex rounded-full bg-purple-50 border border-purple-200 px-2 py-0.5 text-[11px] font-mono font-semibold text-purple-800">
                            {row.versionLabel}
                          </span>
                        </td>
                      )}
                      <td className="px-4 py-3 text-center font-mono text-xs text-ink">
                        <span className="font-semibold">
                          {row.completedCount}/{row.totalActivities}
                        </span>
                        {row.correctCount !== null && row.quizTotal !== null && (
                          <span className="text-ink-subtle ml-1.5">
                            ({row.correctCount}/{row.quizTotal} ok)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center font-mono">
                        {row.grade !== null ? (
                          <span
                            className={`font-bold ${
                              row.grade >= 6 ? 'text-brand-700' : 'text-red-600'
                            }`}
                          >
                            {formatGrade1to10(row.grade, gradeRounding)}
                          </span>
                        ) : (
                          <span className="text-ink-light">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-ink">
                        {row.pct.toFixed(0)}%
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-ink-subtle">
                        {row.response.submittedAt
                          ? row.response.submittedAt.toLocaleString('es-ES')
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="sm:hidden divide-y divide-sand-200">
              {filteredRows.map((row, idx) => (
                <div
                  key={row.response.id}
                  onClick={() => navigate(`/form/${formId}/exam-results`)}
                  className="px-4 py-3 space-y-1.5 cursor-pointer hover:bg-brand-50/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                      <span className="font-medium text-sm text-ink truncate">
                        {idx + 1}.{' '}
                        {row.response.respondent?.name ||
                          row.response.respondent?.email ||
                          row.response.respondentEmail ||
                          'Sin nombre'}
                      </span>
                      {multiVersion && (
                        <span className="inline-flex rounded bg-purple-50 border border-purple-200 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-purple-800">
                          {row.versionLabel}
                        </span>
                      )}
                    </div>
                    {row.grade !== null && (
                      <span
                        className={`font-mono text-sm font-bold shrink-0 ${
                          row.grade >= 6 ? 'text-brand-700' : 'text-red-600'
                        }`}
                      >
                        {formatGrade1to10(row.grade, gradeRounding)}/10
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs text-ink-subtle font-mono">
                    <span>
                      Actividades: {row.completedCount}/{row.totalActivities} · {row.pct.toFixed(0)}%
                    </span>
                    <span>
                      {row.response.submittedAt
                        ? row.response.submittedAt.toLocaleString('es-ES')
                        : '—'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {displayedQuestions.map((q) => {
        const summary = getQuestionSummary(q.id);
        if (!summary) return null;

        return (
          <Card key={q.id} className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h3 className="font-semibold text-gray-900"><LatexRenderer text={q.title} /></h3>
              {multiVersion && (
                <span className="rounded bg-purple-50 border border-purple-200 px-2 py-0.5 text-[10px] font-mono font-semibold text-purple-800 shrink-0">
                  {getVersionLabel(form, q.versionId)}
                </span>
              )}
            </div>

            {summary.type === 'choice' && (
              <div className="space-y-2">
                {summary.options.map((opt: any) => {
                  const item = toOptionItem(opt);
                  const count = summary.counts[item.label] ?? 0;
                  const pct = summary.total > 0 ? (count / summary.total) * 100 : 0;
                  return (
                    <div key={item.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span><LatexRenderer text={item.label} /></span>
                        <span className="text-gray-500">{count} ({Math.round(pct)}%)</span>
                      </div>
                      <div className="h-2 bg-sand-200 rounded-full overflow-hidden">
                        <div className="h-full bg-brand-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {summary.type === 'scale' && (
              <div className="space-y-1">
                <p className="text-sm">Promedio: <strong>{summary.avg.toFixed(1)}</strong></p>
                <p className="text-sm">Mín: {summary.min} · Máx: {summary.max}</p>
                <p className="text-sm text-gray-500">{summary.total} respuestas</p>
              </div>
            )}

            {summary.type === 'text' && (
              <div className="space-y-2">
                {summary.answers.length === 0 ? (
                  <p className="text-gray-400 text-sm">Sin respuestas</p>
                ) : (
                  summary.answers.map((a: any, i: number) => (
                    <p key={i} className="text-sm bg-gray-50 rounded-lg p-3"><LatexRenderer text={String(a)} /></p>
                  ))
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
