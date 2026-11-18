import { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import {
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ExternalLink,
  KeyRound,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import {
  PROVIDER_META,
  getDefaultProvider,
  getEffectiveAiConfig,
  getEnvProviderConfig,
  resolveProviderConfig,
  useAiSettingsStore,
  type AiProvider,
  type ProviderCredentials,
} from '../../store/aiSettingsStore';
import { testAiConnection } from '../../lib/aiClient';

const CUSTOM_MODEL_OPTION = '__custom__';

interface ProviderDraft {
  apiKey: string;
  selectedPreset: string;
  customModel: string;
}

function buildDraft(
  provider: AiProvider,
  custom: ProviderCredentials,
  extraModelIds: string[] = []
): ProviderDraft {
  const meta = PROVIDER_META[provider];
  const env = getEnvProviderConfig(provider);
  const activeModel = custom.model || env.model || meta.defaultModel;
  const knownIds = new Set([
    ...meta.presets.map((p) => p.value),
    ...extraModelIds,
  ]);

  if (knownIds.has(activeModel)) {
    return {
      apiKey: custom.apiKey,
      selectedPreset: activeModel,
      customModel: '',
    };
  }
  return {
    apiKey: custom.apiKey,
    selectedPreset: CUSTOM_MODEL_OPTION,
    customModel: activeModel,
  };
}

export function AiSettingsModal() {
  const open = useAiSettingsStore((s) => s.settingsModalOpen);
  const close = useAiSettingsStore((s) => s.closeSettingsModal);
  const customProvider = useAiSettingsStore((s) => s.customProvider);
  const customProviders = useAiSettingsStore((s) => s.providers);
  const saveAllSettings = useAiSettingsStore((s) => s.saveAllSettings);
  const clearCustomSettings = useAiSettingsStore((s) => s.clearCustomSettings);

  const [draftProvider, setDraftProvider] = useState<AiProvider>('openrouter');
  const [drafts, setDrafts] = useState<Record<AiProvider, ProviderDraft>>({
    openrouter: buildDraft('openrouter', { apiKey: '', model: '' }),
    groq: buildDraft('groq', { apiKey: '', model: '' }),
  });
  const [liveGroqModels, setLiveGroqModels] = useState<string[]>([]);
  const [showKey, setShowKey] = useState(false);

  const [testing, setTesting] = useState(false);
  const [testSuccess, setTestSuccess] = useState('');
  const [testError, setTestError] = useState('');

  useEffect(() => {
    if (!open) return;
    const effective = getEffectiveAiConfig();
    setDraftProvider(effective.provider);
    setDrafts({
      openrouter: buildDraft('openrouter', customProviders.openrouter),
      groq: buildDraft('groq', customProviders.groq, liveGroqModels),
    });
    setShowKey(false);
    setTestSuccess('');
    setTestError('');
  }, [open, customProvider, customProviders]);

  const currentMeta = PROVIDER_META[draftProvider];
  const currentEnv = getEnvProviderConfig(draftProvider);
  const currentDraft = drafts[draftProvider];
  const currentEffective = resolveProviderConfig(draftProvider, customProviders);

  const presetIds = new Set(currentMeta.presets.map((p) => p.value));
  const extraModels =
    draftProvider === 'groq'
      ? liveGroqModels.filter((id) => !presetIds.has(id))
      : [];

  const modelOptions = [
    ...currentMeta.presets.map((m) => ({ value: m.value, label: m.label })),
    ...extraModels.map((id) => ({ value: id, label: `${id} (disponible en cuenta)` })),
    { value: CUSTOM_MODEL_OPTION, label: 'Otro modelo (ingresar ID manualmente)...' },
  ];

  function updateCurrentDraft(patch: Partial<ProviderDraft>) {
    setDrafts((prev) => ({
      ...prev,
      [draftProvider]: { ...prev[draftProvider], ...patch },
    }));
  }

  async function handleTestConnection() {
    const keyToTest = currentDraft.apiKey.trim() || currentEnv.apiKey;
    setTesting(true);
    setTestSuccess('');
    setTestError('');
    try {
      const result = await testAiConnection(draftProvider, keyToTest);
      if (draftProvider === 'groq' && result.availableModels?.length) {
        setLiveGroqModels(result.availableModels);
      }
      setTestSuccess(result.summary);
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'No se pudo verificar la API key');
    } finally {
      setTesting(false);
    }
  }

  function resolveModelToSave(provider: AiProvider, draft: ProviderDraft): string {
    const meta = PROVIDER_META[provider];
    const env = getEnvProviderConfig(provider);
    const defaultModel = env.model || meta.defaultModel;
    const chosen =
      draft.selectedPreset === CUSTOM_MODEL_OPTION
        ? draft.customModel.trim() || defaultModel
        : draft.selectedPreset;
    return chosen === defaultModel ? '' : chosen;
  }

  function handleSave() {
    saveAllSettings(draftProvider, {
      openrouter: {
        apiKey: drafts.openrouter.apiKey.trim(),
        model: resolveModelToSave('openrouter', drafts.openrouter),
      },
      groq: {
        apiKey: drafts.groq.apiKey.trim(),
        model: resolveModelToSave('groq', drafts.groq),
      },
    });
    close();
  }

  function handleResetToEnv() {
    clearCustomSettings();
    const fallbackProvider = getDefaultProvider();
    setDraftProvider(fallbackProvider);
    setDrafts({
      openrouter: buildDraft('openrouter', { apiKey: '', model: '' }),
      groq: buildDraft('groq', { apiKey: '', model: '' }, liveGroqModels),
    });
    setTestSuccess('');
    setTestError('');
  }

  const hasAnyCustomSetting = Boolean(
    customProvider ||
      customProviders.openrouter.apiKey ||
      customProviders.openrouter.model ||
      customProviders.groq.apiKey ||
      customProviders.groq.model
  );

  const keyBadge =
    currentEffective.apiKeySource === 'local'
      ? { text: 'Clave personalizada (este navegador)', classes: 'bg-brand-50 text-brand-700 border-brand-200' }
      : currentEffective.apiKeySource === 'env'
        ? { text: 'Clave configurada desde .env', classes: 'bg-green-50 text-green-700 border-green-200' }
        : { text: `Sin API key de ${currentMeta.label}`, classes: 'bg-amber-50 text-amber-800 border-amber-200' };

  return (
    <Modal open={open} onClose={close} title="Configuración de IA" zIndexClass="z-[60]">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-ink-muted">Proveedor de IA</label>
          <div className="grid grid-cols-2 gap-2">
            {(['openrouter', 'groq'] as AiProvider[]).map((p) => {
              const meta = PROVIDER_META[p];
              const isSelected = draftProvider === p;
              const hasKey = Boolean(drafts[p].apiKey.trim() || getEnvProviderConfig(p).apiKey);
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setDraftProvider(p);
                    setTestSuccess('');
                    setTestError('');
                    setShowKey(false);
                  }}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    isSelected
                      ? 'border-brand-600 bg-brand-50 text-brand-700'
                      : 'border-sand-300 bg-white text-ink-muted hover:border-sand-400 hover:bg-sand-50'
                  }`}
                >
                  <span>{meta.label}</span>
                  <span
                    className={`h-2 w-2 rounded-full ${hasKey ? 'bg-state-success' : 'bg-sand-300'}`}
                    title={hasKey ? 'API key configurada' : 'Sin API key'}
                  />
                </button>
              );
            })}
          </div>
        </div>

        <div className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs ${keyBadge.classes}`}>
          <div className="flex items-center gap-2 font-medium">
            <KeyRound className="h-4 w-4 shrink-0" />
            <span>{keyBadge.text}</span>
          </div>
          <span className="font-mono text-[11px] opacity-80 truncate max-w-[180px]">
            {currentEffective.model}
          </span>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label htmlFor="ai-provider-api-key" className="block text-sm font-medium text-ink-muted">
              API Key de {currentMeta.label}
            </label>
            <a
              href={currentMeta.keysUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 hover:underline"
            >
              Obtener clave
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="relative">
            <input
              id="ai-provider-api-key"
              type={showKey ? 'text' : 'password'}
              value={currentDraft.apiKey}
              onChange={(e) => {
                updateCurrentDraft({ apiKey: e.target.value });
                setTestSuccess('');
                setTestError('');
              }}
              placeholder={
                currentEnv.apiKey
                  ? `Usando ${currentMeta.envKeyName} de .env (escribe aquí para sobrescribir)`
                  : currentMeta.keyPlaceholder
              }
              autoComplete="off"
              className="block w-full rounded-lg border border-sand-400 pl-3 pr-10 py-2 text-sm shadow-sm transition-colors placeholder:text-ink-light/70 focus:outline-none focus:ring-2 focus:ring-brand-500/25 focus:border-brand-600 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowKey((prev) => !prev)}
              aria-label={showKey ? 'Ocultar API key' : 'Mostrar API key'}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Se guarda localmente en este navegador. Si lo dejas vacío, se usará{' '}
            <code className="px-1 py-0.5 bg-gray-100 rounded text-[11px]">{currentMeta.envKeyName}</code> del entorno.
          </p>
        </div>

        <Select
          id="ai-provider-model-preset"
          label={`Modelo de ${currentMeta.label}`}
          value={currentDraft.selectedPreset}
          onChange={(e) => updateCurrentDraft({ selectedPreset: e.target.value })}
          options={modelOptions}
        />

        {currentDraft.selectedPreset === CUSTOM_MODEL_OPTION && (
          <Input
            id="ai-provider-custom-model"
            label={`ID del modelo en ${currentMeta.label}`}
            value={currentDraft.customModel}
            onChange={(e) => updateCurrentDraft({ customModel: e.target.value })}
            placeholder={
              draftProvider === 'groq'
                ? 'Ej: openai/gpt-oss-120b'
                : 'Ej: meta-llama/llama-3.3-70b-instruct:free'
            }
          />
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <Button
            type="button"
            variant="secondary"
            className="px-3 py-1.5 text-xs"
            onClick={handleTestConnection}
            disabled={testing || !(currentDraft.apiKey.trim() || currentEnv.apiKey)}
          >
            {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {testing ? 'Verificando...' : 'Probar conexión'}
          </Button>

          {hasAnyCustomSetting && (
            <Button type="button" variant="ghost" className="px-3 py-1.5 text-xs" onClick={handleResetToEnv}>
              <RotateCcw className="h-3.5 w-3.5" />
              Restablecer valores por defecto
            </Button>
          )}
        </div>

        {testSuccess && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-green-50 border border-green-200 text-xs text-green-800">
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
            <span>{testSuccess}</span>
          </div>
        )}

        {testError && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <span>{testError}</span>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t">
          <Button type="button" variant="ghost" onClick={close}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave}>
            Guardar y usar {currentMeta.label}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
