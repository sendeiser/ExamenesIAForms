import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useEditorStore } from '../store/editorStore';
import { FormEditor } from '../components/forms/FormEditor';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Toggle } from '../components/ui/Toggle';
import { ThemeEditor } from '../components/forms/ThemeEditor';
import { ShareModal } from '../components/forms/ShareModal';
import { ExamPreviewPanel } from '../components/forms/ExamPreviewPanel';
import { Eye, BarChart3, Share2, BugPlay, PenLine, Columns2, ArrowLeft } from 'lucide-react';

type BuilderViewMode = 'editor' | 'preview' | 'split';

export default function FormBuilderPage() {
  const { formId } = useParams<{ formId: string }>();
  const form = useEditorStore((s) => s.form);
  const questions = useEditorStore((s) => s.questions);
  const updateForm = useEditorStore((s) => s.updateForm);
  const loadForm = useEditorStore((s) => s.loadForm);
  const loading = useEditorStore((s) => s.loading);
  const [shareOpen, setShareOpen] = useState(false);
  const [viewMode, setViewMode] = useState<BuilderViewMode>('editor');

  useEffect(() => {
    if (formId) loadForm(formId);
  }, [formId]);

  if (loading || !form) return <LoadingSpinner />;

  const previewUrl = `${window.location.origin}/view/${form.id}`;
  const totalPoints = questions.reduce((sum, q) => sum + (q.quizSettings?.points ?? 1), 0);

  return (
    <div className="space-y-6 animate-editorial-in">
      <div className="rounded-xl border border-sand-300 bg-white p-4 sm:p-5 shadow-paper space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <nav aria-label="Migas de pan" className="flex items-center gap-2 font-mono text-ink-light">
            <Link to="/" className="inline-flex items-center gap-1 hover:text-brand-600 transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" />
              Mis exámenes
            </Link>
            <span>/</span>
            <span className="text-brand-600 font-semibold">Constructor en vivo</span>
          </nav>

          <div className="flex items-center gap-2 font-mono text-[11px] text-ink-subtle">
            <span className="px-2 py-0.5 rounded bg-sand-100 border border-sand-300">
              {questions.length} {questions.length === 1 ? 'pregunta' : 'preguntas'}
            </span>
            {form.settings.isQuiz && (
              <span className="px-2 py-0.5 rounded bg-brand-50 border border-brand-100 text-brand-700 font-semibold">
                {totalPoints} pts
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <input
            aria-label="Título del examen"
            value={form.title}
            onChange={(e) => updateForm({ title: e.target.value })}
            placeholder="Título del examen"
            className="font-display text-2xl sm:text-3xl font-bold text-ink placeholder:text-ink-light bg-transparent border-0 border-b border-transparent focus:border-brand-600 px-0 py-1 focus:outline-none w-full lg:max-w-xl transition-colors"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <div className="px-3 py-1.5 rounded-lg bg-sand-100 border border-sand-300">
              <Toggle
                label="Modo examen"
                checked={form.settings.isQuiz}
                onChange={(checked) => updateForm({ settings: { ...form.settings, isQuiz: checked } })}
              />
            </div>
            <Button variant="secondary" onClick={() => window.open(`${previewUrl}?auto=true`, '_blank')} className="shrink-0">
              <BugPlay className="h-4 w-4 text-brand-600" />
              <span className="hidden sm:inline">Test auto</span>
            </Button>
            <Button variant="secondary" onClick={() => setShareOpen(true)} className="shrink-0">
              <Share2 className="h-4 w-4" />
              <span className="hidden sm:inline">Compartir</span>
            </Button>
            <Link to={`/form/${form.id}/analytics`} className="shrink-0">
              <Button variant="secondary">
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Respuestas</span>
              </Button>
            </Link>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-sand-200 pt-3 flex-wrap">
          <div
            className="inline-flex rounded-xl border border-sand-300 bg-sand-200/80 p-1"
            role="tablist"
            aria-label="Modo de vista"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'editor'}
              onClick={() => setViewMode('editor')}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-all ${
                viewMode === 'editor'
                  ? 'bg-white text-brand-600 shadow-sm'
                  : 'text-ink-subtle hover:text-ink'
              }`}
            >
              <PenLine className="h-4 w-4" />
              Editor
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'preview'}
              onClick={() => setViewMode('preview')}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-all ${
                viewMode === 'preview'
                  ? 'bg-white text-brand-600 shadow-sm'
                  : 'text-ink-subtle hover:text-ink'
              }`}
            >
              <Eye className="h-4 w-4" />
              Vista previa
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'split'}
              onClick={() => setViewMode('split')}
              className={`hidden lg:inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-all ${
                viewMode === 'split'
                  ? 'bg-white text-brand-600 shadow-sm'
                  : 'text-ink-subtle hover:text-ink'
              }`}
            >
              <Columns2 className="h-4 w-4" />
              Dividido
            </button>
          </div>

          <span className="text-xs text-ink-light hidden sm:inline">
            {viewMode === 'split'
              ? 'Edita a la izquierda y comprueba el examen en vivo a la derecha.'
              : viewMode === 'preview'
                ? 'Simulación interactiva tal como la verá el alumno.'
                : 'Cambia a "Vista previa" o "Dividido" para probar el examen sin salir de esta página.'}
          </span>
        </div>
      </div>

      {viewMode === 'editor' && (
        <div className="space-y-6">
          <ThemeEditor />
          <FormEditor />
        </div>
      )}

      {viewMode === 'preview' && <ExamPreviewPanel previewUrl={previewUrl} />}

      {viewMode === 'split' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 space-y-6 min-w-0">
            <ThemeEditor />
            <FormEditor />
          </div>
          <div className="lg:col-span-5 lg:sticky lg:top-20 min-w-0">
            <ExamPreviewPanel previewUrl={previewUrl} />
          </div>
        </div>
      )}

      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        formId={form.id}
        formTitle={form.title}
      />
    </div>
  );
}
