import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useEditorStore } from '../store/editorStore';
import { FormEditor } from '../components/forms/FormEditor';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Toggle } from '../components/ui/Toggle';
import { ThemeEditor } from '../components/forms/ThemeEditor';
import { ShareModal } from '../components/forms/ShareModal';
import { Eye, BarChart3, Share2 } from 'lucide-react';

export default function FormBuilderPage() {
  const { formId } = useParams<{ formId: string }>();
  const form = useEditorStore((s) => s.form);
  const updateForm = useEditorStore((s) => s.updateForm);
  const loadForm = useEditorStore((s) => s.loadForm);
  const loading = useEditorStore((s) => s.loading);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    if (formId) loadForm(formId);
  }, [formId]);

  if (loading || !form) return <LoadingSpinner />;

  const previewUrl = `${window.location.origin}/view/${form.id}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Input
          value={form.title}
          onChange={(e) => updateForm({ title: e.target.value })}
          className="text-2xl font-bold border-0 px-0 focus:ring-0 w-full max-w-lg"
        />
        <Toggle
          label="Modo examen"
          checked={form.settings.isQuiz}
          onChange={(checked) => updateForm({ settings: { ...form.settings, isQuiz: checked } })}
        />
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => window.open(previewUrl, '_blank')}>
            <Eye className="h-4 w-4" />
            Vista previa
          </Button>
          <Button variant="secondary" onClick={() => setShareOpen(true)}>
            <Share2 className="h-4 w-4" />
            Compartir
          </Button>
          <Link to={`/form/${form.id}/analytics`}>
            <Button variant="secondary">
              <BarChart3 className="h-4 w-4" />
              Respuestas
            </Button>
          </Link>
        </div>
      </div>
      <ThemeEditor />
      <FormEditor />
      <ShareModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        formId={form.id}
        formTitle={form.title}
      />
    </div>
  );
}
