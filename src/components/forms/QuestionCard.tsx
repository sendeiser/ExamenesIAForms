import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEditorStore } from '../../store/editorStore';
import { Button } from '../ui/Button';
import { Toggle } from '../ui/Toggle';
import { Input } from '../ui/Input';
import { GripVertical, Copy, Trash2 } from 'lucide-react';
import type { Question } from '../../types/question';
import { TextQuestion } from './question-types/TextQuestion';
import { MultipleChoiceQuestion } from './question-types/MultipleChoiceQuestion';
import { CheckboxQuestion } from './question-types/CheckboxQuestion';
import { DropdownQuestion } from './question-types/DropdownQuestion';
import { LinearScaleQuestion } from './question-types/LinearScaleQuestion';
import { DateQuestion } from './question-types/DateQuestion';
import { FileUploadQuestion } from './question-types/FileUploadQuestion';

interface QuestionCardProps {
  question: Question;
}

function QuestionTypeComponent({ question }: { question: Question }) {
  const updateQuestion = useEditorStore((s) => s.updateQuestion);
  const props = { question, updateQuestion };

  switch (question.type) {
    case 'text': return <TextQuestion {...props} />;
    case 'paragraph': return <TextQuestion {...props} multiline />;
    case 'multipleChoice': return <MultipleChoiceQuestion {...props} />;
    case 'checkbox': return <CheckboxQuestion {...props} />;
    case 'dropdown': return <DropdownQuestion {...props} />;
    case 'linearScale': return <LinearScaleQuestion {...props} />;
    case 'date': return <DateQuestion {...props} />;
    case 'time': return <DateQuestion {...props} time />;
    case 'fileUpload': return <FileUploadQuestion />;
    default: return null;
  }
}

export function QuestionCard({ question }: QuestionCardProps) {
  const { updateQuestion, removeQuestion } = useEditorStore();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: question.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-start gap-4">
        <button className="mt-2 cursor-grab text-gray-400 hover:text-gray-600" {...attributes} {...listeners}>
          <GripVertical className="h-5 w-5" />
        </button>
        <div className="flex-1 space-y-4">
          <Input
            value={question.title}
            onChange={(e) => updateQuestion(question.id, { title: e.target.value })}
            placeholder="Pregunta sin título"
            className="text-lg font-medium border-0 px-0 focus:ring-0"
          />
          <QuestionTypeComponent question={question} />
          <div className="flex items-center gap-4 pt-2 border-t">
            <Toggle
              label="Obligatoria"
              checked={question.required}
              onChange={(checked) => updateQuestion(question.id, { required: checked })}
            />
            <div className="flex-1" />
            <Button variant="ghost" onClick={() => removeQuestion(question.id)}>
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
