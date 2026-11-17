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
  DEFAULT_OPENROUTER_MODEL,
  OPENROUTER_PRESET_MODELS,
  getEffectiveOpenRouterConfig,
  getEnvOpenRouterApiKey,
  getEnvOpenRouterModel,
  useAiSettingsStore,
} from '../../store/aiSettingsStore';
import { testOpenRouterConnection } from '../../lib/openrouter';

const CUSTOM_MODEL_OPTION = '__custom__';

function isPresetModel(modelId: string): boolean {
  return OPENROUTER_PRESET_MODELS.some((m) => m.value === modelId);
}

export function AiSettingsModal() {
  const open = useAiSettingsStore((s) => s.settingsModalOpen);
  const close = useAiSettingsStore((s) => s.closeSettingsModal);
  const customApiKey = useAiSettingsStore((s) => s.customApiKey);
  const customModel = useAiSettingsStore((s) => s.customModel);
  const saveSettings = useAiSettingsStore((s) => s.saveSettings);
  const clearCustomSettings = useAiSettingsStore((s) => s.clearCustomSettings);

  const [draftKey, setDraftKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>(DEFAULT_OPENROUTER_MODEL);
  const [customModelInput, setCustomModelInput] = useState('');

  const [testing, setTesting] = useState(false);
  const [testSuccess, setTestSuccess] = useState('');
  const [testError, setTestError] = useState('');

  const envKey = getEnvOpenRouterApiKey();
  const envModel = getEnvOpenRouterModel();
  const effectiveConfig = getEffectiveOpenRouterConfig();

  useEffect(() => {
    if (!open) return;
    const activeModel = customModel || envModel || DEFAULT_OPENROUTER_MODEL;
    setDraftKey(customApiKey);
    setShowKey(false);
    setTestSuccess('');
    setTestError('');

    if (isPresetModel(activeModel)) {
      setSelectedPreset(activeModel);
      setCustomModelInput('');
    } else {
      setSelectedPreset(CUSTOM_MODEL_OPTION);
      setCustomModelInput(activeModel);
    }
  }, [open, customApiKey, customModel, envModel]);

  const resolvedDraftModel =
    selectedPreset === CUSTOM_MODEL_OPTION
      ? customModelInput.trim() || DEFAULT_OPENROUTER_MODEL
      : selectedPreset;

  async function handleTestConnection() {
    const keyToTest = draftKey.trim() || envKey;
    setTesting(true);
    setTestSuccess('');
    setTestError('');
    try {
      const status = await testOpenRouterConnection(keyToTest);
      const details: string[] = [];
      if (status.label) details.push(`Clave: ${status.label}`);
      if (status.limitRemaining !== null) {
        details.push(`Saldo restante: $${status.limitRemaining.toFixed(4)}`);
      } else if (status.isFreeTier) {
        details.push('Plan gratuito activo');
      }
      setTestSuccess(
        details.length > 0 ? `Conexión exitosa (${details.join(' · ')})` : 'API key válida y activa.'
      );
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'No se pudo verificar la API key');
    } finally {
      setTesting(false);
    }
  }

  function handleSave() {
    const defaultModel = envModel || DEFAULT_OPENROUTER_MODEL;
    const modelToSave = resolvedDraftModel === defaultModel ? '' : resolvedDraftModel;
    saveSettings(draftKey, modelToSave);
    close();
  }

  function handleResetToEnv() {
    clearCustomSettings();
    setDraftKey('');
    const fallbackModel = envModel || DEFAULT_OPENROUTER_MODEL;
    if (isPresetModel(fallbackModel)) {
      setSelectedPreset(fallbackModel);
      setCustomModelInput('');
    } else {
      setSelectedPreset(CUSTOM_MODEL_OPTION);
      setCustomModelInput(fallbackModel);
    }
    setTestSuccess('');
    setTestError('');
  }

  const keyBadge =
    effectiveConfig.apiKeySource === 'local'
      ? { text: 'Clave personalizada (este navegador)', classes: 'bg-indigo-50 text-indigo-700 border-indigo-200' }
      : effectiveConfig.apiKeySource === 'env'
        ? { text: 'Clave configurada desde .env', classes: 'bg-green-50 text-green-700 border-green-200' }
        : { text: 'Sin API key configurada', classes: 'bg-amber-50 text-amber-800 border-amber-200' };

  return (
    <Modal open={open} onClose={close} title="Configuración de IA (OpenRouter)" zIndexClass="z-[60]">
      <div className="space-y-4">
        <div className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs ${keyBadge.classes}`}>
          <div className="flex items-center gap-2 font-medium">
            <KeyRound className="h-4 w-4 shrink-0" />
            <span>{keyBadge.text}</span>
          </div>
          <span className="font-mono text-[11px] opacity-80 truncate max-w-[180px]">
            {effectiveConfig.model}
          </span>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label htmlFor="openrouter-api-key" className="block text-sm font-medium text-gray-700">
              API Key de OpenRouter
            </label>
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 hover:underline"
            >
              Obtener clave
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="relative">
            <input
              id="openrouter-api-key"
              type={showKey ? 'text' : 'password'}
              value={draftKey}
              onChange={(e) => {
                setDraftKey(e.target.value);
                setTestSuccess('');
                setTestError('');
              }}
              placeholder={
                envKey
                  ? 'Usando VITE_OPENROUTER_API_KEY de .env (escribe aquí para sobrescribir)'
                  : 'sk-or-v1-...'
              }
              autoComplete="off"
              className="block w-full rounded-lg border border-gray-300 pl-3 pr-10 py-2 text-sm shadow-sm transition-colors placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
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
            <code className="px-1 py-0.5 bg-gray-100 rounded text-[11px]">VITE_OPENROUTER_API_KEY</code> del entorno.
          </p>
        </div>

        <Select
          id="openrouter-model-preset"
          label="Modelo de IA"
          value={selectedPreset}
          onChange={(e) => setSelectedPreset(e.target.value)}
          options={[
            ...OPENROUTER_PRESET_MODELS.map((m) => ({ value: m.value, label: m.label })),
            { value: CUSTOM_MODEL_OPTION, label: 'Otro modelo (ingresar ID manualmente)...' },
          ]}
        />

        {selectedPreset === CUSTOM_MODEL_OPTION && (
          <Input
            id="openrouter-custom-model"
            label="ID del modelo en OpenRouter"
            value={customModelInput}
            onChange={(e) => setCustomModelInput(e.target.value)}
            placeholder="Ej: meta-llama/llama-3.3-70b-instruct:free"
          />
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <Button
            type="button"
            variant="secondary"
            className="px-3 py-1.5 text-xs"
            onClick={handleTestConnection}
            disabled={testing || !(draftKey.trim() || envKey)}
          >
            {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {testing ? 'Verificando...' : 'Probar conexión'}
          </Button>

          {(customApiKey || customModel) && (
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
            Guardar configuración
          </Button>
        </div>
      </div>
    </Modal>
  );
}
