import { useState, useRef, type ReactNode } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Loader2, Sparkles, Upload, FileText, X, BookOpen, Beaker, ScrollText, MessageSquare, PenLine } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import type { QuestionType } from '../../types/question';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

interface AiGenerateModalProps {
  open: boolean;
  onClose: () => void;
}

interface AiQuestion {
  title: string;
  type: QuestionType;
  options?: string[];
  correctAnswer?: string | string[];
  points?: number;
  settings?: Record<string, any>;
}

interface Template {
  name: string;
  icon: ReactNode;
  topic: string;
  instructions: string;
  type?: QuestionType | 'mixed';
}

const TEMPLATES: Template[] = [
  {
    name: 'Matemáticas',
    icon: <BookOpen className="h-4 w-4" />,
    topic: 'Matemáticas',
    instructions: 'Preguntas con fórmulas en notación LaTeX ($...$). Incluye ejercicios de álgebra, geometría, cálculo y resolución de problemas con aplicación práctica. Nivel: secundaria / universidad.',
    type: 'mixed',
  },
  {
    name: 'Ciencias',
    icon: <Beaker className="h-4 w-4" />,
    topic: 'Ciencias',
    instructions: 'Preguntas sobre conceptos científicos, teorías, leyes y experimentos. Usa ejemplos concretos y aplicaciones del mundo real. Incluye preguntas de relación causa-efecto.',
    type: 'mixed',
  },
  {
    name: 'Historia',
    icon: <ScrollText className="h-4 w-4" />,
    topic: 'Historia',
    instructions: 'Preguntas sobre eventos históricos, fechas clave, personajes importantes y contextos sociopolíticos. Incluye preguntas de análisis y relación causa-efecto.',
    type: 'mixed',
  },
  {
    name: 'Lenguaje',
    icon: <MessageSquare className="h-4 w-4" />,
    topic: 'Lengua y Literatura',
    instructions: 'Preguntas sobre gramática, ortografía, comprensión lectora, análisis literario, vocabulario y redacción.',
    type: 'mixed',
  },
  {
    name: 'Tipo test',
    icon: <PenLine className="h-4 w-4" />,
    topic: '',
    instructions: 'Todas las preguntas deben ser de opción múltiple con 4 opciones cada una. Incluir respuestas correctas. Adecuado para exámenes de selección múltiple.',
    type: 'multipleChoice',
  },
  {
    name: 'Desarrollo',
    icon: <PenLine className="h-4 w-4" />,
    topic: '',
    instructions: 'Preguntas de desarrollo y respuesta larga. Evaluar comprensión profunda, capacidad de análisis y síntesis. Incluir criterios de evaluación en la respuesta correcta.',
    type: 'paragraph',
  },
  {
    name: 'Personalizado',
    icon: <PenLine className="h-4 w-4" />,
    topic: '',
    instructions: '',
    type: 'mixed',
  },
];

