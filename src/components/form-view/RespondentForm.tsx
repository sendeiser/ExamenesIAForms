import { useState } from 'react';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import type { RespondentInfo } from '../../types/response';
import { FileText, ArrowRight, Award, Search, CheckCircle2, Loader2 } from 'lucide-react';

interface RespondentFormProps {
  formTitle: string;
  onStart: (respondent: RespondentInfo) => void;
  hasSavedResult?: boolean;
  onViewSavedResult?: () => void;
  onLookupResult?: (queryText: string) => Promise<void>;
  lookupLoading?: boolean;
  lookupError?: string;
}

export function RespondentForm({
  formTitle,
  onStart,
  hasSavedResult = false,
  onViewSavedResult,
  onLookupResult,
  lookupLoading = false,
  lookupError = '',
}: RespondentFormProps) {
  const [tab, setTab] = useState<'take' | 'review'>('take');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [lookupQuery, setLookupQuery] = useState('');

  const showReviewTab = Boolean(onLookupResult || onViewSavedResult);

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

  async function handleLookupSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!onLookupResult || !lookupQuery.trim()) return;
    await onLookupResult(lookupQuery);
  }

  return (
    <Card className="p-8 w-full max-w-md mx-auto animate-editorial-in space-y-6">
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-brand-50 border border-brand-100 text-brand-700 text-[11px] font-mono uppercase tracking-wider">
          <FileText className="h-3.5 w-3.5" />
          Evaluación en línea
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink leading-tight">{formTitle}</h1>
        <p className="text-sm text-ink-subtle">
          {tab === 'take'
            ? 'Ingresa tus datos de identificación para comenzar el examen.'
            : 'Consulta tu nota verificada, respuestas y validación del docente.'}
        </p>
      </div>

      {showReviewTab && (
        <div
          className="grid grid-cols-2 rounded-xl border border-sand-300 bg-sand-100 p-1 gap-1"
          role="tablist"
          aria-label="Acción del estudiante"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'take'}
            onClick={() => setTab('take')}
            className={`rounded-lg py-2 px-2.5 text-xs font-semibold transition-all ${
              tab === 'take' ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-subtle hover:text-ink'
            }`}
          >
            Rendir examen
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'review'}
            onClick={() => setTab('review')}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2 px-2.5 text-xs font-semibold transition-all ${
              tab === 'review' ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-subtle hover:text-ink'
            }`}
          >
            <Award className="h-3.5 w-3.5" />
            Ver mi nota y examen
          </button>
        </div>
      )}

      {tab === 'take' ? (
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
      ) : (
        <div className="space-y-4">
          {hasSavedResult && onViewSavedResult && (
            <div className="rounded-xl border border-green-200 bg-green-50/70 p-3.5 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-green-800">
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                <span>Ya entregaste este examen desde este dispositivo</span>
              </div>
              <Button
                type="button"
                onClick={onViewSavedResult}
                className="w-full justify-center !bg-green-600 hover:!bg-green-700"
              >
                Ver mi examen entregado
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {onLookupResult && (
            <form onSubmit={handleLookupSubmit} className="space-y-3">
              <Input
                label="Buscar por correo electrónico o nombre"
                placeholder="Ej: alumno@institucion.edu o María Torres"
                value={lookupQuery}
                onChange={(e) => setLookupQuery(e.target.value)}
              />
              {lookupError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {lookupError}
                </p>
              )}
              <Button
                type="submit"
                variant={hasSavedResult ? 'secondary' : 'primary'}
                disabled={lookupLoading || !lookupQuery.trim()}
                className="w-full justify-center py-2.5"
              >
                {lookupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {lookupLoading ? 'Buscando entrega...' : 'Ver mi nota y examen'}
              </Button>
            </form>
          )}
        </div>
      )}
    </Card>
  );
}
