import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { AiStatusBar } from './AiStatusBar';
import {
  ORIGINAL_VERSION_ID,
  getFormVersions,
  getVersionDirectCode,
} from '../../lib/examVersions';
import {
  addExamVersionInPlace,
  generateExamPaperPdf,
  type VariationMode,
} from '../../lib/examPrintAndExport';
import type { FormVersion } from '../../types/form';
import {
  Check,
  Copy,
  ExternalLink,
  FileDown,
  Layers,
  Loader2,
  Shuffle,
  Sparkles,
} from 'lucide-react';

interface ExamVersionsModalProps {
  open: boolean;
  onClose: () => void;
  sourceFormId: string;
  sourceFormTitle: string;
  sourceVersionId?: string;
  onVersionsCreated?: (
    created: Array<{ version: FormVersion; questionCount: number }>
  ) => void;
  onEditVersion?: (versionId: string) => void;
}

type NamingScheme = 'tema_num' | 'tema_alpha' | 'version_num';

function getVersionLabelByIndex(scheme: NamingScheme, zeroBasedIdx: number): string {
  if (scheme === 'tema_alpha') {
    return `Tema ${String.fromCharCode(65 + (zeroBasedIdx % 26))}`;
  }
  if (scheme === 'version_num') {
    return `Versión ${zeroBasedIdx + 1}`;
  }
  return `Tema ${zeroBasedIdx + 1}`;
}