export function AiGenerateModal({ open, onClose }: AiGenerateModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [topic, setTopic] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [count, setCount] = useState(5);
  const [type, setType] = useState<QuestionType | 'mixed'>('mixed');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addQuestion = useEditorStore((s) => s.addQuestion);
  const updateQuestion = useEditorStore((s) => s.updateQuestion);
  const updateForm = useEditorStore((s) => s.updateForm);
  const form = useEditorStore((s) => s.form);
  const sections = useEditorStore((s) => s.sections);

  function selectTemplate(tpl: Template) {
    setSelectedTemplate(tpl.name);
    setTopic(tpl.topic);
    setCustomInstructions(tpl.instructions);
    if (tpl.type) setType(tpl.type);
  }

  async function handleGenerate() {
    if (!topic.trim() && !file) {
      setError('Ingresa un tema o sube un documento');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const questionsData = await callGeminiWithDocument(topic, count, type, file, customInstructions);
      for (let i = 0; i < questionsData.length; i++) {
        const q = questionsData[i];
        const currentLen = useEditorStore.getState().questions.length;
        await addQuestion(q.type);
        const updatedQuestions = useEditorStore.getState().questions;
        const newQuestion = updatedQuestions.find((_, idx) => idx === currentLen);
        if (newQuestion) {
          const updates: Record<string, any> = {
            title: q.title,
            options: q.options ?? [],
            order: currentLen,
            sectionId: sections.length > 0 ? sections[0].id : null,
            settings: q.settings ?? {},
          };
          if (q.correctAnswer) {
            updates.quizSettings = {
              correctAnswer: q.correctAnswer,
              points: q.points ?? 1,
            };
          }
          await updateQuestion(newQuestion.id, updates);
        }
      }

      const hasCorrectAnswers = questionsData.some((q) => q.correctAnswer);
      if (hasCorrectAnswers && form?.settings) {
        updateForm({ settings: { ...form.settings, isQuiz: true } });
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar preguntas');
    } finally {
      setLoading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'txt', 'docx'].includes(ext ?? '')) {
      setError('Solo se aceptan archivos PDF, TXT o DOCX');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError('El archivo no puede superar los 10 MB');
      return;
    }
    setFile(f);
    setError('');
  }

  return (
    <Modal open={open} onClose={onClose} title="Generar preguntas con IA">
      <div className="space-y-4">
        <div>
          <p className="text-xs text-gray-500 mb-2">Plantillas rápidas</p>
          <div className="grid grid-cols-4 gap-1.5">
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.name}
                onClick={() => selectTemplate(tpl)}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-all ${
                  selectedTemplate === tpl.name
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {tpl.icon}
                <span className="text-[10px] leading-tight text-center">{tpl.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Tema o descripción</label>
          <Input
            value={topic}
            onChange={(e) => { setTopic(e.target.value); setSelectedTemplate(null); }}
            placeholder="Ej: Revolución Francesa, Álgebra lineal..."
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Especificaciones del docente</label>
          <textarea
            value={customInstructions}
            onChange={(e) => { setCustomInstructions(e.target.value); setSelectedTemplate(null); }}
            placeholder="Ej: Nivel universitario, incluir ejercicios de aplicación, las preguntas deben ser desafiantes..."
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            rows={3}
          />
        </div>

        <div className="border-t pt-3">
          <p className="text-xs text-gray-500 mb-2">O sube un documento (PDF, TXT, DOCX):</p>
          <input ref={fileInputRef} type="file" accept=".pdf,.txt,.docx" onChange={handleFileChange} className="hidden" />
          {file ? (
            <div className="flex items-center gap-2 p-2 bg-indigo-50 rounded-lg text-sm">
              <FileText className="h-4 w-4 text-indigo-600" />
              <span className="flex-1 truncate">{file.name}</span>
              <button onClick={() => { setFile(null); setError(''); }}>
                <X className="h-4 w-4 text-gray-400 hover:text-red-500" />
              </button>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()} className="w-full">
              <Upload className="h-4 w-4" />
              Seleccionar archivo
            </Button>
          )}
        </div>

        <div className="flex gap-4">
          <div className="flex-1 space-y-1">
            <label className="block text-sm font-medium text-gray-700">Cantidad</label>
            <Input
              type="number"
              min={1}
              max={30}
              value={count}
              onChange={(e) => setCount(Math.min(30, Math.max(1, Number(e.target.value))))}
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
          <Button onClick={handleGenerate} disabled={loading || (!topic.trim() && !file)}>
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

function buildPrompt(topic: string, count: number, type: QuestionType | 'mixed', customInstructions: string): string {
  const typeConstraint = type !== 'mixed' ? `Todas las preguntas deben ser de tipo "${type}".` : 'Mezcla distintos tipos de pregunta apropiados para el tema.';
  const linearScaleHint = type === 'linearScale' ? 'Para linearScale, incluye también "settings": { "min": 1, "max": 5, "minLabel": "", "maxLabel": "" }' : '';
  const specSection = customInstructions.trim()
    ? `\n\nEspecificaciones del docente:\n${customInstructions}`
    : '';

  return `Genera exactamente ${count} preguntas de examen sobre "${topic}" en español.${specSection}

Responde ÚNICAMENTE con un array JSON válido. Sin markdown, sin \`\`\`, sin explicaciones.

Cada objeto en el array debe tener esta estructura:
{
  "title": "texto de la pregunta",
  "type": "multipleChoice" | "checkbox" | "text" | "paragraph" | "dropdown" | "linearScale",
  "options": ["opción1", "opción2", ...], // solo para multipleChoice, checkbox, dropdown
  "correctAnswer": "opción correcta" | ["opciones correctas"], // RESPUESTA CORRECTA para autoevaluación
  "points": 1 // puntos que vale la pregunta (opcional, por defecto 1)
}

${typeConstraint}
${linearScaleHint}

IMPORTANTE:
- Usa notación LaTeX entre $...$ para fórmulas matemáticas y símbolos. Por ejemplo: "$E = mc^2$", "$\\frac{a}{b}$", "$\\sqrt{x^2 + y^2}$"
- SIEMPRE incluye "correctAnswer" con la respuesta correcta para cada pregunta
- Para multipleChoice/dropdown: correctAnswer debe ser un string igual a una opción
- Para checkbox: correctAnswer debe ser un array de strings con las opciones correctas
- Para text/paragraph: correctAnswer debe ser un string con la respuesta esperada
- Para linearScale: correctAnswer debe ser un número
- Las preguntas deben ser variadas, claras y apropiadas para el tema.`;
}

async function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

async function callGeminiWithDocument(
  topic: string,
  count: number,
  type: QuestionType | 'mixed',
  file: File | null,
  customInstructions: string
): Promise<AiQuestion[]> {
  const textPrompt = buildPrompt(topic, count, type, customInstructions);

  const parts: Array<Record<string, any>> = [];

  if (file) {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'txt') {
      const content = await readFileAsText(file);
      parts.push({ text: `Documento de referencia:\n\n${content}\n\n---\n\n` });
    } else if (ext === 'pdf') {
      const base64 = await readFileAsBase64(file);
      parts.push({ inline_data: { mime_type: 'application/pdf', data: base64 } });
    } else if (ext === 'docx') {
      const base64 = await readFileAsBase64(file);
      parts.push({ inline_data: { mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', data: base64 } });
    }
  }

  parts.push({ text: textPrompt });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-3.1-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
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

  const arrayStart = cleaned.indexOf('[');
  const arrayEnd = cleaned.lastIndexOf(']');

  if (arrayEnd === -1 || arrayEnd < arrayStart) {
    throw new Error(`La IA no completó la respuesta (el JSON está truncado). Respuesta: ${text.slice(0, 600)}`);
  }

  const jsonStr = cleaned.slice(arrayStart, arrayEnd + 1);

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    const msg = e instanceof SyntaxError ? e.message : 'Error desconocido';
    const pos = parseInt(msg.match(/position\s+(\d+)/)?.[1] ?? '0', 10);
    const around = jsonStr.slice(Math.max(0, pos - 40), pos + 40);
    throw new Error(`Error de JSON en posición ${pos}: ${msg}. Alrededor: ...${around}...`);
  }
}
