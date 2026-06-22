import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Loader2, Sparkles } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import type { QuestionType } from '../../types/question';

const GEMINI_API_KEY = 'AIzaSyC6LUwG8o9oreV1BH3VDyOryn2nMjN2mJ8';

interface AiGenerateModalProps {
  open: boolean;
  onClose: () => void;
}

export function AiGenerateModal({ open, onClose }: AiGenerateModalProps) {
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(5);
  const [type, setType] = useState<QuestionType | 'mixed'>('mixed');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const addQuestion = useEditorStore((s) => s.addQuestion);
  const updateQuestion = useEditorStore((s) => s.updateQuestion);
  const questions = useEditorStore((s) => s.questions);
  const sections = useEditorStore((s) => s.sections);

  async function handleGenerate() {
    if (!topic.trim()) return;
    setLoading(true);
    setError('');

    try {
      const prompt = buildPrompt(topic, count, type);
      const questionsData = await callGemini(prompt);

      for (let i = 0; i < questionsData.length; i++) {
        const q = questionsData[i];
        const currentLen = useEditorStore.getState().questions.length;
        await addQuestion(q.type);
        const updatedQuestions = useEditorStore.getState().questions;
        const newQuestion = updatedQuestions.find((_, idx) => idx === currentLen);
        if (newQuestion) {
          await updateQuestion(newQuestion.id, {
            title: q.title,
            options: q.options ?? [],
            order: currentLen,
            sectionId: sections.length > 0 ? sections[0].id : null,
          });
        }
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar preguntas');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Generar preguntas con IA">
      <div className="space-y-4">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Tema</label>
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Ej: Revolución Francesa, Álgebra lineal, Gramática inglesa..."
          />
        </div>

        <div className="flex gap-4">
          <div className="flex-1 space-y-1">
            <label className="block text-sm font-medium text-gray-700">Cantidad</label>
            <Input
              type="number"
              min={1}
              max={20}
              value={count}
              onChange={(e) => setCount(Math.min(20, Math.max(1, Number(e.target.value))))}
            />
          </div>
          <div className="flex-1 space-y-1">
            <label className="block text-sm font-medium text-gray-700">Tipo</label>
            <Select
              value={type}
              onChange={(e) => setType(e.target.value as QuestionType | 'mixed')}
              options={[
                { value: 'mixed', label: 'Mixto' },
                { value: 'multipleChoice', label: 'Opción múltiple' },
                { value: 'checkbox', label: 'Casillas' },
                { value: 'text', label: 'Texto corto' },
                { value: 'paragraph', label: 'Párrafo' },
                { value: 'dropdown', label: 'Desplegable' },
                { value: 'linearScale', label: 'Escala lineal' },
              ]}
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleGenerate} disabled={loading || !topic.trim()}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {loading ? 'Generando...' : 'Generar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function buildPrompt(topic: string, count: number, type: QuestionType | 'mixed'): string {
  const typeConstraint = type !== 'mixed' ? `Todas las preguntas deben ser de tipo "${type}".` : 'Mezcla distintos tipos de pregunta apropiados para el tema.';
  const linearScaleHint = type === 'linearScale' ? 'Para linearScale, incluye también "settings": { "min": 1, "max": 5, "minLabel": "", "maxLabel": "" }' : '';

  return `Genera exactamente ${count} preguntas de examen sobre "${topic}" en español.

Responde ÚNICAMENTE con un array JSON válido. Sin markdown, sin \`\`\`, sin explicaciones.

Cada objeto en el array debe tener esta estructura:
{
  "title": "texto de la pregunta",
  "type": "multipleChoice" | "checkbox" | "text" | "paragraph" | "dropdown" | "linearScale",
  "options": ["opción1", "opción2", ...] // solo para multipleChoice, checkbox, dropdown
}

${typeConstraint}
${linearScaleHint}

Las preguntas deben ser variadas, claras y apropiadas para el tema.`;
}

async function callGemini(prompt: string): Promise<Array<{ title: string; type: QuestionType; options?: string[] }>> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Error de API: ${response.status} ${err}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error('No se pudo procesar la respuesta de la IA. Intenta de nuevo.');
  }
}
