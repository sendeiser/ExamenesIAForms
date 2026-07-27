import { ShieldAlert, AlertTriangle } from 'lucide-react';

interface SecurityBannerProps {
  violations: number;
  maxViolations: number;
  started: boolean;
}

export function SecurityBanner({ violations, maxViolations, started }: SecurityBannerProps) {
  if (!started) return null;

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
