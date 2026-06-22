import { useEditorStore } from '../../store/editorStore';
import { QuestionToolbar } from './QuestionToolbar';
import { SectionsManager } from './SectionsManager';

export function FormEditor() {
  const addQuestion = useEditorStore((s) => s.addQuestion);
  const addSection = useEditorStore((s) => s.addSection);

  return (
    <div className="space-y-4">
      <QuestionToolbar />
      <SectionsManager />
      <QuestionToolbar />
    </div>
  );
}
