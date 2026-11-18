import { useState } from 'react';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import type { RespondentInfo } from '../../types/response';
import { FileText, ArrowRight } from 'lucide-react';

interface RespondentFormProps {
  formTitle: string;
  onStart: (respondent: RespondentInfo) => void;
}

export function RespondentForm({ formTitle, onStart }: RespondentFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors: { name?: string; email?: string } = {};

    if (!name.trim()) newErrors.name = 'El nombre es obligatorio';
    if (!email.trim()) newErrors.email = 'El correo es obligatorio';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = 'Correo inválido';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onStart({ name: name.trim(), email: email.trim() });
  }

  return (
    <Card className="p-8 w-full max-w-md mx-auto animate-editorial-in space-y-6">
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-brand-50 border border-brand-100 text-brand-700 text-[11px] font-mono uppercase tracking-wider">
          <FileText className="h-3.5 w-3.5" />
          Evaluación en línea
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink leading-tight">{formTitle}</h1>
        <p className="text-sm text-ink-subtle">Ingresa tus datos de identificación para comenzar el examen.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nombre y apellido"
          placeholder="Tu nombre completo"
          value={name}
          error={errors.name}
          onChange={(e) => { setName(e.target.value); setErrors((prev) => ({ ...prev, name: undefined })); }}
        />
        <Input
          label="Correo electrónico"
          type="email"
          placeholder="alumno@institucion.edu"
          value={email}
          error={errors.email}
          onChange={(e) => { setEmail(e.target.value); setErrors((prev) => ({ ...prev, email: undefined })); }}
        />
        <Button type="submit" className="w-full justify-center py-2.5">
          Comenzar examen
          <ArrowRight className="h-4 w-4" />
        </Button>
      </form>
    </Card>
  );
}
