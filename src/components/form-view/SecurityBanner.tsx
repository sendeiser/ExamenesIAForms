import { AlertTriangle, ShieldAlert, Maximize2 } from 'lucide-react';

interface SecurityBannerProps {
  violations: number;
  maxViolations: number;
  onStart?: () => void;
  started: boolean;
}

export function SecurityBanner({ violations, maxViolations, onStart, started }: SecurityBannerProps) {
  if (!started) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center space-y-3">
        <ShieldAlert className="h-10 w-10 text-amber-500 mx-auto" />
        <div>
          <h3 className="font-semibold text-amber-900">Examen supervisado</h3>
          <p className="text-sm text-amber-700 mt-1">
            Este examen tiene medidas de seguridad activadas. No podrás cambiar de pestaña, copiar texto
            ni salir de la pantalla completa. Se permiten máximo {maxViolations} infracciones antes de
            enviar automáticamente.
          </p>
        </div>
        {onStart && (
          <button
            onClick={onStart}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
          >
            <Maximize2 className="h-4 w-4" />
            Iniciar examen en pantalla completa
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-3.5 w-3.5" />
        <span>Examen supervisado</span>
      </div>
      <div className="flex items-center gap-1">
        <AlertTriangle className="h-3.5 w-3.5" />
        <span>Infracciones: {violations}/{maxViolations}</span>
      </div>
    </div>
  );
}
