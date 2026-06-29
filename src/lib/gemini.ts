const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

export async function callGemini(
  prompt: string,
  temperature = 0.7,
  maxOutputTokens = 8192
): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-3.1-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature, maxOutputTokens },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Error de API: ${response.status} ${err}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

export function extractJsonArray(text: string): string {
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (end === -1 || end < start) {
    throw new Error(`La IA no completó la respuesta (JSON truncado). Respuesta: ${text.slice(0, 600)}`);
  }
  return cleaned.slice(start, end + 1);
}
