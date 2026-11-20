import { useState } from 'react';
import { Monitor, Smartphone, RotateCcw, ExternalLink, Eye } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { getVersionLabel, hasMultipleVersions } from '../../lib/examVersions';
import { FormView } from '../form-view/FormView';
import { Button } from '../ui/Button';

interface ExamPreviewPanelProps {
  previewUrl: string;
}

export function ExamPreviewPanel({ previewUrl }: ExamPreviewPanelProps) {
  const form = useEditorStore((s) => s.form);
  const questions = useEditorStore((s) => s.questions);
  const sections = useEditorStore((s) => s.sections);
  const activeVersionId = useEditorStore((s) => s.activeVersionId);
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [previewKey, setPreviewKey] = useState(0);

  if (!form) return null;
  const activeVersionLabel = hasMultipleVersions(form)
    ? getVersionLabel(form, activeVersionId)
    : undefined;

  return (
    <section
      aria-label="Vista previa del examen"
      className="rounded-xl border border-sand-300 bg-white shadow-paper overflow-hidden"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sand-300 bg-sand-100/80 px-4 py-3">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-brand-600" />
          <span className="font-display text-sm font-bold text-ink">Vista previa del estudiante</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-[11px] font-mono font-medium text-state-success">
            <span className="h-1.5 w-1.5 rounded-full bg-state-success animate-pulse" />
            En vivo
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-lg border border-sand-300 bg-white p-0.5">
            <button
              type="button"
              onClick={() => setViewport('desktop')}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                viewport === 'desktop'
                  ? 'bg-brand-50 text-brand-600 font-semibold'
                  : 'text-ink-subtle hover:text-ink'
              }`}
              title="Vista escritorio"
            >
              <Monitor className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Escritorio</span>
            </button>
            <button
              type="button"
              onClick={() => setViewport('mobile')}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                viewport === 'mobile'
                  ? 'bg-brand-50 text-brand-600 font-semibold'
                  : 'text-ink-subtle hover:text-ink'
              }`}
              title="Vista móvil"
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Móvil</span>
            </button>
          </div>

          <Button
            type="button"
            variant="secondary"
            className="px-2.5 py-1.5 text-xs"
            onClick={() => setPreviewKey((k) => k + 1)}
            title="Reiniciar respuestas de la vista previa"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reiniciar
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="px-2.5 py-1.5 text-xs"
            onClick={() => window.open(previewUrl, '_blank')}
            title="Abrir vista del alumno en otra pestaña"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Nueva pestaña</span>
          </Button>
        </div>
      </div>

      <div className="bg-sand-100/70 p-4 sm:p-6">
        <div
          className={`mx-auto transition-all duration-200 ${
            viewport === 'mobile'
              ? 'max-w-[390px] rounded-2xl border-4 border-ink bg-white shadow-lg overflow-hidden'
              : 'w-full'
          }`}
        >
          <FormView
            key={`${previewKey}-${activeVersionId}`}
            form={form}
            questions={questions}
            sections={sections}
            respondent={{ name: 'Vista previa', email: 'docente@ejemplo.com' }}
            onSubmit={async () => {}}
            versionLabel={activeVersionLabel}
            previewMode
          />
        </div>
      </div>
    </section>
  );
}
