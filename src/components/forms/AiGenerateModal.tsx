import { useState, useRef, type ReactNode } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import {
  Loader2,
  Sparkles,
  Upload,
  FileText,
  X,
  BookOpen,
  Beaker,
  ScrollText,
  MessageSquare,
  PenLine,
  ChevronDown,
  ChevronUp,
  Download,
  AlertTriangle,
} from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import type { QuestionType } from '../../types/question';
import {
  callAi,
  parseJsonArrayFromAi,
  type AiContentPart,
  type OpenRouterPlugin,
} from '../../lib/aiClient';
import {
  getEffectiveAiConfig,
  useAiSettingsStore,
} from '../../store/aiSettingsStore';
import {
  buildMarkdownFromPages,
  estimateTokens,
  prepareDocument,
  readFileAsDataUrl,
  type PreparedDocument,
} from '../../lib/documentParser';
import { AiStatusBar } from './AiStatusBar';
import { extractTableFromQuestionPayload } from '../../lib/tableUtils';

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

const ACCEPTED_EXTENSIONS = ['pdf', 'txt', 'md', 'docx'];
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

export function AiGenerateModal({ open, onClose }: AiGenerateModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [topic, setTopic] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [count, setCount] = useState(5);
  const [type, setType] = useState<QuestionType | 'mixed'>('mixed');
  const [loading, setLoading] = useState(false);
  const [parsingFile, setParsingFile] = useState(false);
  const [error, setError] = useState('');

  const [preparedDoc, setPreparedDoc] = useState<PreparedDocument | null>(null);
  const [pageRange, setPageRange] = useState('');
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [markdownText, setMarkdownText] = useState('');
  const [showMarkdownPreview, setShowMarkdownPreview] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const addQuestion = useEditorStore((s) => s.addQuestion);
  const updateQuestion = useEditorStore((s) => s.updateQuestion);
  const updateForm = useEditorStore((s) => s.updateForm);
  const form = useEditorStore((s) => s.form);
  const sections = useEditorStore((s) => s.sections);

  const customProvider = useAiSettingsStore((s) => s.customProvider);
  const providers = useAiSettingsStore((s) => s.providers);
  const { provider } = getEffectiveAiConfig({ customProvider, providers });

  function selectTemplate(tpl: Template) {
    setSelectedTemplate(tpl.name);
    setTopic(tpl.topic);
    setCustomInstructions(tpl.instructions);
    if (tpl.type) setType(tpl.type);
  }

  function applyPageRange(doc: PreparedDocument, nextRange: string) {
    setPageRange(nextRange);
    const { markdown, selectedPages: pages } = buildMarkdownFromPages(doc, nextRange);
    setMarkdownText(markdown);
    setSelectedPages(pages);
  }

  function clearDocument() {
    setPreparedDoc(null);
    setPageRange('');
    setSelectedPages([]);
    setMarkdownText('');
    setShowMarkdownPreview(false);
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function handleDownloadMarkdown() {
    if (!preparedDoc || !markdownText.trim()) return;
    const baseName = preparedDoc.filename.replace(/\.[^.]+$/, '');
    const blob = new Blob([markdownText], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseName}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext ?? '')) {
      setError('Solo se aceptan archivos PDF, DOCX, TXT o MD');
      return;
    }
    if (f.size > MAX_FILE_SIZE_BYTES) {
      setError('El archivo no puede superar los 15 MB');
      return;
    }

    setParsingFile(true);
    setError('');
    try {
      const doc = await prepareDocument(f);
      setPreparedDoc(doc);
      applyPageRange(doc, '');
    } catch (err) {
      clearDocument();
      setError(err instanceof Error ? err.message : 'No se pudo procesar el documento');
    } finally {
      setParsingFile(false);
    }
  }

  async function handleGenerate() {
    if (!topic.trim() && !preparedDoc) {
      setError('Ingresa un tema o sube un documento');
      return;
    }
    if (preparedDoc && !preparedDoc.isScannedPdf && !markdownText.trim()) {
      setError('El rango de páginas seleccionado no contiene texto. Ajusta las páginas o edita el Markdown.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const questionsData = await generateQuestionsWithAi(
        topic,
        count,
        type,
        preparedDoc,
        markdownText,
        customInstructions
      );
      for (let i = 0; i < questionsData.length; i++) {
        const q = questionsData[i];
        const extracted = extractTableFromQuestionPayload(q);
        const currentLen = useEditorStore.getState().questions.length;
        await addQuestion(q.type);
        const updatedQuestions = useEditorStore.getState().questions;
        const newQuestion = updatedQuestions.find((_, idx) => idx === currentLen);
        if (newQuestion) {
          const updates: Record<string, any> = {
            title: extracted.title,
            options: (q.options ?? []).map((o: any) => (typeof o === 'string' ? { label: o } : o)),
            order: currentLen,
            sectionId: sections.length > 0 ? sections[0].id : null,
            settings: extracted.settings,
          };
          if (extracted.correctAnswer !== undefined && extracted.correctAnswer !== null && extracted.correctAnswer !== '') {
            updates.quizSettings = {
              correctAnswer: extracted.correctAnswer,
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

  const estimatedTokens = estimateTokens(markdownText);
  const showGroqTokenWarning =
    provider === 'groq' && !preparedDoc?.isScannedPdf && estimatedTokens > 5500;
  const showLargeDocHint =
    !showGroqTokenWarning && !preparedDoc?.isScannedPdf && estimatedTokens > 25000;

  return (
    <Modal open={open} onClose={onClose} title="Generar preguntas con IA" size="lg">
      <div className="space-y-4">
        <AiStatusBar />
        <div>
          <p className="text-xs text-gray-500 mb-2">Plantillas rápidas</p>
          <div className="grid grid-cols-4 gap-1.5">
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.name}
                type="button"
                onClick={() => selectTemplate(tpl)}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-all ${
                  selectedTemplate === tpl.name
                    ? 'border-brand-600 bg-brand-50 text-brand-700 font-medium'
                    : 'border-sand-300 text-ink-subtle hover:border-sand-400 hover:bg-sand-50'
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
            className="block w-full rounded-lg border border-sand-400 px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-ink-light/70 focus:outline-none focus:ring-2 focus:ring-brand-500/25 focus:border-brand-600"
            rows={3}
          />
        </div>

        <div className="border-t border-sand-300 pt-3 space-y-2.5">
          <p className="text-xs text-ink-light">
            O sube un documento (PDF, DOCX, TXT o MD — se convierte a Markdown automáticamente):
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.md,.docx"
            onChange={handleFileChange}
            className="hidden"
          />

          {parsingFile ? (
            <div className="flex items-center justify-center gap-2 p-3 bg-brand-50 rounded-lg text-sm text-brand-700">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Convirtiendo documento a Markdown...</span>
            </div>
          ) : preparedDoc ? (
            <div className="rounded-lg border border-brand-200 bg-brand-50/50 p-3 space-y-2.5">
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-brand-600 shrink-0" />
                <span className="flex-1 truncate font-medium text-ink">{preparedDoc.filename}</span>
                {!preparedDoc.isScannedPdf && (
                  <span className="px-2 py-0.5 rounded bg-white border border-brand-200 text-[11px] font-mono text-brand-700 shrink-0">
                    ~{estimatedTokens.toLocaleString()} tokens
                  </span>
                )}
                <button
                  type="button"
                  onClick={clearDocument}
                  aria-label="Quitar archivo"
                  className="text-gray-400 hover:text-red-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {preparedDoc.isScannedPdf ? (
                <div className="flex items-start gap-2 p-2 rounded bg-amber-50 border border-amber-200 text-xs text-amber-800">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                  <span>
                    {provider === 'openrouter'
                      ? 'Este PDF parece escaneado (sin texto seleccionable). Se enviará directamente a OpenRouter para intentar leerlo.'
                      : 'Este PDF parece escaneado (sin texto seleccionable). Cambia a OpenRouter en "API IA" o sube el contenido como MD/TXT/DOCX.'}
                  </span>
                </div>
              ) : (
                <>
                  {preparedDoc.ext === 'pdf' && preparedDoc.totalPages > 1 && (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <label htmlFor="pdf-page-range" className="font-medium text-gray-700 shrink-0">
                        Páginas ({selectedPages.length}/{preparedDoc.totalPages}):
                      </label>
                      <input
                        id="pdf-page-range"
                        type="text"
                        value={pageRange}
                        onChange={(e) => applyPageRange(preparedDoc, e.target.value)}
                        placeholder={`Todas (1-${preparedDoc.totalPages})`}
                        className="w-36 rounded border border-sand-400 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500/25 focus:border-brand-600"
                      />
                      {preparedDoc.totalPages > 5 && (
                        <button
                          type="button"
                          onClick={() => applyPageRange(preparedDoc, '1-5')}
                          className="px-2 py-1 rounded border border-sand-300 bg-white text-ink-subtle hover:bg-sand-50"
                        >
                          1-5
                        </button>
                      )}
                      {preparedDoc.totalPages > 10 && (
                        <button
                          type="button"
                          onClick={() => applyPageRange(preparedDoc, '1-10')}
                          className="px-2 py-1 rounded border border-sand-300 bg-white text-ink-subtle hover:bg-sand-50"
                        >
                          1-10
                        </button>
                      )}
                      {pageRange && (
                        <button
                          type="button"
                          onClick={() => applyPageRange(preparedDoc, '')}
                          className="px-2 py-1 rounded border border-sand-300 bg-white text-brand-600 hover:bg-sand-50"
                        >
                          Todas
                        </button>
                      )}
                    </div>
                  )}

                  {showGroqTokenWarning && (
                    <div className="flex items-start gap-2 p-2 rounded bg-amber-50 border border-amber-200 text-xs text-amber-800">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                      <span>
                        El texto seleccionado tiene ~{estimatedTokens.toLocaleString()} tokens. El plan gratuito de Groq
                        tiene límite bajo por minuto: conviene reducir el rango de páginas o cambiar a OpenRouter.
                      </span>
                    </div>
                  )}

                  {showLargeDocHint && (
                    <p className="text-xs text-ink-subtle">
                      Documento extenso (~{estimatedTokens.toLocaleString()} tokens). Elegir un rango específico de
                      páginas mejora la precisión de las preguntas.
                    </p>
                  )}

                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setShowMarkdownPreview((prev) => !prev)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800"
                    >
                      {showMarkdownPreview ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      {showMarkdownPreview
                        ? 'Ocultar Markdown'
                        : `Ver / editar Markdown (${markdownText.length.toLocaleString()} caracteres)`}
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadMarkdown}
                      disabled={!markdownText.trim()}
                      className="inline-flex items-center gap-1 text-xs text-ink-subtle hover:text-ink disabled:opacity-40"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Descargar .md
                    </button>
                  </div>

                  {showMarkdownPreview && (
                    <textarea
                      value={markdownText}
                      onChange={(e) => setMarkdownText(e.target.value)}
                      rows={7}
                      className="block w-full rounded-lg border border-brand-200 bg-white px-3 py-2 text-xs font-mono text-ink focus:outline-none focus:ring-2 focus:ring-brand-500/25 focus:border-brand-600"
                    />
                  )}
                </>
              )}
            </div>
          ) : (
            <Button
              type="button"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              className="w-full justify-center"
            >
              <Upload className="h-4 w-4" />
              Seleccionar archivo (PDF, DOCX, TXT, MD)
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
          <Button
            onClick={handleGenerate}
            disabled={loading || parsingFile || (!topic.trim() && !preparedDoc)}
          >
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
  "points": 1, // puntos que vale la pregunta (opcional, por defecto 1)
  "settings": {} // opcional; usa settings.table para incluir tablas en la actividad
}

${typeConstraint}
${linearScaleHint}

IMPORTANTE:
- Usa notación LaTeX entre $...$ para fórmulas matemáticas y símbolos. Por ejemplo: "$E = mc^2$", "$\\frac{a}{b}$", "$\\sqrt{x^2 + y^2}$"
- Si la actividad necesita una tabla, cuadro comparativo o tabla de valores para analizar o completar, inclúyela SIEMPRE de forma estructurada en "settings": { "table": { "caption": "opcional", "headers": ["Col 1", "Col 2"], "rows": [{ "cells": ["dato", "valor"] }], "editableCells": ["0:1"] } } (usa "editableCells" con coordenadas "fila:columna" base 0 únicamente si el alumno debe completar celdas). Si excepcionalmente incluyes una tabla en LaTeX dentro del enunciado, dibuja SIEMPRE todas las líneas de columnas ({|c|c|...|}) y todas las líneas de filas (\\hline).
- SIEMPRE incluye "correctAnswer" con la respuesta correcta para cada pregunta
- Para multipleChoice/dropdown: correctAnswer debe ser un string igual a una opción
- Para checkbox: correctAnswer debe ser un array de strings con las opciones correctas
- Para text/paragraph: correctAnswer debe ser un string con la respuesta esperada
- Para linearScale: correctAnswer debe ser un número
- Las preguntas deben ser variadas, claras y apropiadas para el tema.`;
}

async function generateQuestionsWithAi(
  topic: string,
  count: number,
  type: QuestionType | 'mixed',
  preparedDoc: PreparedDocument | null,
  markdownText: string,
  customInstructions: string
): Promise<AiQuestion[]> {
  const effectiveTopic = topic.trim() || preparedDoc?.filename || 'el documento adjunto';
  const textPrompt = buildPrompt(effectiveTopic, count, type, customInstructions);
  const { provider } = getEffectiveAiConfig();

  const content: AiContentPart[] = [];
  const plugins: OpenRouterPlugin[] = [];

  if (preparedDoc) {
    if (preparedDoc.isScannedPdf) {
      if (provider !== 'openrouter') {
        throw new Error(
          'Este PDF es escaneado (sin texto seleccionable). Cambia a OpenRouter en "API IA" o sube el texto en MD/TXT/DOCX.'
        );
      }
      const dataUrl = await readFileAsDataUrl(preparedDoc.rawFile);
      content.push({
        type: 'file',
        file: {
          filename: preparedDoc.filename,
          file_data: dataUrl,
        },
      });
      plugins.push({ id: 'file-parser', pdf: { engine: 'cloudflare-ai' } });
    } else {
      content.push({
        type: 'text',
        text: `Documento de referencia en Markdown (${preparedDoc.filename}):\n\n${markdownText.trim()}\n\n---\n\n`,
      });
    }
  }

  content.push({ type: 'text', text: textPrompt });

  const text = await callAi({
    content,
    plugins,
    temperature: 0.7,
    maxTokens: 8192,
  });

  return parseJsonArrayFromAi<AiQuestion>(text, { escapeLatex: true });
}
