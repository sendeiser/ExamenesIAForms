import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useEditorStore } from '../store/editorStore';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Toggle } from '../components/ui/Toggle';
import { ThemeEditor } from '../components/forms/ThemeEditor';
import { ShareModal } from '../components/forms/ShareModal';
import { ExamPreviewPanel } from '../components/forms/ExamPreviewPanel';
import { ExamVersionsModal } from '../components/forms/ExamVersionsModal';
import { ExamExportModal } from '../components/forms/ExamExportModal';
import { FormEditor } from '../components/forms/FormEditor';
import {
  ORIGINAL_VERSION_ID,
  filterQuestionsByVersion,
  getFormVersions,
  hasMultipleVersions,
} from '../lib/examVersions';
import { formatExamDateTime } from '../lib/dateUtils';
import {
  Eye,
  BarChart3,
  Share2,
  BugPlay,
  PenLine,
  Columns2,
  ArrowLeft,
  Layers,
  FileDown,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Globe,
  Lock,
} from 'lucide-react';

type BuilderViewMode = 'editor' | 'preview' | 'split';

export default function FormBuilderPage() {
  const { formId } = useParams<{ formId: string }>();
  const [searchParams] = useSearchParams();
  const form = useEditorStore((s) => s.form);
  const allQuestions = useEditorStore((s) => s.allQuestions);
  const questions = useEditorStore((s) => s.questions);
  const activeVersionId = useEditorStore((s) => s.activeVersionId);
  const setActiveVersion = useEditorStore((s) => s.setActiveVersion);
  const renameVersion = useEditorStore((s) => s.renameVersion);
  const deleteVersion = useEditorStore((s) => s.deleteVersion);
  const updateForm = useEditorStore((s) => s.updateForm);
  const loadForm = useEditorStore((s) => s.loadForm);
  const loading = useEditorStore((s) => s.loading);
  const [shareOpen, setShareOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [viewMode, setViewMode] = useState<BuilderViewMode>('editor');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const requestedVersion = searchParams.get('v') ?? undefined;

  useEffect(() => {
    if (formId) loadForm(formId, requestedVersion);
  }, [formId, requestedVersion]);

  if (loading || !form) return <LoadingSpinner />;

  const versions = getFormVersions(form);
  const multiVersion = hasMultipleVersions(form);
  const previewUrl = multiVersion
    ? `${window.location.origin}/view/${form.id}?v=${activeVersionId}&preview=true`
    : `${window.location.origin}/view/${form.id}?preview=true`;
  const testAutoUrl = multiVersion
    ? `${window.location.origin}/view/${form.id}?v=${activeVersionId}&auto=true`
    : `${window.location.origin}/view/${form.id}?auto=true`;
  const totalPoints = questions.reduce((sum, q) => sum + (q.quizSettings?.points ?? 1), 0);

  async function handleSaveRename(versionId: string) {
    if (!renameDraft.trim()) {
      setRenamingId(null);
      return;
    }
    await renameVersion(versionId, renameDraft.trim());
    setRenamingId(null);
  }

  async function handleDeleteVersion(versionId: string, label: string) {
    if (versionId === ORIGINAL_VERSION_ID) return;
    if (!window.confirm(`¿Eliminar la versión "${label}" y sus actividades? Esta acción no se puede deshacer.`)) {
      return;
    }
    await deleteVersion(versionId);
  }

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

          <div className="flex items-center gap-2 font-mono text-[11px] text-ink-subtle flex-wrap">
            <span className="px-2 py-0.5 rounded bg-sand-100 border border-sand-300 text-ink-light">
              Actualizado: {formatExamDateTime(form.updatedAt)}
            </span>
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
            <button
              type="button"
              onClick={() => void updateForm({ published: !form.published })}
              title={
                form.published
                  ? 'Examen publicado — clic para cerrarlo y pasar a borrador'
                  : 'Examen en borrador — clic para publicar y habilitar para alumnos'
              }
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs sm:text-sm font-semibold transition-colors shrink-0 ${
                form.published
                  ? 'border-green-300 bg-green-50 text-state-success hover:bg-green-100'
                  : 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              {form.published ? (
                <>
                  <Globe className="h-4 w-4" />
                  <span>Publicado</span>
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  <span>Borrador · Publicar</span>
                </>
              )}
            </button>
            <div className="px-3 py-1.5 rounded-lg bg-sand-100 border border-sand-300">
              <Toggle
                label="Modo examen"
                checked={form.settings.isQuiz}
                onChange={(checked) => updateForm({ settings: { ...form.settings, isQuiz: checked } })}
              />
            </div>
            <Button variant="secondary" onClick={() => window.open(testAutoUrl, '_blank')} className="shrink-0">
              <BugPlay className="h-4 w-4 text-brand-600" />
              <span className="hidden sm:inline">Test auto</span>
            </Button>
            <Button
              variant="secondary"
              onClick={() => setVersionsOpen(true)}
              className="shrink-0"
              title="Crear dos o más versiones (Temas) del examen"
            >
              <Layers className="h-4 w-4 text-brand-600" />
              <span className="hidden sm:inline">Versiones</span>
            </Button>
            <Button
              variant="secondary"
              onClick={() => setExportOpen(true)}
              className="shrink-0"
              title="Exportar a PDF imprimible o archivo .json"
            >
              <FileDown className="h-4 w-4 text-brand-600" />
              <span className="hidden sm:inline">Exportar</span>
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

        {/* Barra de versiones (Temas) dentro del mismo examen */}
        <div className="border-t border-sand-200 pt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Versiones del examen">
            <span className="inline-flex items-center gap-1 text-[11px] font-mono uppercase tracking-wider text-ink-light mr-1">
              <Layers className="h-3.5 w-3.5 text-brand-600" />
              Temas:
            </span>
            {versions.map((v) => {
              const isActive = v.id === activeVersionId;
              const qCount = filterQuestionsByVersion(allQuestions, v.id).length;

              if (renamingId === v.id) {
                return (
                  <div
                    key={v.id}
                    className="inline-flex items-center gap-1 rounded-lg border border-brand-500 bg-white px-2 py-1"
                  >
                    <input
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleSaveRename(v.id);
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                      autoFocus
                      className="w-32 text-xs font-medium text-ink focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSaveRename(v.id)}
                      className="text-green-600 hover:text-green-700 p-0.5"
                      title="Guardar nombre"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenamingId(null)}
                      className="text-ink-subtle hover:text-ink p-0.5"
                      title="Cancelar"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              }

              return (
                <div
                  key={v.id}
                  className={`inline-flex items-center gap-1 rounded-lg border transition-colors ${
                    isActive
                      ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
                      : 'border-sand-300 bg-sand-50 text-ink hover:bg-sand-100'
                  }`}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveVersion(v.id)}
                    className="px-2.5 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <span>{v.label}</span>
                    <span
                      className={`rounded px-1.5 py-0.2 font-mono text-[10px] ${
                        isActive ? 'bg-white/20 text-white' : 'bg-sand-200 text-ink-subtle'
                      }`}
                    >
                      {qCount}
                    </span>
                  </button>
                  {isActive && (
                    <div className="flex items-center pr-1.5 gap-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setRenamingId(v.id);
                          setRenameDraft(v.label);
                        }}
                        title="Renombrar versión"
                        className="p-1 rounded hover:bg-white/20 text-white/90"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      {v.id !== ORIGINAL_VERSION_ID && (
                        <button
                          type="button"
                          onClick={() => void handleDeleteVersion(v.id, v.label)}
                          title="Eliminar esta versión"
                          className="p-1 rounded hover:bg-red-500/80 text-white/90"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => setVersionsOpen(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-dashed border-brand-400 bg-brand-50/50 hover:bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Nueva versión (Tema)
            </button>
          </div>

          {multiVersion && (
            <span className="text-[11px] text-ink-subtle">
              Todas las versiones comparten la misma planilla de notas.
            </span>
          )}
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

      <ExamVersionsModal
        open={versionsOpen}
        onClose={() => setVersionsOpen(false)}
        sourceFormId={form.id}
        sourceFormTitle={form.title}
        sourceVersionId={activeVersionId}
        onVersionsCreated={(created) => {
          const targetId = created[created.length - 1]?.version.id;
          void loadForm(form.id, targetId);
        }}
        onEditVersion={(versionId) => {
          setActiveVersion(versionId);
        }}
      />

      <ExamExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        formId={form.id}
        formTitle={form.title}
        defaultVersionId={activeVersionId}
      />
    </div>
  );
}
