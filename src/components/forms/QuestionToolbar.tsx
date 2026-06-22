import { useEditorStore } from '../../store/editorStore';
import { Button } from '../ui/Button';
import { Type, AlignLeft, List, CheckSquare, ChevronDown, Minus, Calendar, Clock, Upload } from 'lucide-react';

const questionTypes = [
  { type: 'text' as const, icon: Type, label: 'Texto' },
  { type: 'paragraph' as const, icon: AlignLeft, label: 'Párrafo' },
  { type: 'multipleChoice' as const, icon: List, label: 'Opción múltiple' },
  { type: 'checkbox' as const, icon: CheckSquare, label: 'Casillas' },
  { type: 'dropdown' as const, icon: ChevronDown, label: 'Desplegable' },
  { type: 'linearScale' as const, icon: Minus, label: 'Escala lineal' },
  { type: 'date' as const, icon: Calendar, label: 'Fecha' },
  { type: 'time' as const, icon: Clock, label: 'Hora' },
  { type: 'fileUpload' as const, icon: Upload, label: 'Archivo' },
];

export function QuestionToolbar() {
  const addQuestion = useEditorStore((s) => s.addQuestion);

  return (
    <div className="flex flex-wrap gap-2">
      {questionTypes.map(({ type, icon: Icon, label }) => (
        <Button key={type} variant="secondary" onClick={() => addQuestion(type)}>
          <Icon className="h-4 w-4" />
          {label}
        </Button>
      ))}
    </div>
  );
}
