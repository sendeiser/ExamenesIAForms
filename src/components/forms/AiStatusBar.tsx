import { KeyRound, Settings2 } from 'lucide-react';
import {
  PROVIDER_META,
  getEffectiveAiConfig,
  useAiSettingsStore,
} from '../../store/aiSettingsStore';

export function AiStatusBar() {
  const customProvider = useAiSettingsStore((s) => s.customProvider);
  const providers = useAiSettingsStore((s) => s.providers);
  const openSettingsModal = useAiSettingsStore((s) => s.openSettingsModal);

  const { provider, apiKey, model } = getEffectiveAiConfig({
    customProvider,
    providers,
  });
  const providerLabel = PROVIDER_META[provider].label;

  if (!apiKey) {
    return (
      <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 shrink-0 text-amber-600" />
          <span>Falta configurar la API key de {providerLabel}.</span>
        </div>
        <button
          type="button"
          onClick={openSettingsModal}
          className="font-semibold underline hover:text-amber-950 shrink-0"
        >
          Configurar ahora
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-sand-100 border border-sand-300 text-xs text-ink-subtle">
      <div className="truncate">
        <span className="font-medium text-ink">{providerLabel}</span> ·{' '}
        <span className="font-mono text-ink-muted">{model}</span>
      </div>
      <button
        type="button"
        onClick={openSettingsModal}
        className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-700 font-medium shrink-0"
      >
        <Settings2 className="h-3.5 w-3.5" />
        Cambiar
      </button>
    </div>
  );
}
