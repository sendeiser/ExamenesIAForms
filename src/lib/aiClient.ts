import {
  PROVIDER_META,
  getEffectiveAiConfig,
  type AiProvider,
} from '../store/aiSettingsStore';

export type AiContentPart =
  | { type: 'text'; text: string }
  | { type: 'file'; file: { filename: string; file_data: string } };

export interface OpenRouterPlugin {
  id: string;
  pdf?: { engine: 'cloudflare-ai' | 'mistral-ocr' | 'native' };
}

export interface AiCallOptions {
  prompt?: string;
  content?: AiContentPart[];
  temperature?: number;
  maxTokens?: number;
  plugins?: OpenRouterPlugin[];
}

export interface AiConnectionTestResult {
  summary: string;
  availableModels?: string[];
}

interface ProviderTransport {
  chatUrl: string;
  testUrl: string;
  buildChatHeaders: (apiKey: string) => Record<string, string>;
  buildTestHeaders: (apiKey: string) => Record<string, string>;
}

const PROVIDER_TRANSPORT: Record<AiProvider, ProviderTransport> = {
  openrouter: {
    chatUrl: 'https://openrouter.ai/api/v1/chat/completions',
    testUrl: 'https://openrouter.ai/api/v1/key',
    buildChatHeaders: (apiKey) => {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'ExamenesIAForms',
      };
      if (typeof window !== 'undefined' && window.location?.origin) {
        headers['HTTP-Referer'] = window.location.origin;
      }
      return headers;
    },
    buildTestHeaders: (apiKey) => ({
      Authorization: `Bearer ${apiKey}`,
    }),
  },
  groq: {
    chatUrl: 'https://api.groq.com/openai/v1/chat/completions',
    testUrl: 'https://api.groq.com/openai/v1/models',
    buildChatHeaders: (apiKey) => ({
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }),
    buildTestHeaders: (apiKey) => ({
      Authorization: `Bearer ${apiKey}`,
    }),
  },
};

function formatProviderError(provider: AiProvider, status: number, rawBody: string): string {
  const providerLabel = PROVIDER_META[provider].label;
  let detail = '';
  try {
    const parsed = JSON.parse(rawBody);
    detail = parsed?.error?.message || parsed?.message || '';
  } catch {
    detail = rawBody.slice(0, 250);
  }

  if (status === 401) {
    return `API key de ${providerLabel} inválida o revocada (401). Verifica tu clave en "API IA".`;
  }
  if (status === 402) {
    return `Créditos insuficientes en ${providerLabel} (402).`;
  }
  if (status === 413) {
    return `El contenido supera el límite de tamaño de ${providerLabel} (413). Prueba con un documento más corto o cambia de modelo.`;
  }
  if (status === 429) {
    return `Límite de solicitudes alcanzado en ${providerLabel} (429). Espera unos segundos e intenta nuevamente.`;
  }
  if (status === 404 && detail) {
    return `Modelo o recurso no encontrado en ${providerLabel} (404): ${detail}`;
  }
  return detail
    ? `Error de ${providerLabel} (${status}): ${detail}`
    : `Error de ${providerLabel} (${status})`;
}

function normalizeMessageContent(options: AiCallOptions): string | AiContentPart[] {
  if (!options.content) return options.prompt ?? '';
  const allText = options.content.every((part) => part.type === 'text');
  if (allText) {
    return options.content
      .map((part) => (part.type === 'text' ? part.text : ''))
      .join('');
  }
  return options.content;
}

function extractResponseText(data: any): string {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part: any) => (typeof part === 'string' ? part : part?.text ?? ''))
      .join('');
  }
  return '';
}