export function ExamVersionsModal({
  open,
  onClose,
  sourceFormId,
  sourceFormTitle,
  sourceVersionId = ORIGINAL_VERSION_ID,
  onVersionsCreated,
  onEditVersion,
}: ExamVersionsModalProps) {
  const navigate = useNavigate();
  const [existingVersions, setExistingVersions] = useState<FormVersion[]>([
    { id: ORIGINAL_VERSION_ID, label: 'Tema 1 (Original)' },
  ]);
  const [baseShortCode, setBaseShortCode] = useState('');

  const [count, setCount] = useState(2);
  const [naming, setNaming] = useState<NamingScheme>('tema_num');
  const [variationMode, setVariationMode] = useState<VariationMode>('ai_shuffle');
  const [aiInstruction, setAiInstruction] = useState('');
  const [generating, setGenerating] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [error, setError] = useState('');
  const [createdVersions, setCreatedVersions] = useState<
    Array<{ version: FormVersion; questionCount: number }>
  >([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pdfBusyKey, setPdfBusyKey] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !sourceFormId) {
      setError('');
      setProgressText('');
      setCreatedVersions([]);
      setCopiedId(null);
      setPdfBusyKey(null);
      return;
    }

    let active = true;
    getDoc(doc(db, 'forms', sourceFormId))
      .then((snap) => {
        if (!active || !snap.exists()) return;
        const data = snap.data();
        setExistingVersions(getFormVersions({ versions: data.versions }));
        setBaseShortCode(data.shortCode ?? '');
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [open, sourceFormId]);

  const usesAi = variationMode === 'ai' || variationMode === 'ai_shuffle';

  async function handleGenerate() {
    if (!sourceFormId || generating) return;
    setGenerating(true);
    setError('');
    setCreatedVersions([]);

    const created: Array<{ version: FormVersion; questionCount: number }> = [];
    const startOffset = existingVersions.length;

    try {
      for (let i = 0; i < count; i++) {
        const label = getVersionLabelByIndex(naming, startOffset + i);
        setProgressText(`Generando ${label} (${i + 1} de ${count}) dentro del examen...`);

        const result = await addExamVersionInPlace({
          formId: sourceFormId,
          sourceVersionId,
          newLabel: label,
          variationMode,
          aiInstruction,
        });
        created.push(result);
      }

      const updatedList = [...existingVersions, ...created.map((c) => c.version)];
      setExistingVersions(updatedList);
      setCreatedVersions(created);
      onVersionsCreated?.(created);
    } catch (err) {
      if (created.length > 0) {
        const updatedList = [...existingVersions, ...created.map((c) => c.version)];
        setExistingVersions(updatedList);
        setCreatedVersions(created);
        onVersionsCreated?.(created);
      }
      setError(
        err instanceof Error ? err.message : 'No se pudieron generar las versiones del examen.'
      );
    } finally {
      setGenerating(false);
      setProgressText('');
    }
  }

  async function handleCopyDirectLink(versionId: string) {
    const directCode = getVersionDirectCode(baseShortCode, existingVersions, versionId);
    if (!directCode) return;
    const url = `${window.location.origin}/e/${directCode}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(versionId);
    setTimeout(() => setCopiedId((prev) => (prev === versionId ? null : prev)), 1800);
  }

  async function handleDownloadVersionPdf(versionId: string, mode: 'student' | 'teacher') {
    const key = `${versionId}:${mode}`;
    setPdfBusyKey(key);
    setError('');
    try {
      await generateExamPaperPdf({ formId: sourceFormId, mode, versionId });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el PDF.');
    } finally {
      setPdfBusyKey(null);
    }
  }

  const nextPreviewLabels = Array.from({ length: count }, (_, idx) =>
    getVersionLabelByIndex(naming, existingVersions.length + idx)
  ).join(', ');

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!generating) onClose();
      }}
      title="Agregar versiones (Temas) al examen"
      size="lg"
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-sand-200 bg-sand-50 px-3.5 py-2.5 text-xs text-ink-subtle space-y-1">
          <div>
            Examen: <strong className="text-ink">{sourceFormTitle || 'Sin título'}</strong>
          </div>
          <div>
            Versiones actuales ({existingVersions.length}):{' '}
            <span className="font-medium text-ink">
              {existingVersions.map((v) => v.label).join(' · ')}
            </span>
          </div>
        </div>

        {createdVersions.length === 0 ? (
          <>
            {usesAi && <AiStatusBar />}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-ink-light mb-1.5">
                  ¿Cuántas versiones agregar?
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[1, 2, 3, 4].map((n) => (
                    <button
                      key={n}
                      type="button"
                      disabled={generating}
                      onClick={() => setCount(n)}
                      className={`rounded-lg border py-2 text-xs font-mono font-bold transition-colors ${
                        count === n
                          ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                          : 'bg-white text-ink border-sand-300 hover:bg-sand-100'
                      }`}
                    >
                      +{n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-light mb-1.5">
                  Formato de nombre ({nextPreviewLabels})
                </label>
                <select
                  value={naming}
                  disabled={generating}
                  onChange={(e) => setNaming(e.target.value as NamingScheme)}
                  className="w-full rounded-lg border border-sand-300 bg-white px-3 py-2 text-xs text-ink focus:border-brand-600 focus:outline-none"
                >
                  <option value="tema_num">Tema 2, Tema 3...</option>
                  <option value="tema_alpha">Tema B, Tema C...</option>
                  <option value="version_num">Versión 2, Versión 3...</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-ink-light">
                ¿Cómo diferenciar cada versión?
              </label>
              <div className="grid gap-2">
                {([
                  {
                    id: 'ai_shuffle' as VariationMode,
                    title: 'Con IA (cambia números/datos) + mezclar orden',
                    desc: 'Recomendado: genera ejercicios equivalentes con otros datos, recalcula las respuestas y baraja orden y opciones.',
                    icon: Sparkles,
                  },
                  {
                    id: 'ai' as VariationMode,
                    title: 'Con IA (cambia números/datos, mismo orden)',
                    desc: 'Mantiene el mismo orden de actividades, pero modifica los datos y recalcula respuestas.',
                    icon: Sparkles,
                  },
                  {
                    id: 'shuffle' as VariationMode,
                    title: 'Solo mezclar preguntas y opciones (sin IA)',
                    desc: 'Rápido e instantáneo: conserva las mismas consignas cambiando el orden en cada tema.',
                    icon: Shuffle,
                  },
                  {
                    id: 'exact' as VariationMode,
                    title: 'Copia exacta en nueva pestaña (para editar manualmente)',
                    desc: 'Clona las actividades en un nuevo tema dentro de este examen para modificarlo a mano.',
                    icon: Layers,
                  },
                ] as const).map((opt) => {
                  const Icon = opt.icon;
                  const active = variationMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={generating}
                      onClick={() => setVariationMode(opt.id)}
                      className={`text-left rounded-xl border p-3 transition-colors flex items-start gap-3 ${
                        active
                          ? 'border-brand-600 bg-brand-50/70'
                          : 'border-sand-300 bg-white hover:bg-sand-50'
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 mt-0.5 shrink-0 ${
                          active ? 'text-brand-600' : 'text-ink-light'
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-ink">{opt.title}</p>
                        <p className="text-[11px] text-ink-subtle mt-0.5">{opt.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {usesAi && (
              <Input
                label="Indicación opcional para la IA"
                placeholder="Ej: Usa números enteros positivos y mantén el mismo nivel de dificultad"
                value={aiInstruction}
                disabled={generating}
                onChange={(e) => setAiInstruction(e.target.value)}
              />
            )}

            {progressText && (
              <div className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2.5 text-xs font-medium text-brand-800 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                <span>{progressText}</span>
              </div>
            )}

            {error && <p className="text-xs text-red-600 font-medium">{error}</p>}

            <div className="flex justify-end gap-2 pt-2 border-t border-sand-200">
              <Button variant="ghost" onClick={onClose} disabled={generating}>
                Cancelar
              </Button>
              <Button onClick={handleGenerate} disabled={generating}>
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Layers className="h-4 w-4" />
                )}
                {generating
                  ? 'Creando versiones...'
                  : `Agregar ${count} ${count === 1 ? 'versión' : 'versiones'}`}
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-green-200 bg-green-50/70 px-4 py-3 text-xs text-green-800 space-y-1">
              <p>
                Se agregaron <strong>{createdVersions.length}</strong> versiones dentro de este mismo examen.
              </p>
              <p>
                Todas las respuestas y notas de los alumnos de cualquier tema aparecerán unificadas en la misma planilla de resultados.
              </p>
            </div>

            {error && <p className="text-xs text-red-600 font-medium">{error}</p>}

            <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
              {createdVersions.map(({ version, questionCount }) => {
                const directCode = getVersionDirectCode(baseShortCode, existingVersions, version.id);
                return (
                  <div
                    key={version.id}
                    className="rounded-xl border border-sand-300 bg-white p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-bold text-ink truncate">
                        {version.label}{' '}
                        <span className="font-mono text-xs font-normal text-ink-subtle">
                          ({questionCount} actividades)
                        </span>
                      </p>
                      {directCode && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 rounded bg-sand-100 border border-sand-300 px-2 py-0.5 text-[11px] font-mono font-semibold text-ink">
                            Código directo: {directCode}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyDirectLink(version.id)}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-700 hover:underline"
                          >
                            {copiedId === version.id ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                            {copiedId === version.id ? 'Link copiado' : `Copiar /e/${directCode}`}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                      <Button
                        variant="secondary"
                        className="text-xs px-2.5 py-1.5"
                        disabled={pdfBusyKey !== null}
                        onClick={() => handleDownloadVersionPdf(version.id, 'student')}
                      >
                        {pdfBusyKey === `${version.id}:student` ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <FileDown className="h-3.5 w-3.5" />
                        )}
                        PDF Alumno
                      </Button>
                      <Button
                        variant="secondary"
                        className="text-xs px-2.5 py-1.5"
                        disabled={pdfBusyKey !== null}
                        onClick={() => handleDownloadVersionPdf(version.id, 'teacher')}
                      >
                        {pdfBusyKey === `${version.id}:teacher` ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <FileDown className="h-3.5 w-3.5 text-green-700" />
                        )}
                        Clave
                      </Button>
                      <Button
                        className="text-xs px-2.5 py-1.5"
                        onClick={() => {
                          onClose();
                          if (onEditVersion) {
                            onEditVersion(version.id);
                          } else {
                            navigate(`/form/${sourceFormId}?v=${version.id}`);
                          }
                        }}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Editar tema
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-sand-200">
              <Button variant="secondary" onClick={() => setCreatedVersions([])}>
                Agregar más versiones
              </Button>
              <Button onClick={onClose}>Listo</Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
