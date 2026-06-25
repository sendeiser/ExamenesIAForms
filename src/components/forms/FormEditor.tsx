import { HeaderCard } from './HeaderCard';
import { QuestionToolbar } from './QuestionToolbar';
import { SectionsManager } from './SectionsManager';
import { SecuritySettings } from './SecuritySettings';

export function FormEditor() {
  return (
    <div className="space-y-4">
      <HeaderCard />
      <SecuritySettings />
      <QuestionToolbar />
      <SectionsManager />
      <QuestionToolbar />
    </div>
  );
}
