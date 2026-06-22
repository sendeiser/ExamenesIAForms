import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useEditorStore } from '../store/editorStore';
import { useResponses } from '../hooks/useResponses';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ArrowLeft, BarChart3, List } from 'lucide-react';
import { exportToCsv } from '../utils/export-csv';

export default function AnalyticsPage() {
  const { formId } = useParams<{ formId: string }>();
  const form = useEditorStore((s) => s.form);
  const questions = useEditorStore((s) => s.questions);
  const loadForm = useEditorStore((s) => s.loadForm);
  const { responses, loading } = useResponses(formId!);

  useEffect(() => { if (formId) loadForm(formId); }, [formId]);

  if (loading) return <LoadingSpinner />;

  function handleExport() {
    const headers = ['Fecha', ...questions.map((q) => q.title)];
    const rows = responses.map((r) => [
      r.submittedAt?.toLocaleString() ?? '',
      ...questions.map((q) => String(r.answers[q.id] ?? '')),
    ]);
    exportToCsv(`${form?.title ?? 'respuestas'}.csv`, [headers, ...rows]);
  }

  function getQuestionSummary(questionId: string) {
    const answers = responses.map((r) => r.answers[questionId]).filter((a) => a !== undefined && a !== '');
    const q = questions.find((q) => q.id === questionId);
    if (!q) return null;

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={`/form/${formId}`}>
            <Button variant="ghost"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <h1 className="text-xl font-bold">{form?.title ?? 'Análisis'}</h1>
        </div>
        <Button variant="secondary" onClick={handleExport}>
          <List className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
          <BarChart3 className="h-4 w-4" />
          {responses.length} respuestas
        </div>
      </Card>

      {questions.map((q) => {
        const summary = getQuestionSummary(q.id);
        if (!summary) return null;

        return (
          <Card key={q.id} className="p-6">
            <h3 className="font-semibold text-gray-900 mb-4">{q.title}</h3>

            {summary.type === 'choice' && (
              <div className="space-y-2">
                {summary.options.map((opt) => {
                  const count = summary.counts[opt] ?? 0;
                  const pct = summary.total > 0 ? (count / summary.total) * 100 : 0;
                  return (
                    <div key={opt}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{opt}</span>
                        <span className="text-gray-500">{count} ({Math.round(pct)}%)</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
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
                    <p key={i} className="text-sm bg-gray-50 rounded-lg p-3">{String(a)}</p>
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
