import { useState, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEditorStore } from '../../store/editorStore';
import { Button } from '../ui/Button';
import { Toggle } from '../ui/Toggle';
import { Input } from '../ui/Input';
import { MathToolbar, useMathInsert } from '../ui/MathToolbar';
import { LatexRenderer } from '../ui/LatexRenderer';
import { GripVertical, Trash2, ImagePlus, Link, X, Sparkles, ChevronUp, ChevronDown, Table2 } from 'lucide-react';
import type { Question, QuestionTable } from '../../types/question';
import { buildExpectedTableAnswer, createDefaultQuestionTable } from '../../lib/tableUtils';
import { TextQuestion } from './question-types/TextQuestion';
import { MultipleChoiceQuestion } from './question-types/MultipleChoiceQuestion';
import { CheckboxQuestion } from './question-types/CheckboxQuestion';
import { DropdownQuestion } from './question-types/DropdownQuestion';
import { LinearScaleQuestion } from './question-types/LinearScaleQuestion';
import { DateQuestion } from './question-types/DateQuestion';
import { ConditionsEditor } from './ConditionsEditor';
import { QuizSettings } from './QuizSettings';
import { TableEditor } from './TableEditor';
import { ImageSearchModal } from './ImageSearchModal';
import { AiModifyModal } from './AiModifyModal';

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
  const updateQuestion = useEditorStore((s) => s.updateQuestion);
  const removeQuestion = useEditorStore((s) => s.removeQuestion);
  const allQuestions = useEditorStore((s) => s.questions);
  const reorderQuestions = useEditorStore((s) => s.reorderQuestions);
  const form = useEditorStore((s) => s.form);
  const sections = useEditorStore((s) => s.sections);
  const moveQuestionToSection = useEditorStore((s) => s.moveQuestionToSection);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const insertTitle = useMathInsert(titleRef, question.title, (val) => updateQuestion(question.id, { title: val }));
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: question.id });

  const siblings = allQuestions.filter((q) => q.sectionId === question.sectionId).sort((a, b) => a.order - b.order);
  const idx = siblings.findIndex((q) => q.id === question.id);

  function moveUp() {
    if (idx <= 0) return;
    const reordered = [...siblings];
    [reordered[idx - 1], reordered[idx]] = [reordered[idx], reordered[idx - 1]];
    const updatedAll = allQuestions.map((q) => {
      const pos = reordered.findIndex((r) => r.id === q.id);
      return pos !== -1 ? { ...q, order: pos } : q;
    });
    const sorted = [...updatedAll].sort((a, b) => {
      if (a.sectionId !== b.sectionId) return (a.sectionId ?? '').localeCompare(b.sectionId ?? '');
      return a.order - b.order;
    });
    reorderQuestions(sorted);
  }

  function moveDown() {
    if (idx === -1 || idx >= siblings.length - 1) return;
    const reordered = [...siblings];
    [reordered[idx], reordered[idx + 1]] = [reordered[idx + 1], reordered[idx]];
    const updatedAll = allQuestions.map((q) => {
      const pos = reordered.findIndex((r) => r.id === q.id);
      return pos !== -1 ? { ...q, order: pos } : q;
    });
    const sorted = [...updatedAll].sort((a, b) => {
      if (a.sectionId !== b.sectionId) return (a.sectionId ?? '').localeCompare(b.sectionId ?? '');
      return a.order - b.order;
    });
    reorderQuestions(sorted);
  }

  function toggleTable() {
    if (question.settings?.table) {
      const { table: _, ...rest } = question.settings ?? {};
      updateQuestion(question.id, { settings: rest });
      return;
    }
    updateQuestion(question.id, {
      settings: {
        ...question.settings,
        table: createDefaultQuestionTable(2, 3),
      },
    });
  }

  function handleTableChange(nextTable: QuestionTable) {
    const prevTable = question.settings?.table;
    const updates: Partial<Question> = {
      settings: { ...question.settings, table: nextTable },
    };
    if (form?.settings?.isQuiz && question.type === 'text') {
      const prevExpected = prevTable ? buildExpectedTableAnswer(prevTable) : null;
      const nextExpected = buildExpectedTableAnswer(nextTable);
      if (nextExpected) {
        updates.quizSettings = {
          correctAnswer: nextExpected,
          points: question.quizSettings?.points ?? 1,
        };
      } else if (prevExpected && question.quizSettings?.correctAnswer === prevExpected) {
        updates.quizSettings = {
          correctAnswer: null,
          points: question.quizSettings?.points ?? 1,
        };
      }
    }
    updateQuestion(question.id, updates);
  }

  const showTitlePreview =
    question.title.includes('$') ||
    question.title.includes('\\(') ||
    question.title.includes('\\[') ||
    question.title.includes('|') ||
    question.title.includes('\\begin{tabular}') ||
    question.title.includes('\\begin{array}');

  const hideRedundantTextInput =
    question.type === 'text' && (question.settings?.table?.editableCells?.length ?? 0) > 0;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <>
      <div ref={setNodeRef} style={style} className="bg-white rounded-xl shadow-paper border border-sand-300 p-6">
        <div className="flex items-start gap-4">
          <div className="flex flex-col items-center gap-0.5 mt-1">
            <button onClick={moveUp} disabled={idx <= 0} className="text-gray-400 hover:text-gray-600 disabled:opacity-20 disabled:cursor-not-allowed p-0.5">
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button className="cursor-grab text-gray-400 hover:text-gray-600" {...attributes} {...listeners}>
              <GripVertical className="h-5 w-5" />
            </button>
            <button onClick={moveDown} disabled={idx === -1 || idx >= siblings.length - 1} className="text-gray-400 hover:text-gray-600 disabled:opacity-20 disabled:cursor-not-allowed p-0.5">
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex-1 space-y-4">
            <Input
              ref={titleRef}
              value={question.title}
              onChange={(e) => updateQuestion(question.id, { title: e.target.value })}
              placeholder="Pregunta sin título"
              className="text-lg font-medium border-0 px-0 focus:ring-0"
            />
            {showTitlePreview && (
              <div className="rounded-lg border border-sand-200 bg-sand-50/60 px-3 py-2 text-xs text-ink-light">
                <LatexRenderer text={question.title} />
              </div>
            )}
            <div className="flex flex-wrap items-center gap-4">
              <MathToolbar onInsert={insertTitle} />
              {!question.settings?.table && (
                <button
                  type="button"
                  onClick={toggleTable}
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 transition-colors"
                >
                  <Table2 className="h-3.5 w-3.5" />
                  Agregar tabla
                </button>
              )}
            </div>
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
            {question.settings?.table && (
              <TableEditor
                table={question.settings.table}
                isQuiz={Boolean(form?.settings?.isQuiz)}
                onChange={handleTableChange}
                onRemove={toggleTable}
              />
            )}
            {!hideRedundantTextInput && <QuestionTypeComponent question={question} />}
            <div className="flex flex-wrap items-center gap-4 pt-2 border-t">
              <Toggle
                label="Obligatoria"
                checked={question.required}
                onChange={(checked) => updateQuestion(question.id, { required: checked })}
              />
              <Toggle
                label="Exigir foto del procedimiento"
                checked={Boolean(question.settings?.requireProcedurePhoto)}
                onChange={(checked) =>
                  updateQuestion(question.id, {
                    settings: { ...question.settings, requireProcedurePhoto: checked },
                  })
                }
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
                <Button variant="ghost" onClick={() => setAiModalOpen(true)} title="Modificar con IA" className="p-2 hover:bg-terracotta-50">
                  <Sparkles className="h-4 w-4 text-terracotta-500" />
                </Button>
                <Button
                  variant="ghost"
                  onClick={toggleTable}
                  title={question.settings?.table ? 'Quitar tabla' : 'Agregar tabla'}
                  className="p-2"
                >
                  <Table2 className={`h-4 w-4 ${question.settings?.table ? 'text-brand-600' : 'text-ink-subtle'}`} />
                </Button>
                <Button variant="ghost" onClick={() => setImageModalOpen(true)} title="Buscar imagen" className="p-2">
                  <ImagePlus className="h-4 w-4 text-ink-subtle" />
                </Button>
                <Button variant="ghost" onClick={() => setShowUrlInput(!showUrlInput)} title="Pegar URL de imagen" className="p-2">
                  <Link className={`h-4 w-4 ${showUrlInput ? 'text-brand-600' : 'text-ink-subtle'}`} />
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
      <AiModifyModal
        open={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        question={question}
        onUpdate={updateQuestion}
      />
    </>
  );
}
