import { useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { Button } from '../ui/Button';
import { Type, AlignLeft, List, CheckSquare, ChevronDown, Minus, Calendar, Clock, Layers, Sparkles, WandSparkles } from 'lucide-react';
import { AiGenerateModal } from './AiGenerateModal';
import { AiModifyAllModal } from './AiModifyAllModal';

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
      <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
        {questionTypes.map(({ type, icon: Icon, label }) => (
          <Button key={type} variant="secondary" className="shrink-0 sm:shrink">
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{label}</span>
          </Button>
        ))}
        <Button variant="secondary" onClick={() => addSection()} className="shrink-0 sm:shrink">
          <Layers className="h-4 w-4" />
          <span className="hidden sm:inline">Sección</span>
        </Button>
        <Button variant="secondary" onClick={() => setAiOpen(true)} className="shrink-0 sm:shrink">
          <Sparkles className="h-4 w-4" />
          <span className="hidden sm:inline">Generar con IA</span>
        </Button>
        <Button variant="secondary" onClick={() => setModifyAllOpen(true)} className="shrink-0 sm:shrink">
          <WandSparkles className="h-4 w-4" />
          <span className="hidden sm:inline">Modificar todo</span>
        </Button>
      </div>
      <AiGenerateModal open={aiOpen} onClose={() => setAiOpen(false)} />
      <AiModifyAllModal open={modifyAllOpen} onClose={() => setModifyAllOpen(false)} />
    </>
  );
}
