import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useEditorStore } from '../../store/editorStore';
import { QuestionCard } from './QuestionCard';
import { QuestionToolbar } from './QuestionToolbar';

export function FormEditor() {
  const questions = useEditorStore((s) => s.questions);
  const reorderQuestions = useEditorStore((s) => s.reorderQuestions);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = questions.findIndex((q) => q.id === active.id);
    const newIndex = questions.findIndex((q) => q.id === over.id);
    const reordered = [...questions];
    reordered.splice(newIndex, 0, reordered.splice(oldIndex, 1)[0]);
    reorderQuestions(reordered.map((q, i) => ({ ...q, order: i })));
  }

  return (
    <div className="space-y-4">
      <QuestionToolbar />
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
          {questions.map((question) => (
            <QuestionCard key={question.id} question={question} />
          ))}
        </SortableContext>
      </DndContext>
      {questions.length === 0 && (
        <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
          Agrega preguntas usando los botones de arriba
        </div>
      )}
      <QuestionToolbar />
    </div>
  );
}
