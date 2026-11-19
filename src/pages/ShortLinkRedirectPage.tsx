import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams, Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { resolveFormIdByShortCode, normalizeShortCode } from '../lib/shortLink';
import { ArrowRight, KeyRound, AlertCircle } from 'lucide-react';

export default function ShortLinkRedirectPage() {
  const { code } = useParams<{ code: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const [checking, setChecking] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [manualCode, setManualCode] = useState(code ?? '');

  useEffect(() => {
    let active = true;

    async function lookup() {
      if (!code) {
        setChecking(false);
        setNotFound(true);
        return;
      }

      setChecking(true);
      setNotFound(false);
      const formId = await resolveFormIdByShortCode(code);
      if (!active) return;

      if (formId) {
        navigate(`/view/${formId}${location.search}`, { replace: true });
      } else {
        setChecking(false);
        setNotFound(true);
      }
    }

    lookup();
    return () => {
      active = false;
    };
  }, [code, location.search, navigate]);

  function handleRetrySubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = normalizeShortCode(manualCode);
    if (!cleaned) return;
    navigate(`/e/${cleaned}${location.search}`, { replace: true });
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-paper-grid flex flex-col items-center justify-center p-4 gap-3">
        <LoadingSpinner />
        <p className="text-sm text-ink-subtle font-mono">Buscando examen "{normalizeShortCode(code ?? '')}"...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper-grid flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 sm:p-8 space-y-5 animate-editorial-in">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 border border-red-200">
            <AlertCircle className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-lg font-bold text-ink">Código no encontrado</h1>
            <p className="text-sm text-ink-subtle mt-0.5">
              No encontramos un examen activo con el código{' '}
              <span className="font-mono font-bold text-ink">{normalizeShortCode(code ?? '')}</span>.
            </p>
          </div>
        </div>

        <form onSubmit={handleRetrySubmit} className="space-y-3">
          <label className="block text-xs font-semibold text-ink-light uppercase tracking-wider">
            Probar con otro código de examen
          </label>
          <div className="flex gap-2">
            <Input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.toUpperCase())}
              placeholder="Ej: MATE1"
              className="font-mono uppercase tracking-widest text-center font-bold"
            />
            <Button type="submit" disabled={!normalizeShortCode(manualCode)}>
              Ir
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </form>

        <div className="pt-2 border-t border-sand-200 flex items-center justify-between text-xs text-ink-subtle">
          <span className="inline-flex items-center gap-1">
            <KeyRound className="h-3.5 w-3.5" />
            Pide el código al docente
          </span>
          <Link to="/login" className="text-brand-600 font-medium hover:underline">
            Ir al inicio
          </Link>
        </div>
      </Card>
    </div>
  );
}
