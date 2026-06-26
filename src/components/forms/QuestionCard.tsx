import { useState, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEditorStore } from '../../store/editorStore';
import { Button } from '../ui/Button';
import { Toggle } from '../ui/Toggle';
import { Input } from '../ui/Input';
import { MathToolbar, useMathInsert } from '../ui/MathToolbar';
import { GripVertical, Copy, Trash2, ImagePlus, Link, X } from 'lucide-react';
import type { Question } from '../../types/question';
import { TextQuestion } from './question-types/TextQuestion';
import { MultipleChoiceQuestion } from './question-types/MultipleChoiceQuestion';
import { CheckboxQuestion } from './question-types/CheckboxQuestion';
import { DropdownQuestion } from './question-types/DropdownQuestion';
import { LinearScaleQuestion } from './question-types/LinearScaleQuestion';
import { DateQuestion } from './question-types/DateQuestion';
import { ConditionsEditor } from './ConditionsEditor';
import { QuizSettings } from './QuizSettings';
import { ImageSearchModal } from './ImageSearchModal';

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
    default: return null;
  }
}

export function QuestionCard({ question }: QuestionCardProps) {
  const { updateQuestion, removeQuestion } = useEditorStore();
  const form = useEditorStore((s) => s.form);
  const sections = useEditorStore((s) => s.sections);
  const moveQuestionToSection = useEditorStore((s) => s.moveQuestionToSection);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);
  const insertTitle = useMathInsert(titleRef, question.title, (val) => updateQuestion(question.id, { title: val }));
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: question.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <>
      <div ref={setNodeRef} style={style} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-start gap-4">
          <button className="mt-2 cursor-grab text-gray-400 hover:text-gray-600" {...attributes} {...listeners}>
            <GripVertical className="h-5 w-5" />
          </button>
          <div className="flex-1 space-y-4">
            <Input
              ref={titleRef}
              value={question.title}
              onChange={(e) => updateQuestion(question.id, { title: e.target.value })}
              placeholder="Pregunta sin título"
              className="text-lg font-medium border-0 px-0 focus:ring-0"
            />
            <MathToolbar onInsert={insertTitle} />
            {question.settings?.imageUrl && (
              <div className="relative group">
                <img
                  src={question.settings.imageUrl}
                  alt=""
                  className="w-full max-h-48 object-cover rounded-lg"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <button
                  onClick={() => {
                    const { imageUrl: _, ...rest } = question.settings ?? {};
                    updateQuestion(question.id, { settings: rest });
                  }}
                  className="absolute top-2 right-2 bg-white/80 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-4 w-4 text-red-500" />
                </button>
              </div>
            )}
            <QuestionTypeComponent question={question} />
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
              <Toggle
                label="Obligatoria"
                checked={question.required}
                onChange={(checked) => updateQuestion(question.id, { required: checked })}
              />
              <div className="flex-1 min-w-[8px]" />
              <select
                value={question.sectionId ?? ''}
                onChange={(e) => moveQuestionToSection(question.id, e.target.value || null)}
                className="text-xs border rounded px-2 py-1 bg-white max-w-[160px]"
              >
                <option value="">Sin sección</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
              <div className="flex items-center gap-1">
                <Button variant="ghost" onClick={() => setImageModalOpen(true)} title="Buscar imagen" className="p-2">
                  <ImagePlus className="h-4 w-4 text-gray-500" />
                </Button>
                <Button variant="ghost" onClick={() => setShowUrlInput(!showUrlInput)} title="Pegar URL de imagen" className="p-2">
                  <Link className={`h-4 w-4 ${showUrlInput ? 'text-indigo-500' : 'text-gray-500'}`} />
                </Button>
                <Button variant="ghost" onClick={() => removeQuestion(question.id)} className="p-2">
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </div>
            {showUrlInput && (
              <div className="flex gap-2">
                <Input
                  value={urlValue}
                  onChange={(e) => setUrlValue(e.target.value)}
                  placeholder="https://ejemplo.com/imagen.jpg"
                  className="text-xs flex-1"
                />
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (urlValue.trim()) {
                      updateQuestion(question.id, { settings: { ...question.settings, imageUrl: urlValue.trim() } });
                      setShowUrlInput(false);
                      setUrlValue('');
                    }
                  }}
                  disabled={!urlValue.trim()}
                >
                  Agregar
                </Button>
              </div>
            )}
            <ConditionsEditor question={question} />
            {form?.settings?.isQuiz && (
              <QuizSettings question={question} updateQuestion={updateQuestion} />
            )}
          </div>
        </div>
      </div>
      <ImageSearchModal
        open={imageModalOpen}
        onClose={() => setImageModalOpen(false)}
        onSelect={(url) => {
          updateQuestion(question.id, {
            settings: { ...question.settings, imageUrl: url },
          });
          setImageModalOpen(false);
        }}
      />
    </>
  );
}
