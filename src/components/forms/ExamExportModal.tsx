import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { ORIGINAL_VERSION_ID, getFormVersions } from '../../lib/examVersions';
import {
  exportExamToJsonFile,
  generateExamPaperPdf,
} from '../../lib/examPrintAndExport';
import type { FormVersion } from '../../types/form';
import { FileDown, FileJson, GraduationCap, Loader2, Printer } from 'lucide-react';

interface ExamExportModalProps {
  open: boolean;
  onClose: () => void;
  formId: string;
  formTitle: string;
  defaultVersionId?: string;
}

export function ExamExportModal({
  open,
  onClose,
  formId,
  formTitle,
  defaultVersionId = ORIGINAL_VERSION_ID,
}: ExamExportModalProps) {
  const [versions, setVersions] = useState<FormVersion[]>([
    { id: ORIGINAL_VERSION_ID, label: 'Tema 1 (Original)' },
  ]);
  const [selectedVersionId, setSelectedVersionId] = useState(defaultVersionId);
  const [busyAction, setBusyAction] = useState<'student' | 'teacher' | 'json' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !formId) return;
    setError('');
    setSelectedVersionId(defaultVersionId);
    let active = true;
    getDoc(doc(db, 'forms', formId))
      .then((snap) => {
        if (!active || !snap.exists()) return;
        const list = getFormVersions({ versions: snap.data().versions });
        setVersions(list);
        if (!list.some((v) => v.id === defaultVersionId)) {
          setSelectedVersionId(list[0].id);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [open, formId, defaultVersionId]);

  async function runAction(action: 'student' | 'teacher' | 'json') {
    if (!formId || busyAction) return;
    setBusyAction(action);
    setError('');
    try {
      if (action === 'json') {
        await exportExamToJsonFile(formId);
      } else {
        await generateExamPaperPdf({
          formId,
          mode: action,
          versionId: selectedVersionId,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar la exportación.');
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Exportar examen" size="md">
      <div className="space-y-4">
        <div className="rounded-lg border border-sand-200 bg-sand-50 px-3.5 py-2.5 text-xs text-ink-subtle">
          Examen seleccionado: <strong className="text-ink">{formTitle || 'Sin título'}</strong>
        </div>

        {versions.length > 1 && (
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-ink-light">
              Versión / Tema para imprimir en PDF
            </label>
            <select
              value={selectedVersionId}
              onChange={(e) => setSelectedVersionId(e.target.value)}
              disabled={busyAction !== null}
              className="w-full rounded-lg border border-sand-300 bg-white px-3 py-2 text-xs font-medium text-ink focus:border-brand-600 focus:outline-none"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-2.5">
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={() => runAction('student')}
            className="w-full text-left rounded-xl border border-sand-300 bg-white hover:border-brand-500 hover:bg-brand-50/40 p-4 transition-colors flex items-start gap-3 disabled:opacity-60"
          >
            <span className="w-9 h-9 rounded-lg bg-brand-50 border border-brand-100 text-brand-700 flex items-center justify-center shrink-0">
              {busyAction === 'student' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Printer className="h-4 w-4" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-ink">PDF imprimible — Hoja del Alumno</p>
              <p className="text-xs text-ink-subtle mt-0.5">
                Formato listo para imprimir y tomar en papel, con datos del estudiante, tablas en blanco y renglones de respuesta.
              </p>
            </div>
            <FileDown className="h-4 w-4 text-ink-light shrink-0 mt-1" />
          </button>

          <button
            type="button"
            disabled={busyAction !== null}
            onClick={() => runAction('teacher')}
            className="w-full text-left rounded-xl border border-sand-300 bg-white hover:border-green-500 hover:bg-green-50/40 p-4 transition-colors flex items-start gap-3 disabled:opacity-60"
          >
            <span className="w-9 h-9 rounded-lg bg-green-50 border border-green-200 text-green-700 flex items-center justify-center shrink-0">
              {busyAction === 'teacher' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <GraduationCap className="h-4 w-4" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-ink">PDF docente — Clave de corrección</p>
              <p className="text-xs text-ink-subtle mt-0.5">
                Incluye el puntaje de cada actividad, las opciones correctas marcadas y las respuestas esperadas.
              </p>
            </div>
            <FileDown className="h-4 w-4 text-ink-light shrink-0 mt-1" />
          </button>

          <button
            type="button"
            disabled={busyAction !== null}
            onClick={() => runAction('json')}
            className="w-full text-left rounded-xl border border-sand-300 bg-white hover:border-amber-500 hover:bg-amber-50/40 p-4 transition-colors flex items-start gap-3 disabled:opacity-60"
          >
            <span className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
              {busyAction === 'json' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileJson className="h-4 w-4" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-ink">Exportar archivo de examen (.json)</p>
              <p className="text-xs text-ink-subtle mt-0.5">
                Descarga una copia portátil completa (incluyendo todas las versiones) para respaldo o reimportación.
              </p>
            </div>
            <FileDown className="h-4 w-4 text-ink-light shrink-0 mt-1" />
          </button>
        </div>

        {error && <p className="text-xs text-red-600 font-medium">{error}</p>}

        <div className="flex justify-end pt-2 border-t border-sand-200">
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
