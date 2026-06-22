import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEditorStore } from '../../store/editorStore';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { GripVertical, Trash2, Plus } from 'lucide-react';
import type { Section } from '../../types/question';
import { QuestionCard } from './QuestionCard';

interface SectionCardProps {
  section: Section;
}

export function SectionCard({ section }: SectionCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: section.id });
  const questions = useEditorStore((s) => s.questions.filter((q) => q.sectionId === section.id));
  const updateSection = useEditorStore((s) => s.updateSection);
  const removeSection = useEditorStore((s) => s.removeSection);
  const addQuestion = useEditorStore((s) => s.addQuestion);

  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className="border-2 border-indigo-200 rounded-xl bg-indigo-50/30 p-4 space-y-4">
      <div className="flex items-start gap-3">
        <button className="mt-2 cursor-grab text-gray-400" {...attributes} {...listeners}>
          <GripVertical className="h-5 w-5" />
        </button>
        <div className="flex-1 space-y-2">
          <Input
            value={section.title}
            onChange={(e) => updateSection(section.id, { title: e.target.value })}
            className="font-semibold border-indigo-200"
            placeholder="Título de sección"
          />
          <Input
            value={section.description}
            onChange={(e) => updateSection(section.id, { description: e.target.value })}
            placeholder="Descripción de la sección (opcional)"
            className="text-sm"
          />
        </div>
        <Button variant="ghost" onClick={() => removeSection(section.id)}>
          <Trash2 className="h-4 w-4 text-red-500" />
        </Button>
      </div>

      {questions.map((q) => (
        <QuestionCard key={q.id} question={q} />
      ))}

      <Button variant="secondary" onClick={() => addQuestion('text')} className="w-full">
        <Plus className="h-4 w-4" />
        Agregar pregunta a esta sección
      </Button>
    </div>
  );
}
