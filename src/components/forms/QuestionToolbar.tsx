import { useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { Button } from '../ui/Button';
import { Type, AlignLeft, List, CheckSquare, ChevronDown, Minus, Calendar, Clock, Layers, Sparkles } from 'lucide-react';
import { AiGenerateModal } from './AiGenerateModal';

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
  const addQuestion = useEditorStore((s) => s.addQuestion);
  const addSection = useEditorStore((s) => s.addSection);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {questionTypes.map(({ type, icon: Icon, label }) => (
          <Button key={type} variant="secondary" onClick={() => addQuestion(type)}>
            <Icon className="h-4 w-4" />
            {label}
          </Button>
        ))}
        <Button variant="secondary" onClick={() => addSection()}>
          <Layers className="h-4 w-4" />
          Sección
        </Button>
        <Button variant="secondary" onClick={() => setAiOpen(true)}>
          <Sparkles className="h-4 w-4" />
          IA
        </Button>
      </div>
      <AiGenerateModal open={aiOpen} onClose={() => setAiOpen(false)} />
    </>
  );
}
