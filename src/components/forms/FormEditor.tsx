import { HeaderCard } from './HeaderCard';
import { QuestionToolbar } from './QuestionToolbar';
import { SectionsManager } from './SectionsManager';

export function FormEditor() {
  return (
    <div className="space-y-4">
      <HeaderCard />
      <QuestionToolbar />
      <SectionsManager />
      <QuestionToolbar />
    </div>
  );
}
