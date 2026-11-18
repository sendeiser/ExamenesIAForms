import { useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { Button } from '../ui/Button';
import { Type, AlignLeft, List, CheckSquare, ChevronDown, Minus, Calendar, Clock, Layers, Sparkles, WandSparkles, Table2 } from 'lucide-react';
import { AiGenerateModal } from './AiGenerateModal';
import { AiModifyAllModal } from './AiModifyAllModal';
import { createDefaultQuestionTable } from '../../lib/tableUtils';

const questionTypes = [
  { type: 'text' as const, icon: Type, label: 'Texto' },
  { type: 'paragraph' as const, icon: AlignLeft, label: 'Párrafo' },
  { type: 'multipleChoice' as const, icon: List, label: 'Opción múltiple' },
  { type: 'checkbox' as const, icon: CheckSquare, label: 'Casillas' },
  { type: 'dropdown' as const, icon: ChevronDown, label: 'Desplegable' },
  { type: 'linearScale' as const, icon: Minus, label: 'Escala lineal' },
  { type: 'date' as const, icon: Calendar, label: 'Fecha' },
  { type: 'time' as const, icon: Clock, label: 'Hora' },
];

export function QuestionToolbar() {
  const [aiOpen, setAiOpen] = useState(false);
  const [modifyAllOpen, setModifyAllOpen] = useState(false);
  const addQuestion = useEditorStore((s) => s.addQuestion);
  const addSection = useEditorStore((s) => s.addSection);

  return (
    <>
      <div className="rounded-xl border border-sand-300 bg-white p-3 shadow-paper flex gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible items-center">
        {questionTypes.map(({ type, icon: Icon, label }) => (
          <Button key={type} variant="secondary" onClick={() => addQuestion(type)} className="shrink-0 sm:shrink px-3 py-1.5 text-xs">
            <Icon className="h-3.5 w-3.5 text-ink-subtle" />
            <span className="hidden sm:inline">{label}</span>
          </Button>
        ))}
        <Button variant="secondary" onClick={() => addSection()} className="shrink-0 sm:shrink px-3 py-1.5 text-xs">
          <Layers className="h-3.5 w-3.5 text-ink-subtle" />
          <span className="hidden sm:inline">Sección</span>
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            addQuestion('text', {
              title: 'Completa o analiza la siguiente tabla:',
              settings: { table: createDefaultQuestionTable(2, 3) },
            })
          }
          className="shrink-0 sm:shrink px-3 py-1.5 text-xs"
          title="Agregar actividad con tabla"
        >
          <Table2 className="h-3.5 w-3.5 text-brand-600" />
          <span className="hidden sm:inline">Tabla</span>
        </Button>
        <div className="h-5 w-px bg-sand-300 hidden sm:block mx-0.5" />
        <Button onClick={() => setAiOpen(true)} className="shrink-0 sm:shrink px-3.5 py-1.5 text-xs">
          <Sparkles className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Generar con IA</span>
        </Button>
        <Button variant="secondary" onClick={() => setModifyAllOpen(true)} className="shrink-0 sm:shrink px-3 py-1.5 text-xs border-terracotta-200 text-terracotta-700 hover:bg-terracotta-50">
          <WandSparkles className="h-3.5 w-3.5 text-terracotta-500" />
          <span className="hidden sm:inline">Modificar todo</span>
        </Button>
      </div>
      <AiGenerateModal open={aiOpen} onClose={() => setAiOpen(false)} />
      <AiModifyAllModal open={modifyAllOpen} onClose={() => setModifyAllOpen(false)} />
    </>
  );
}
