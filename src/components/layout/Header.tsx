import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/Button';
import { FileText, KeyRound, LogOut } from 'lucide-react';
import { getEnvOpenRouterApiKey, useAiSettingsStore } from '../../store/aiSettingsStore';

export function Header() {
  const { user, logout } = useAuth();
  const customApiKey = useAiSettingsStore((s) => s.customApiKey);
  const openSettingsModal = useAiSettingsStore((s) => s.openSettingsModal);
  const hasApiKey = Boolean(customApiKey || getEnvOpenRouterApiKey());

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-xl text-brand-600">
          <FileText className="h-6 w-6" />
          Exámenes
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
          {user && (
            <>
              <Button
                variant="secondary"
                className="px-3 py-1.5 text-xs"
                onClick={openSettingsModal}
                title="Configurar API key y modelo de OpenRouter"
                aria-label="Configurar IA"
              >
                <span className="relative flex items-center">
                  <KeyRound className="h-4 w-4" />
                  <span
                    className={`absolute -top-1 -right-1 h-2 w-2 rounded-full ${
                      hasApiKey ? 'bg-green-500' : 'bg-amber-500'
                    }`}
                  />
                </span>
                <span className="hidden sm:inline">API IA</span>
              </Button>
              <span className="text-sm text-gray-600 hidden sm:block">{user.displayName || user.email}</span>
              <Button variant="ghost" onClick={logout}>
                <LogOut className="h-4 w-4" />
                Salir
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
