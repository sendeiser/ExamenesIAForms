import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Loader2, Sparkles } from 'lucide-react';
import { callGemini, extractJsonArray } from '../../lib/gemini';
import { useEditorStore } from '../../store/editorStore';

interface AiModifyAllModalProps {
  open: boolean;
  onClose: () => void;
}

export function AiModifyAllModal({ open, onClose }: AiModifyAllModalProps) {
  const questions = useEditorStore((s) => s.questions);
  const updateQuestion = useEditorStore((s) => s.updateQuestion);
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleModifyAll() {
    if (!instruction.trim() || questions.length === 0) return;
    setLoading(true);
    setError('');

    const questionsJson = JSON.stringify(
      questions.map((q) => ({
        id: q.id,
        title: q.title,
        type: q.type,
        options: q.options ?? [],
        correctAnswer: q.quizSettings?.correctAnswer ?? null,
        points: q.quizSettings?.points ?? 1,
        description: q.description ?? '',
        required: q.required,
        settings: q.settings ?? {},
      })),
      null,
      2,
    );

    const prompt = `Eres un profesor que crea preguntas de examen. Tienes estas preguntas actuales:

\`\`\`json
${questionsJson}
\`\`\`

El docente te pide que MODIFIQUES TODAS LAS PREGUNTAS según esta instrucción: "${instruction.trim()}"

Devuelve ÚNICAMENTE un array JSON con todas las preguntas modificadas (misma cantidad y mismo orden). Sin markdown, sin \`\`\`, sin explicaciones.

Cada objeto debe tener esta estructura:
{
  "id": "mismo id de la pregunta original",
  "title": "texto de la pregunta",
  "type": "multipleChoice" | "checkbox" | "text" | "paragraph" | "dropdown" | "linearScale",
  "options": ["opción1", "opción2", ...],
  "correctAnswer": "respuesta correcta" | ["respuestas correctas"] | null,
  "points": 1,
  "description": "",
  "settings": {}
}

IMPORTANTE:
- Usa notación LaTeX entre $...$ para fórmulas matemáticas
- Mantén el MISMO ID de cada pregunta original
- Debes devolver EXACTAMENTE ${questions.length} preguntas en el mismo orden
- Si una pregunta no necesita cambios, devuélvela igual que la original
- Para linearScale incluye "settings": { "min": 1, "max": 5, "minLabel": "", "maxLabel": "" }`;

    try {
      const text = await callGemini(prompt);
      const jsonStr = extractJsonArray(text);
      const modified = JSON.parse(jsonStr);

      if (!Array.isArray(modified) || modified.length !== questions.length) {
        throw new Error(`La IA devolvió ${modified?.length ?? 0} preguntas, se esperaban ${questions.length}`);
      }

      for (const q of modified) {
        const updates: Record<string, any> = {
          title: q.title,
          description: q.description ?? '',
          options: q.options ?? [],
          settings: q.settings ?? {},
          quizSettings: {
            correctAnswer: q.correctAnswer ?? null,
            points: q.points ?? 1,
          },
        };
        await updateQuestion(q.id, updates);
      }

      onClose();
      setInstruction('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al modificar las preguntas');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Modificar todas con IA" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Describe qué quieres cambiar en todas las preguntas. Por ejemplo: "cambia los números de todos los cálculos",
          "haz todas las preguntas más difíciles", "cambia el tema a geografía".
        </p>
        <p className="text-xs text-gray-400">
          {questions.length} pregunta{questions.length !== 1 ? 's' : ''} serán modificadas.
        </p>
        <Input
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="Ej: cambia los números de todos los ejercicios"
          onKeyDown={(e) => { if (e.key === 'Enter' && !loading) handleModifyAll(); }}
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleModifyAll} disabled={loading || !instruction.trim() || questions.length === 0}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {loading ? 'Modificando...' : 'Modificar todas'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
