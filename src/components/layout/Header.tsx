import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { KeyRound, LogOut, User as UserIcon } from 'lucide-react';
import {
  PROVIDER_META,
  getEffectiveAiConfig,
  useAiSettingsStore,
} from '../../store/aiSettingsStore';

export function Header() {
  const { user, logout } = useAuth();
  const customProvider = useAiSettingsStore((s) => s.customProvider);
  const providers = useAiSettingsStore((s) => s.providers);
  const openSettingsModal = useAiSettingsStore((s) => s.openSettingsModal);
  const { provider, apiKey } = getEffectiveAiConfig({ customProvider, providers });
  const hasApiKey = Boolean(apiKey);
  const providerLabel = PROVIDER_META[provider].label;

  return (
    <header className="bg-canvas/90 backdrop-blur-xl border-b border-sand-300 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <Link to="/" className="flex items-center gap-2.5 group">
            <span className="w-9 h-9 rounded-lg bg-brand-600 text-white flex items-center justify-center font-display font-bold text-base tracking-tight shadow-sm transition-transform group-hover:scale-95">
              Ex
            </span>
            <span className="flex flex-col">
              <span className="font-display font-bold text-lg text-brand-600 leading-none tracking-tight">
                Exámenes
              </span>
              <span className="text-[10px] font-mono uppercase tracking-widest text-ink-light mt-0.5 hidden sm:block">
                Atelier Académico
              </span>
            </span>
          </Link>

          {user && (
            <>
              <span className="h-5 w-px bg-sand-300 hidden sm:block" />
              <button
                type="button"
                onClick={openSettingsModal}
                title={`Configurar API key y modelo de IA (actual: ${providerLabel})`}
                aria-label="Configurar IA"
                className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-sand-200/80 hover:bg-sand-300/70 border border-sand-300 text-xs font-mono font-medium text-ink-subtle transition-colors"
              >
                <span className="relative flex items-center">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      hasApiKey ? 'bg-state-success' : 'bg-state-warning'
                    }`}
                  />
                </span>
                <KeyRound className="h-3.5 w-3.5 text-ink-light sm:hidden" />
                <span className="hidden sm:inline">API IA · {providerLabel}</span>
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {user && (
            <>
              <div className="hidden md:flex items-center gap-2.5 px-2.5 py-1 rounded-full bg-white border border-sand-300 shadow-sm">
                <span className="w-6 h-6 rounded-full bg-brand-600 text-white flex items-center justify-center">
                  <UserIcon className="h-3.5 w-3.5" />
                </span>
                <span className="text-xs font-medium text-ink max-w-[180px] truncate">
                  {user.displayName || user.email}
                </span>
              </div>
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-ink-subtle hover:text-terracotta-600 hover:bg-terracotta-50 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Salir</span>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
