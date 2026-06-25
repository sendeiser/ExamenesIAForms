import { useState } from 'react';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import type { RespondentInfo } from '../../types/response';

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
    <Card className="p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-2">{formTitle}</h1>
      <p className="text-gray-600 mb-6">Ingresa tus datos para comenzar</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nombre completo"
          placeholder="Tu nombre"
          value={name}
          error={errors.name}
          onChange={(e) => { setName(e.target.value); setErrors((prev) => ({ ...prev, name: undefined })); }}
        />
        <Input
          label="Correo electrónico"
          type="email"
          placeholder="tu@correo.com"
          value={email}
          error={errors.email}
          onChange={(e) => { setEmail(e.target.value); setErrors((prev) => ({ ...prev, email: undefined })); }}
        />
        <Button type="submit" className="w-full">Comenzar examen</Button>
      </form>
    </Card>
  );
}
