import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useForms } from '../hooks/useForms';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { AiStatusBar } from '../components/forms/AiStatusBar';
import { ExamVersionsModal } from '../components/forms/ExamVersionsModal';
import { ExamExportModal } from '../components/forms/ExamExportModal';
import {
  importExamFromJsonPayload,
  replicateExamWithOptionalAi,
  type VariationMode,
} from '../lib/examPrintAndExport';
import {
  Plus,
  FileText,
  Trash2,
  Eye,
  EyeOff,
  BarChart3,
  Copy,
  Search,
  FolderOpen,
  CheckCircle2,
  FileEdit,
  ShieldCheck,
  GraduationCap,
  Layers,
  FileDown,
  Upload,
  Loader2,
} from 'lucide-react';

type FilterTab = 'all' | 'published' | 'draft';
type CreateExamMode = 'blank' | 'replicate' | 'import';

export default function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { forms, loading, createForm, deleteForm, togglePublish, duplicateForm, fetchForms } = useForms();
  const [showCreate, setShowCreate] = useState(false);
  const [createMode, setCreateMode] = useState<CreateExamMode>('blank');
  const [title, setTitle] = useState('');
  const [templateFormId, setTemplateFormId] = useState('');
  const [replicateVariation, setReplicateVariation] = useState<VariationMode>('exact');
  const [replicateAiInstruction, setReplicateAiInstruction] = useState('');
  const [importPayload, setImportPayload] = useState<any | null>(null);
  const [importFileName, setImportFileName] = useState('');
  const [creatingExam, setCreatingExam] = useState(false);
  const [createError, setCreateError] = useState('');
  const importInputRef = useRef<HTMLInputElement>(null);

  const [versionsTarget, setVersionsTarget] = useState<{ id: string; title: string } | null>(null);
  const [exportTarget, setExportTarget] = useState<{ id: string; title: string } | null>(null);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterTab>('all');

  const stats = useMemo(() => {
    const total = forms.length;
    const published = forms.filter((f) => f.published).length;
    const drafts = total - published;
    return { total, published, drafts };
  }, [forms]);

  const filteredForms = useMemo(() => {
    const q = search.trim().toLowerCase();
    return forms.filter((f) => {
      if (filter === 'published' && !f.published) return false;
      if (filter === 'draft' && f.published) return false;
      if (q && !f.title.toLowerCase().includes(q) && !(f.description ?? '').toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [forms, filter, search]);

  const openCreateModal = (initialMode: CreateExamMode = 'blank') => {
    setCreateMode(initialMode);
    setCreateError('');
    setTitle('');
    setReplicateVariation('exact');
    setReplicateAiInstruction('');
    setImportPayload(null);
    setImportFileName('');
    const defaultSource = forms[0];
    setTemplateFormId(defaultSource?.id ?? '');
    if (initialMode === 'replicate' && defaultSource) {
      setTitle(`${defaultSource.title} (nuevo)`);
    }
    setShowCreate(true);
  };

  const handleSelectTemplate = (nextId: string) => {
    setTemplateFormId(nextId);
    const chosen = forms.find((f) => f.id === nextId);
    if (chosen && (!title.trim() || forms.some((f) => `${f.title} (nuevo)` === title))) {
      setTitle(`${chosen.title} (nuevo)`);
    }
  };

  const handleImportFileChange = async (file: File | undefined | null) => {
    if (!file) return;
    setCreateError('');
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || !parsed.form || !Array.isArray(parsed.questions)) {
        throw new Error('El archivo seleccionado no es un examen válido (.examen.json).');
      }
      setImportPayload(parsed);
      setImportFileName(file.name);
      if (!title.trim()) {
        setTitle(String(parsed.form.title || 'Examen importado'));
      }
    } catch (err) {
      setImportPayload(null);
      setImportFileName('');
      setCreateError(
        err instanceof Error ? err.message : 'No se pudo leer el archivo .json del examen.'
      );
    }
  };

  const handleCreate = async () => {
    if (!user || !title.trim() || creatingExam) return;
    setCreatingExam(true);
    setCreateError('');
    try {
      let id = '';
      if (createMode === 'blank') {
        id = await createForm(user.uid, title.trim());
      } else if (createMode === 'replicate') {
        const sourceId = templateFormId || forms[0]?.id;
        if (!sourceId) {
          throw new Error('Selecciona un examen existente para replicar.');
        }
        const created = await replicateExamWithOptionalAi({
          sourceFormId: sourceId,
          ownerId: user.uid,
          newTitle: title.trim(),
          variationMode: replicateVariation,
          aiInstruction: replicateAiInstruction,
          versionLabel: title.trim(),
        });
        id = created.id;
      } else {
        if (!importPayload) {
          throw new Error('Selecciona primero un archivo .json de examen.');
        }
        id = await importExamFromJsonPayload(user.uid, importPayload, title.trim());
      }
      setTitle('');
      setShowCreate(false);
      navigate(`/form/${id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'No se pudo crear el examen.');
    } finally {
      setCreatingExam(false);
    }
  };

  const handleDuplicate = async (formId: string) => {
    if (!user) return;
    const newId = await duplicateForm(formId);
    navigate(`/form/${newId}`);
  };

  if (loading) return <LoadingSpinner />;

  const pubRatio = stats.total > 0 ? Math.round((stats.published / stats.total) * 100) : 0;
  const draftRatio = stats.total > 0 ? Math.round((stats.drafts / stats.total) * 100) : 0;

  return (
    <div className="space-y-8 animate-editorial-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-ink-light">
            <span className="px-2 py-0.5 rounded bg-sand-200 text-ink-subtle">Gestión académica</span>
            <span>·</span>
            <span>Espacio docente</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-ink tracking-tight">
            Mis exámenes
          </h1>
          <p className="text-sm sm:text-base text-ink-subtle max-w-2xl">
            Crea, organiza, previsualiza y califica evaluaciones en minutos con asistencia de IA.
          </p>
        </div>
        <Button onClick={() => openCreateModal('blank')} className="w-full sm:w-auto justify-center px-5 py-2.5">
          <Plus className="h-4 w-4" />
          Nuevo formulario
        </Button>
      </div>

      {/* Editorial summary strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-ink-light">
              Total de exámenes
            </span>
            <span className="w-8 h-8 rounded-lg bg-sand-100 border border-sand-300 flex items-center justify-center text-brand-600">
              <FolderOpen className="h-4 w-4" />
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-3xl font-bold text-ink tracking-tight">
              {String(stats.total).padStart(2, '0')}
            </span>
            <span className="text-xs font-mono text-ink-light">En biblioteca</span>
          </div>
          <div className="h-1 w-full bg-sand-200 rounded-full overflow-hidden">
            <div className="h-full bg-brand-600 rounded-full" style={{ width: stats.total > 0 ? '100%' : '0%' }} />
          </div>
        </Card>

        <Card className="p-5 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-ink-light">
              Publicados
            </span>
            <span className="w-8 h-8 rounded-lg bg-green-50 border border-green-200 flex items-center justify-center text-state-success">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-3xl font-bold text-ink tracking-tight">
              {String(stats.published).padStart(2, '0')}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-mono text-state-success bg-green-50 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-state-success" />
              Activos
            </span>
          </div>
          <div className="h-1 w-full bg-sand-200 rounded-full overflow-hidden">
            <div className="h-full bg-state-success rounded-full transition-all" style={{ width: `${pubRatio}%` }} />
          </div>
        </Card>

        <Card className="p-5 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-ink-light">
              Borradores
            </span>
            <span className="w-8 h-8 rounded-lg bg-terracotta-50 border border-terracotta-200 flex items-center justify-center text-terracotta-600">
              <FileEdit className="h-4 w-4" />
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-3xl font-bold text-ink tracking-tight">
              {String(stats.drafts).padStart(2, '0')}
            </span>
            <span className="text-xs font-mono text-ink-light">En edición</span>
          </div>
          <div className="h-1 w-full bg-sand-200 rounded-full overflow-hidden">
            <div className="h-full bg-terracotta-500 rounded-full transition-all" style={{ width: `${draftRatio}%` }} />
          </div>
        </Card>
      </div>

      {/* Search & Filter bar */}
      {forms.length > 0 && (
        <Card className="p-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-ink-light absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar exámenes por título o descripción..."
              className="w-full rounded-lg bg-sand-100/70 hover:bg-sand-100 focus:bg-white border border-transparent focus:border-brand-600 pl-9 pr-3 py-2 text-sm text-ink placeholder:text-ink-light focus:outline-none transition-colors"
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {([
              { id: 'all', label: `Todos (${stats.total})` },
              { id: 'published', label: `Publicados (${stats.published})` },
              { id: 'draft', label: `Borradores (${stats.drafts})` },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-colors ${
                  filter === tab.id
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-ink-subtle hover:text-ink hover:bg-sand-200/70'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </Card>
      )}

      {forms.length === 0 ? (
        <Card className="p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-brand-50 border border-brand-100 text-brand-600 flex items-center justify-center mx-auto">
            <FileText className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h3 className="font-display text-xl font-bold text-ink">No tienes exámenes aún</h3>
            <p className="text-sm text-ink-subtle">Crea tu primer examen o formulario para empezar a evaluar</p>
          </div>
          <Button onClick={() => openCreateModal('blank')}>
            <Plus className="h-4 w-4" />
            Crear formulario
          </Button>
        </Card>
      ) : filteredForms.length === 0 ? (
        <Card className="p-10 text-center space-y-2">
          <p className="font-display text-lg font-semibold text-ink">Sin coincidencias</p>
          <p className="text-sm text-ink-subtle">No se encontraron exámenes con ese criterio de búsqueda o filtro.</p>
        </Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredForms.map((form) => (
            <Card
              key={form.id}
              className="p-5 card-hover cursor-pointer flex flex-col justify-between gap-4"
              onClick={() => navigate(`/form/${form.id}`)}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                      form.published
                        ? 'bg-green-50 text-state-success border border-green-200'
                        : 'bg-sand-100 text-ink-subtle border border-sand-300'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        form.published ? 'bg-state-success' : 'bg-ink-light'
                      }`}
                    />
                    {form.published ? 'Publicado' : 'Borrador'}
                  </span>

                  <div className="flex items-center gap-1.5">
                    {form.versions && form.versions.length > 1 && (
                      <span
                        className="inline-flex items-center gap-1 rounded bg-purple-50 border border-purple-200 px-1.5 py-0.5 text-[10px] font-mono font-medium text-purple-700"
                        title="Versiones (Temas) dentro de este examen"
                      >
                        <Layers className="h-3 w-3" />
                        {form.versions.length} temas
                      </span>
                    )}
                    {form.settings?.isQuiz && (
                      <span
                        className="inline-flex items-center gap-1 rounded bg-brand-50 border border-brand-100 px-1.5 py-0.5 text-[10px] font-mono font-medium text-brand-700"
                        title="Modo examen con calificación"
                      >
                        <GraduationCap className="h-3 w-3" />
                        Quiz
                      </span>
                    )}
                    {form.settings?.securityEnabled && (
                      <span
                        className="inline-flex items-center rounded bg-amber-50 border border-amber-200 p-1 text-amber-700"
                        title="Modo seguro activado"
                      >
                        <ShieldCheck className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-display text-lg font-bold text-ink line-clamp-2 leading-snug">
                    {form.title}
                  </h3>
                  {form.description && (
                    <p className="text-xs text-ink-subtle mt-1 line-clamp-2">{form.description}</p>
                  )}
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-[11px] font-mono text-ink-light bg-sand-50 border border-sand-200 rounded-lg px-2.5 py-1.5">
                  <span>Actualizado</span>
                  <span>{new Date(form.updatedAt).toLocaleDateString('es-ES')}</span>
                </div>

                <div
                  className="flex items-center justify-between pt-2 border-t border-sand-200"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="ghost"
                    onClick={() => togglePublish(form.id, !form.published)}
                    className="p-1.5"
                    title={form.published ? 'Pasar a borrador' : 'Publicar examen'}
                  >
                    {form.published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => navigate(`/form/${form.id}/analytics`)}
                    className="p-1.5"
                    title="Ver tabla de notas y analíticas"
                  >
                    <BarChart3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setVersionsTarget({ id: form.id, title: form.title })}
                    className="p-1.5"
                    title="Crear 2 o más versiones (Temas)"
                  >
                    <Layers className="h-4 w-4 text-brand-600" />
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setExportTarget({ id: form.id, title: form.title })}
                    className="p-1.5"
                    title="Exportar examen (PDF o JSON)"
                  >
                    <FileDown className="h-4 w-4 text-brand-600" />
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => handleDuplicate(form.id)}
                    className="p-1.5"
                    title="Duplicar examen"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => deleteForm(form.id)}
                    className="p-1.5 hover:bg-red-50"
                    title="Eliminar examen"
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}

          <button
            type="button"
            onClick={() => openCreateModal('blank')}
            className="min-h-[210px] rounded-xl border-2 border-dashed border-sand-400 bg-sand-50/50 hover:bg-white hover:border-brand-400 p-6 flex flex-col items-center justify-center gap-3 text-center transition-all group"
          >
            <span className="w-11 h-11 rounded-full bg-brand-50 text-brand-600 border border-brand-100 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Plus className="h-5 w-5" />
            </span>
            <div className="space-y-1">
              <p className="font-display font-bold text-ink">Crear nuevo examen</p>
              <p className="text-xs text-ink-light max-w-[200px]">
                Diseña desde cero, replica un examen existente o importa un archivo
              </p>
            </div>
          </button>
        </div>
      )}

      <Modal
        open={showCreate}
        onClose={() => {
          if (!creatingExam) setShowCreate(false);
        }}
        title="Nuevo examen o formulario"
        size="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-sand-100 border border-sand-200 p-1">
            {([
              { id: 'blank' as CreateExamMode, label: 'En blanco' },
              { id: 'replicate' as CreateExamMode, label: 'Replicar existente' },
              { id: 'import' as CreateExamMode, label: 'Importar (.json)' },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                type="button"
                disabled={creatingExam}
                onClick={() => {
                  setCreateMode(tab.id);
                  setCreateError('');
                  if (tab.id === 'replicate') {
                    const source = forms.find((f) => f.id === templateFormId) ?? forms[0];
                    if (source) {
                      setTemplateFormId(source.id);
                      if (!title.trim()) setTitle(`${source.title} (nuevo)`);
                    }
                  }
                }}
                className={`rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors ${
                  createMode === tab.id
                    ? 'bg-white text-brand-700 shadow-sm'
                    : 'text-ink-subtle hover:text-ink'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {createMode === 'replicate' && (
            <div className="space-y-3">
              {forms.length === 0 ? (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Todavía no tienes exámenes guardados para replicar. Crea uno en blanco o importa un archivo .json.
                </p>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-ink-light mb-1">
                      Examen base a replicar
                    </label>
                    <select
                      value={templateFormId || forms[0]?.id || ''}
                      disabled={creatingExam}
                      onChange={(e) => handleSelectTemplate(e.target.value)}
                      className="w-full rounded-lg border border-sand-300 bg-white px-3 py-2 text-sm text-ink focus:border-brand-600 focus:outline-none"
                    >
                      {forms.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.title} ({f.published ? 'Publicado' : 'Borrador'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink-light mb-1">
                      ¿Cómo replicarlo?
                    </label>
                    <select
                      value={replicateVariation}
                      disabled={creatingExam}
                      onChange={(e) => setReplicateVariation(e.target.value as VariationMode)}
                      className="w-full rounded-lg border border-sand-300 bg-white px-3 py-2 text-xs text-ink focus:border-brand-600 focus:outline-none"
                    >
                      <option value="exact">Copia exacta (mismas preguntas y configuración)</option>
                      <option value="ai">Con IA: variar datos/números manteniendo dificultad</option>
                      <option value="ai_shuffle">Con IA: variar datos + mezclar orden</option>
                      <option value="shuffle">Mezclar orden de preguntas y opciones (sin IA)</option>
                    </select>
                  </div>

                  {(replicateVariation === 'ai' || replicateVariation === 'ai_shuffle') && (
                    <div className="space-y-2">
                      <AiStatusBar />
                      <Input
                        label="Indicación para adaptar el examen (opcional)"
                        placeholder="Ej: Cambia los números pero mantén los mismos temas"
                        value={replicateAiInstruction}
                        disabled={creatingExam}
                        onChange={(e) => setReplicateAiInstruction(e.target.value)}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {createMode === 'import' && (
            <div className="space-y-2.5">
              <input
                ref={importInputRef}
                type="file"
                accept=".json,application/json"
                onChange={(e) => handleImportFileChange(e.target.files?.[0])}
                className="hidden"
              />
              <button
                type="button"
                disabled={creatingExam}
                onClick={() => importInputRef.current?.click()}
                className="w-full rounded-xl border-2 border-dashed border-sand-300 hover:border-brand-500 bg-sand-50/70 hover:bg-white p-4 text-center transition-colors flex flex-col items-center gap-1.5"
              >
                <Upload className="h-5 w-5 text-brand-600" />
                <span className="text-xs font-semibold text-ink">
                  {importFileName || 'Seleccionar archivo .examen.json'}
                </span>
                <span className="text-[11px] text-ink-subtle">
                  Carga un examen exportado previamente desde la app
                </span>
              </button>
              {importPayload && (
                <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  Archivo válido: <strong>{importPayload.questions?.length ?? 0}</strong> actividades listas para importar.
                </p>
              )}
            </div>
          )}

          <Input
            label="Título del nuevo examen"
            placeholder="Ej: Parcial de Física II — Termodinámica"
            value={title}
            disabled={creatingExam}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            autoFocus
          />

          {createError && <p className="text-xs text-red-600 font-medium">{createError}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <Button variant="secondary" onClick={() => setShowCreate(false)} disabled={creatingExam}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={
                creatingExam ||
                !title.trim() ||
                (createMode === 'replicate' && forms.length === 0) ||
                (createMode === 'import' && !importPayload)
              }
            >
              {creatingExam && <Loader2 className="h-4 w-4 animate-spin" />}
              {creatingExam
                ? 'Creando...'
                : createMode === 'replicate'
                  ? 'Replicar examen'
                  : createMode === 'import'
                    ? 'Importar examen'
                    : 'Crear examen'}
            </Button>
          </div>
        </div>
      </Modal>

      <ExamVersionsModal
        open={versionsTarget !== null}
        onClose={() => setVersionsTarget(null)}
        sourceFormId={versionsTarget?.id ?? ''}
        sourceFormTitle={versionsTarget?.title ?? ''}
        onVersionsCreated={() => {
          if (user) void fetchForms(user.uid);
        }}
      />

      <ExamExportModal
        open={exportTarget !== null}
        onClose={() => setExportTarget(null)}
        formId={exportTarget?.id ?? ''}
        formTitle={exportTarget?.title ?? ''}
      />
    </div>
  );
}
