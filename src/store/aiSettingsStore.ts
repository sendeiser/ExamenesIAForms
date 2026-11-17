import { create } from 'zustand';

export const DEFAULT_OPENROUTER_MODEL = 'openrouter/free';
export const STORAGE_KEY_API_KEY = 'openrouter_api_key';
export const STORAGE_KEY_MODEL = 'openrouter_model';

export const OPENROUTER_PRESET_MODELS = [
  { value: 'openrouter/free', label: 'Modelos gratuitos (automático — openrouter/free)' },
  { value: 'google/gemini-2.5-flash', label: 'Google: Gemini 2.5 Flash' },
  { value: 'google/gemini-2.5-flash-lite', label: 'Google: Gemini 2.5 Flash Lite' },
  { value: 'openai/gpt-4o-mini', label: 'OpenAI: GPT-4o mini' },
  { value: 'anthropic/claude-3.5-sonnet', label: 'Anthropic: Claude 3.5 Sonnet' },
  { value: 'deepseek/deepseek-chat', label: 'DeepSeek: Chat' },
] as const;

function readStorage(key: string): string {
  try {
    return localStorage.getItem(key)?.trim() ?? '';
  } catch {
    return '';
  }
}

function writeStorage(key: string, value: string): void {
  try {
    if (value) {
      localStorage.setItem(key, value);
    } else {
      localStorage.removeItem(key);
    }
  } catch {
    // Ignorar errores de almacenamiento (ej. navegación privada restringida)
  }
}

export function getEnvOpenRouterApiKey(): string {
  return (import.meta.env.VITE_OPENROUTER_API_KEY ?? '').trim();
}

export function getEnvOpenRouterModel(): string {
  return (import.meta.env.VITE_OPENROUTER_MODEL ?? '').trim();
}

export interface OpenRouterConfig {
  apiKey: string;
  model: string;
  apiKeySource: 'local' | 'env' | 'none';
  modelSource: 'local' | 'env' | 'default';
}

interface AiSettingsState {
  customApiKey: string;
  customModel: string;
  settingsModalOpen: boolean;
  openSettingsModal: () => void;
  closeSettingsModal: () => void;
  saveSettings: (apiKey: string, model: string) => void;
  clearCustomSettings: () => void;
}

export const useAiSettingsStore = create<AiSettingsState>((set) => ({
  customApiKey: readStorage(STORAGE_KEY_API_KEY),
  customModel: readStorage(STORAGE_KEY_MODEL),
  settingsModalOpen: false,

  openSettingsModal: () => set({ settingsModalOpen: true }),
  closeSettingsModal: () => set({ settingsModalOpen: false }),

  saveSettings: (apiKey, model) => {
    const cleanKey = apiKey.trim();
    const cleanModel = model.trim();
    writeStorage(STORAGE_KEY_API_KEY, cleanKey);
    writeStorage(STORAGE_KEY_MODEL, cleanModel);
    set({ customApiKey: cleanKey, customModel: cleanModel });
  },

  clearCustomSettings: () => {
    writeStorage(STORAGE_KEY_API_KEY, '');
    writeStorage(STORAGE_KEY_MODEL, '');
    set({ customApiKey: '', customModel: '' });
  },
}));

/** Resuelve la configuración efectiva de OpenRouter (localStorage > .env > valores por defecto). */
export function getEffectiveOpenRouterConfig(): OpenRouterConfig {
  const { customApiKey, customModel } = useAiSettingsStore.getState();
  const envKey = getEnvOpenRouterApiKey();
  const envModel = getEnvOpenRouterModel();

  const apiKey = customApiKey || envKey;
  const apiKeySource: OpenRouterConfig['apiKeySource'] = customApiKey
    ? 'local'
    : envKey
      ? 'env'
      : 'none';

  const model = customModel || envModel || DEFAULT_OPENROUTER_MODEL;
  const modelSource: OpenRouterConfig['modelSource'] = customModel
    ? 'local'
    : envModel
      ? 'env'
      : 'default';

  return { apiKey, model, apiKeySource, modelSource };
}
