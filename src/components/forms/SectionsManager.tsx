import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useEditorStore } from '../../store/editorStore';
import { SectionCard } from './SectionCard';
import { QuestionCard } from './QuestionCard';

export function SectionsManager() {
  const sections = useEditorStore((s) => s.sections);
  const allQuestions = useEditorStore((s) => s.questions);
  const reorderQuestions = useEditorStore((s) => s.reorderQuestions);
  const reorderSections = useEditorStore((s) => s.reorderSections);

  const unassignedQuestions = allQuestions.filter((q) => !q.sectionId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const isSection = sections.some((s) => s.id === active.id);
    if (isSection) {
      const oldIndex = sections.findIndex((s) => s.id === active.id);
      const newIndex = sections.findIndex((s) => s.id === over.id);
      const reordered = [...sections];
      reordered.splice(newIndex, 0, reordered.splice(oldIndex, 1)[0]);
      reorderSections(reordered.map((s, i) => ({ ...s, order: i })));
      return;
    }

    const isUnassigned = unassignedQuestions.some((q) => q.id === active.id);
    if (isUnassigned) {
      const oldIndex = unassignedQuestions.findIndex((q) => q.id === active.id);
      const newIndex = unassignedQuestions.findIndex((q) => q.id === over.id);
      const reordered = [...unassignedQuestions];
      reordered.splice(newIndex, 0, reordered.splice(oldIndex, 1)[0]);
      const updatedAll = allQuestions.map((q) => {
        const found = reordered.find((r) => r.id === q.id);
        return found ? { ...found, order: reordered.indexOf(found) } : q;
      });
      reorderQuestions(updatedAll);
      return;
    }

    const question = allQuestions.find((q) => q.id === active.id);
    if (!question?.sectionId) return;
    const sectionQuestions = allQuestions.filter((q) => q.sectionId === question.sectionId);
    const oldIndex = sectionQuestions.findIndex((q) => q.id === active.id);
    const newIndex = sectionQuestions.findIndex((q) => q.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = [...sectionQuestions];
    reordered.splice(newIndex, 0, reordered.splice(oldIndex, 1)[0]);
    const updatedAll = allQuestions.map((q) => {
      const found = reordered.find((r) => r.id === q.id);
      return found ? { ...found, order: reordered.indexOf(found) } : q;
    });
    reorderQuestions(updatedAll);
  }

  const allSectionIds = sections.map((s) => s.id);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="space-y-6">
        {unassignedQuestions.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">Sin sección</h3>
            <SortableContext items={unassignedQuestions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
              {unassignedQuestions.map((q) => (
                <QuestionCard key={q.id} question={q} />
              ))}
            </SortableContext>
          </div>
        )}

        <SortableContext items={allSectionIds} strategy={verticalListSortingStrategy}>
          {sections.map((section) => (
            <SectionCard key={section.id} section={section} />
          ))}
        </SortableContext>

        {sections.length === 0 && unassignedQuestions.length === 0 && (
          <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
            Agrega una sección o usa los botones de pregunta
          </div>
        )}
      </div>
    </DndContext>
  );
}
