import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Loader2, Sparkles } from 'lucide-react';
import { callGemini, extractJsonArray } from '../../lib/gemini';
import type { Question, QuestionType } from '../../types/question';

interface AiModifyModalProps {
  open: boolean;
  onClose: () => void;
  question: Question;
  onUpdate: (id: string, updates: Partial<Question>) => void;
}

export function AiModifyModal({ open, onClose, question, onUpdate }: AiModifyModalProps) {
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleModify() {
    if (!instruction.trim()) return;
    setLoading(true);
    setError('');

    const questionJson = JSON.stringify({
      title: question.title,
      type: question.type,
      options: question.options ?? [],
      correctAnswer: question.quizSettings?.correctAnswer ?? null,
      points: question.quizSettings?.points ?? 1,
      description: question.description ?? '',
      required: question.required,
      settings: question.settings ?? {},
    }, null, 2);

    const prompt = `Eres un profesor que crea preguntas de examen. Tienes esta pregunta actual:

\`\`\`json
${questionJson}
\`\`\`

El docente te pide que la modifiques según esta instrucción: "${instruction.trim()}"

Devuelve ÚNICAMENTE un array JSON con un solo objeto modificado. Sin markdown, sin \`\`\`, sin explicaciones.

Cada objeto debe tener esta estructura:
{
  "title": "texto de la pregunta",
  "type": "multipleChoice" | "checkbox" | "text" | "paragraph" | "dropdown" | "linearScale",
  "options": ["opción1", "opción2", ...], // solo si aplica
  "correctAnswer": "respuesta correcta" | ["respuestas correctas"] | null,
  "points": 1,
  "description": "",
  "settings": {}
}

IMPORTANTE:
- Usa notación LaTeX entre $...$ para fórmulas matemáticas
- Si el tipo cambia, incluye options según corresponda
- Para linearScale incluye "settings": { "min": 1, "max": 5, "minLabel": "", "maxLabel": "" }
- Mantén todo lo que no se deba modificar igual que la pregunta original`;

    try {
      const text = await callGemini(prompt);
      const jsonStr = extractJsonArray(text);
      const modified = JSON.parse(jsonStr);

      if (!Array.isArray(modified) || modified.length === 0) {
        throw new Error('La IA no devolvió una pregunta válida');
      }

      const q = modified[0];
      const updates: Partial<Question> = {
        title: q.title,
        description: q.description ?? '',
        options: q.options ?? [],
        settings: q.settings ?? {},
        quizSettings: {
          correctAnswer: q.correctAnswer ?? null,
          points: q.points ?? 1,
        },
      };

      onUpdate(question.id, updates);
      onClose();
      setInstruction('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al modificar la pregunta');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Modificar con IA" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Describe qué quieres cambiar de esta pregunta. Por ejemplo: "cambia los números", "hazlo más difícil", "conviértelo en opción múltiple".
        </p>
        <Input
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="Ej: cambia los números del cálculo"
          onKeyDown={(e) => { if (e.key === 'Enter' && !loading) handleModify(); }}
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleModify} disabled={loading || !instruction.trim()}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {loading ? 'Modificando...' : 'Modificar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
