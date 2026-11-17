import { create } from 'zustand';

export type AiProvider = 'openrouter' | 'groq';

export const STORAGE_KEY_PROVIDER = 'ai_provider';

export interface ProviderMeta {
  label: string;
  defaultModel: string;
  keyPlaceholder: string;
  keysUrl: string;
  envKeyName: string;
  storageKeyApi: string;
  storageKeyModel: string;
  presets: ReadonlyArray<{ value: string; label: string }>;
}

export const PROVIDER_META: Record<AiProvider, ProviderMeta> = {
  openrouter: {
    label: 'OpenRouter',
    defaultModel: 'openrouter/free',
    keyPlaceholder: 'sk-or-v1-...',
    keysUrl: 'https://openrouter.ai/keys',
    envKeyName: 'VITE_OPENROUTER_API_KEY',
    storageKeyApi: 'openrouter_api_key',
    storageKeyModel: 'openrouter_model',
    presets: [
      { value: 'openrouter/free', label: 'Modelos gratuitos (automático — openrouter/free)' },
      { value: 'google/gemini-2.5-flash', label: 'Google: Gemini 2.5 Flash' },
      { value: 'google/gemini-2.5-flash-lite', label: 'Google: Gemini 2.5 Flash Lite' },
      { value: 'openai/gpt-4o-mini', label: 'OpenAI: GPT-4o mini' },
      { value: 'anthropic/claude-3.5-sonnet', label: 'Anthropic: Claude 3.5 Sonnet' },
      { value: 'deepseek/deepseek-chat', label: 'DeepSeek: Chat' },
    ],
  },
  groq: {
    label: 'Groq',
    defaultModel: 'openai/gpt-oss-120b',
    keyPlaceholder: 'gsk_...',
    keysUrl: 'https://console.groq.com/keys',
    envKeyName: 'VITE_GROQ_API_KEY',
    storageKeyApi: 'groq_api_key',
    storageKeyModel: 'groq_model',
    presets: [
      { value: 'openai/gpt-oss-120b', label: 'OpenAI GPT-OSS 120B (recomendado)' },
      { value: 'openai/gpt-oss-20b', label: 'OpenAI GPT-OSS 20B (ultra rápido)' },
      { value: 'qwen/qwen3.8-27b', label: 'Qwen 3.8 27B' },
      { value: 'allam-2-7b', label: 'ALLaM 2 7B' },
    ],
  },
};

export interface ProviderCredentials {
  apiKey: string;
  model: string;
}

export interface EffectiveAiConfig {
  provider: AiProvider;
  apiKey: string;
  model: string;
  apiKeySource: 'local' | 'env' | 'none';
  modelSource: 'local' | 'env' | 'default';
}

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

function parseProvider(value: string): AiProvider | '' {
  const normalized = value.trim().toLowerCase();
  return normalized === 'openrouter' || normalized === 'groq' ? normalized : '';
}

export function getEnvProviderConfig(provider: AiProvider): ProviderCredentials {
  if (provider === 'groq') {
    return {
      apiKey: (import.meta.env.VITE_GROQ_API_KEY ?? '').trim(),
      model: (import.meta.env.VITE_GROQ_MODEL ?? '').trim(),
    };
  }
  return {
    apiKey: (import.meta.env.VITE_OPENROUTER_API_KEY ?? '').trim(),
    model: (import.meta.env.VITE_OPENROUTER_MODEL ?? '').trim(),
  };
}

export function getDefaultProvider(): AiProvider {
  const envProvider = parseProvider(import.meta.env.VITE_AI_PROVIDER ?? '');
  if (envProvider) return envProvider;
  if (getEnvProviderConfig('openrouter').apiKey) return 'openrouter';
  if (getEnvProviderConfig('groq').apiKey) return 'groq';
  return 'openrouter';
}

interface AiSettingsState {
  customProvider: AiProvider | '';
  providers: Record<AiProvider, ProviderCredentials>;
  settingsModalOpen: boolean;
  openSettingsModal: () => void;
  closeSettingsModal: () => void;
  saveAllSettings: (
    provider: AiProvider,
    providers: Record<AiProvider, ProviderCredentials>
  ) => void;
  clearCustomSettings: () => void;
}

export const useAiSettingsStore = create<AiSettingsState>((set) => ({
  customProvider: parseProvider(readStorage(STORAGE_KEY_PROVIDER)),
  providers: {
    openrouter: {
      apiKey: readStorage(PROVIDER_META.openrouter.storageKeyApi),
      model: readStorage(PROVIDER_META.openrouter.storageKeyModel),
    },
    groq: {
      apiKey: readStorage(PROVIDER_META.groq.storageKeyApi),
      model: readStorage(PROVIDER_META.groq.storageKeyModel),
    },
  },
  settingsModalOpen: false,

  openSettingsModal: () => set({ settingsModalOpen: true }),
  closeSettingsModal: () => set({ settingsModalOpen: false }),

  saveAllSettings: (provider, nextProviders) => {
    const cleaned: Record<AiProvider, ProviderCredentials> = {
      openrouter: {
        apiKey: nextProviders.openrouter.apiKey.trim(),
        model: nextProviders.openrouter.model.trim(),
      },
      groq: {
        apiKey: nextProviders.groq.apiKey.trim(),
        model: nextProviders.groq.model.trim(),
      },
    };

    writeStorage(STORAGE_KEY_PROVIDER, provider);
    (Object.keys(PROVIDER_META) as AiProvider[]).forEach((p) => {
      writeStorage(PROVIDER_META[p].storageKeyApi, cleaned[p].apiKey);
      writeStorage(PROVIDER_META[p].storageKeyModel, cleaned[p].model);
    });

    set({ customProvider: provider, providers: cleaned });
  },

  clearCustomSettings: () => {
    writeStorage(STORAGE_KEY_PROVIDER, '');
    (Object.keys(PROVIDER_META) as AiProvider[]).forEach((p) => {
      writeStorage(PROVIDER_META[p].storageKeyApi, '');
      writeStorage(PROVIDER_META[p].storageKeyModel, '');
    });
    set({
      customProvider: '',
      providers: {
        openrouter: { apiKey: '', model: '' },
        groq: { apiKey: '', model: '' },
      },
    });
  },
}));

/** Resuelve la configuración efectiva para un proveedor específico o el proveedor activo. */
export function resolveProviderConfig(
  provider: AiProvider,
  customProviders = useAiSettingsStore.getState().providers
): Omit<EffectiveAiConfig, 'provider'> {
  const custom = customProviders[provider];
  const env = getEnvProviderConfig(provider);
  const meta = PROVIDER_META[provider];

  const apiKey = custom.apiKey || env.apiKey;
  const apiKeySource: EffectiveAiConfig['apiKeySource'] = custom.apiKey
    ? 'local'
    : env.apiKey
      ? 'env'
      : 'none';

  const model = custom.model || env.model || meta.defaultModel;
  const modelSource: EffectiveAiConfig['modelSource'] = custom.model
    ? 'local'
    : env.model
      ? 'env'
      : 'default';

  return { apiKey, model, apiKeySource, modelSource };
}

/** Resuelve el proveedor activo y sus credenciales efectivas (localStorage > .env > valores por defecto). */
export function getEffectiveAiConfig(
  state: Pick<AiSettingsState, 'customProvider' | 'providers'> = useAiSettingsStore.getState()
): EffectiveAiConfig {
  const provider = state.customProvider || getDefaultProvider();
  return {
    provider,
    ...resolveProviderConfig(provider, state.providers),
  };
}
