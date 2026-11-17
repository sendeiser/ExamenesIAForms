import { getEffectiveOpenRouterConfig } from '../store/aiSettingsStore';

const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_KEY_URL = 'https://openrouter.ai/api/v1/key';

export type OpenRouterContentPart =
  | { type: 'text'; text: string }
  | { type: 'file'; file: { filename: string; file_data: string } };

export interface OpenRouterPlugin {
  id: string;
  pdf?: { engine: 'cloudflare-ai' | 'mistral-ocr' | 'native' };
}

export interface OpenRouterCallOptions {
  prompt?: string;
  content?: OpenRouterContentPart[];
  temperature?: number;
  maxTokens?: number;
  plugins?: OpenRouterPlugin[];
}

export interface OpenRouterKeyStatus {
  label: string | null;
  limitRemaining: number | null;
  isFreeTier: boolean;
}

function buildHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'X-Title': 'ExamenesIAForms',
  };
  if (typeof window !== 'undefined' && window.location?.origin) {
    headers['HTTP-Referer'] = window.location.origin;
  }
  return headers;
}

function formatOpenRouterError(status: number, rawBody: string): string {
  let detail = '';
  try {
    const parsed = JSON.parse(rawBody);
    detail = parsed?.error?.message || parsed?.message || '';
  } catch {
    detail = rawBody.slice(0, 250);
  }

  if (status === 401) {
    return 'API key de OpenRouter inválida o revocada (401). Verifica tu clave en Configuración de IA.';
  }
  if (status === 402) {
    return 'Créditos insuficientes en OpenRouter (402). Agrega saldo o usa el modelo gratuito "openrouter/free".';
  }
  if (status === 429) {
    return 'Límite de solicitudes alcanzado en OpenRouter (429). Espera unos segundos e intenta nuevamente.';
  }
  if (status === 404 && detail) {
    return `Modelo o recurso no encontrado en OpenRouter (404): ${detail}`;
  }
  return detail
    ? `Error de OpenRouter (${status}): ${detail}`
    : `Error de OpenRouter (${status})`;
}

function extractMessageText(data: any): string {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part: any) => (typeof part === 'string' ? part : part?.text ?? ''))
      .join('');
  }
  return '';
}

/** Envía una solicitud de chat completions a OpenRouter usando la clave y modelo configurados. */
export async function callOpenRouter(options: OpenRouterCallOptions): Promise<string> {
  const { apiKey, model } = getEffectiveOpenRouterConfig();

  if (!apiKey) {
    throw new Error(
      'No hay una API key de OpenRouter configurada. Configúrala en "Configurar IA" (barra superior) o en .env.local (VITE_OPENROUTER_API_KEY).'
    );
  }

  const messageContent = options.content ?? options.prompt ?? '';
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: 'user', content: messageContent }],
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 8192,
  };

  if (options.plugins && options.plugins.length > 0) {
    body.plugins = options.plugins;
  }

  const response = await fetch(OPENROUTER_CHAT_URL, {
    method: 'POST',
    headers: buildHeaders(apiKey),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(formatOpenRouterError(response.status, errText));
  }

  const data = await response.json();
  if (data?.error?.message) {
    throw new Error(`Error de OpenRouter: ${data.error.message}`);
  }

  const text = extractMessageText(data);
  if (!text.trim()) {
    throw new Error('OpenRouter devolvió una respuesta vacía. Intenta nuevamente o prueba otro modelo.');
  }

  return text;
}

/** Valida una API key contra /api/v1/key sin consumir tokens de generación. */
export async function testOpenRouterConnection(apiKey: string): Promise<OpenRouterKeyStatus> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    throw new Error('Ingresa una API key de OpenRouter para probar.');
  }

  const response = await fetch(OPENROUTER_KEY_URL, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${cleanKey}`,
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(formatOpenRouterError(response.status, errText));
  }

  const payload = await response.json();
  const info = payload?.data ?? payload ?? {};
  return {
    label: typeof info.label === 'string' ? info.label : null,
    limitRemaining: typeof info.limit_remaining === 'number' ? info.limit_remaining : null,
    isFreeTier: Boolean(info.is_free_tier),
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