/** Envía una solicitud de chat completions al proveedor activo (OpenRouter o Groq). */
export async function callAi(options: AiCallOptions): Promise<string> {
  const { provider, apiKey, model } = getEffectiveAiConfig();
  const meta = PROVIDER_META[provider];
  const transport = PROVIDER_TRANSPORT[provider];

  if (!apiKey) {
    throw new Error(
      `No hay una API key de ${meta.label} configurada. Configúrala en "API IA" (barra superior) o en .env.local (${meta.envKeyName}).`
    );
  }

  const body: Record<string, unknown> = {
    model,
    messages: [{ role: 'user', content: normalizeMessageContent(options) }],
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 8192,
  };

  if (provider === 'openrouter' && options.plugins && options.plugins.length > 0) {
    body.plugins = options.plugins;
  }

  const response = await fetch(transport.chatUrl, {
    method: 'POST',
    headers: transport.buildChatHeaders(apiKey),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(formatProviderError(provider, response.status, errText));
  }

  const data = await response.json();
  if (data?.error?.message) {
    throw new Error(`Error de ${meta.label}: ${data.error.message}`);
  }

  const text = extractResponseText(data);
  if (!text.trim()) {
    throw new Error(`${meta.label} devolvió una respuesta vacía. Intenta nuevamente o prueba otro modelo.`);
  }

  return text;
}

const NON_CHAT_GROQ_KEYWORDS = ['whisper', 'orpheus', 'prompt-guard', 'safeguard', 'tts'];

/** Valida la API key contra el endpoint de inspección del proveedor sin gastar tokens. */
export async function testAiConnection(
  provider: AiProvider,
  apiKey: string
): Promise<AiConnectionTestResult> {
  const cleanKey = apiKey.trim();
  const meta = PROVIDER_META[provider];
  const transport = PROVIDER_TRANSPORT[provider];

  if (!cleanKey) {
    throw new Error(`Ingresa una API key de ${meta.label} para probar.`);
  }

  const response = await fetch(transport.testUrl, {
    method: 'GET',
    headers: transport.buildTestHeaders(cleanKey),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(formatProviderError(provider, response.status, errText));
  }

  const payload = await response.json();

  if (provider === 'groq') {
    const rawModels: Array<{ id?: string; active?: boolean }> = Array.isArray(payload?.data)
      ? payload.data
      : [];
    const chatModels = rawModels
      .filter((m) => m.active !== false && typeof m.id === 'string')
      .map((m) => m.id as string)
      .filter((id) => !NON_CHAT_GROQ_KEYWORDS.some((kw) => id.toLowerCase().includes(kw)))
      .sort();

    return {
      summary: `Conexión exitosa con Groq (${chatModels.length} modelos de texto disponibles).`,
      availableModels: chatModels,
    };
  }

  const info = payload?.data ?? payload ?? {};
  const details: string[] = [];
  if (typeof info.label === 'string' && info.label) details.push(`Clave: ${info.label}`);
  if (typeof info.limit_remaining === 'number') {
    details.push(`Saldo restante: $${info.limit_remaining.toFixed(4)}`);
  } else if (info.is_free_tier) {
    const freeReqs = info.free_model_daily_requests;
    if (typeof freeReqs?.remaining === 'number' && typeof freeReqs?.limit === 'number') {
      details.push(`Plan gratuito: ${freeReqs.remaining}/${freeReqs.limit} req/día`);
    } else {
      details.push('Plan gratuito activo');
    }
  }

  return {
    summary: details.length > 0 ? `Conexión exitosa (${details.join(' · ')})` : 'API key de OpenRouter válida y activa.',
  };
}

/** Extrae y parsea un array JSON desde la respuesta de la IA, tolerando markdown y escapes LaTeX. */
export function parseJsonArrayFromAi<T = any>(
  text: string,
  options?: { escapeLatex?: boolean }
): T[] {
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');

  if (start === -1 || end === -1 || end < start) {
    throw new Error(`La IA no completó la respuesta (JSON truncado). Respuesta: ${text.slice(0, 600)}`);
  }

  let jsonStr = cleaned.slice(start, end + 1);

  if (options?.escapeLatex) {
    jsonStr = jsonStr.replace(/(?<!\\)\\(?!(?:u[0-9a-fA-F]{4}|n(?![a-z])))([a-zA-Z])/g, '\\\\$1');
  }

  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) {
      throw new Error('La respuesta no es un array JSON.');
    }
    return parsed as T[];
  } catch (err) {
    if (!options?.escapeLatex) {
      try {
        const sanitized = jsonStr.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
        const parsed = JSON.parse(sanitized);
        if (Array.isArray(parsed)) return parsed as T[];
      } catch {
        // Dejar que caiga al error descriptivo original
      }
    }
    const msg = err instanceof SyntaxError ? err.message : 'Error desconocido';
    const pos = parseInt(msg.match(/position\s+(\d+)/)?.[1] ?? '0', 10);
    const around = jsonStr.slice(Math.max(0, pos - 40), pos + 40);
    throw new Error(`Error de JSON en posición ${pos}: ${msg}. Alrededor: ...${around}...`);
  }
}
