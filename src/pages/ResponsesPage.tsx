import { useParams, Link } from 'react-router-dom';
import { useEditorStore } from '../store/editorStore';
import { useResponses } from '../hooks/useResponses';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ArrowLeft } from 'lucide-react';
import { useEffect } from 'react';

export default function ResponsesPage() {
  const { formId } = useParams<{ formId: string }>();
  const form = useEditorStore((s) => s.form);
  const loadForm = useEditorStore((s) => s.loadForm);
  const { responses, loading } = useResponses(formId!);

  useEffect(() => { if (formId) loadForm(formId); }, [formId]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={`/form/${formId}`}>
            <Button variant="ghost"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <h1 className="text-xl font-bold">{form?.title ?? 'Respuestas'}</h1>
        </div>
      </div>

      <Card className="p-4">
        <div className="text-sm text-gray-500 mb-4">{responses.length} respuesta(s)</div>
        {responses.length === 0 ? (
          <p className="text-center py-8 text-gray-400">Aún no hay respuestas</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-4 font-medium">Fecha</th>
                  <th className="py-2 pr-4 font-medium">Nombre</th>
                  <th className="py-2 pr-4 font-medium">Email</th>
                  <th className="py-2 font-medium">Respuesta</th>
                </tr>
              </thead>
              <tbody>
                {responses.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 text-gray-500">{r.submittedAt?.toLocaleString()}</td>
                    <td className="py-2 pr-4">{r.respondent?.name ?? '—'}</td>
                    <td className="py-2 pr-4">{r.respondent?.email ?? r.respondentEmail ?? '—'}</td>
                    <td className="py-2 text-gray-600 truncate max-w-xs">
                      {Object.values(r.answers).filter(Boolean).join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
