import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useForms } from '../hooks/useForms';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Plus, FileText, Trash2, Eye, EyeOff, BarChart3 } from 'lucide-react';

export default function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { forms, loading, createForm, deleteForm, togglePublish } = useForms();
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');

  const handleCreate = async () => {
    if (!user || !title.trim()) return;
    const id = await createForm(user.uid, title.trim());
    setTitle('');
    setShowCreate(false);
    navigate(`/form/${id}`);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Mis formularios</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          Nuevo formulario
        </Button>
      </div>

      {forms.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No tienes formularios</h3>
          <p className="text-gray-500 mb-4">Crea tu primer formulario para empezar</p>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            Crear formulario
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {forms.map((form) => (
            <Card key={form.id} className="p-5 hover:shadow-md transition-shadow cursor-pointer">
              <div onClick={() => navigate(`/form/${form.id}`)}>
                <h3 className="font-semibold text-gray-900 truncate">{form.title}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {form.published ? 'Publicado' : 'Borrador'} ·{' '}
                  {new Date(form.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                <Button variant="ghost" onClick={() => togglePublish(form.id, !form.published)}>
                  {form.published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" onClick={() => navigate(`/form/${form.id}/analytics`)}>
                  <BarChart3 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" onClick={() => deleteForm(form.id)}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nuevo formulario">
        <div className="space-y-4">
          <Input
            label="Título"
            placeholder="Ej: Examen de matemáticas"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!title.trim()}>Crear</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
