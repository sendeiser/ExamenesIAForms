import { jsPDF } from 'jspdf';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { generateShortCode } from './shortLink';
import {
  ORIGINAL_VERSION_ID,
  filterQuestionsByVersion,
  filterSectionsByVersion,
  getFormVersions,
  getVersionLabel,
  hasMultipleVersions,
  normalizeVersionId,
} from './examVersions';
import { callAi, parseJsonArrayFromAi } from './aiClient';
import {
  cellCoordKey,
  extractTableFromQuestionPayload,
  normalizeQuestionTable,
} from './tableUtils';
import { cleanTextForPdf } from './pdfReportGenerator';
import { toOptionItem, type OptionItem, type Question, type QuestionTable, type Section } from '../types/question';
import type { Form, FormVersion } from '../types/form';

export type VariationMode = 'exact' | 'shuffle' | 'ai' | 'ai_shuffle';

export interface FullExamData {
  form: Form;
  questions: Question[];
  sections: Section[];
}

export interface ExportedExamPayload {
  version: number;
  exportedAt: string;
  form: {
    title: string;
    description: string;
    versions?: FormVersion[];
    settings: Form['settings'];
    theme: Form['theme'];
  };
  sections: Array<{
    id: string;
    versionId?: string | null;
    title: string;
    description: string;
    order: number;
  }>;
  questions: Array<{
    id: string;
    versionId?: string | null;
    type: Question['type'];
    title: string;
    description: string;
    required: boolean;
    order: number;
    options: OptionItem[];
    settings: Question['settings'];
    conditions: Question['conditions'];
    sectionId: string | null;
    quizSettings?: Question['quizSettings'];
  }>;
}

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const proto = Object.getPrototypeOf(value);
    if (proto === Object.prototype || proto === null) {
      const cleaned: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (v !== undefined) {
          cleaned[k] = stripUndefined(v);
        }
      }
      return cleaned as T;
    }
  }
  return value;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'examen';
}

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function normalizeComparable(val: unknown): string {
  return String(val ?? '')
    .trim()
    .toLowerCase()
    .replace(/\$\$/g, '')
    .replace(/\$/g, '')
    .replace(/\\[\(\)\[\]]/g, '')
    .replace(/\s+/g, ' ');
}

export async function fetchFullExamData(formId: string): Promise<FullExamData> {
  const formSnap = await getDoc(doc(db, 'forms', formId));
  if (!formSnap.exists()) {
    throw new Error('Examen no encontrado.');
  }
  const fData = formSnap.data();
  const form: Form = {
    id: formSnap.id,
    ownerId: fData.ownerId,
    title: fData.title ?? 'Examen sin título',
    description: fData.description ?? '',
    shortCode: fData.shortCode,
    versions: Array.isArray(fData.versions) ? fData.versions : undefined,
    settings: fData.settings,
    theme: fData.theme,
    published: Boolean(fData.published),
    createdAt: fData.createdAt?.toDate?.() ?? new Date(),
    updatedAt: fData.updatedAt?.toDate?.() ?? new Date(),
  };

  const [questionsSnap, sectionsSnap] = await Promise.all([
    getDocs(query(collection(db, 'forms', formId, 'questions'), orderBy('order', 'asc'))),
    getDocs(query(collection(db, 'forms', formId, 'sections'), orderBy('order', 'asc'))),
  ]);

  const questions: Question[] = questionsSnap.docs.map((d) => {
    const qd = d.data();
    return {
      id: d.id,
      formId,
      versionId: qd.versionId ?? null,
      type: qd.type,
      title: qd.title ?? '',
      description: qd.description ?? '',
      required: Boolean(qd.required),
      order: qd.order ?? 0,
      options: Array.isArray(qd.options) ? qd.options.map(toOptionItem) : [],
      settings: qd.settings ?? {},
      conditions: qd.conditions ?? null,
      sectionId: qd.sectionId ?? null,
      ...(qd.quizSettings ? { quizSettings: qd.quizSettings } : {}),
    };
  });

  const sections: Section[] = sectionsSnap.docs.map((d) => {
    const sd = d.data();
    return {
      id: d.id,
      formId,
      versionId: sd.versionId ?? null,
      title: sd.title ?? '',
      description: sd.description ?? '',
      order: sd.order ?? 0,
    };
  });

  return { form, questions, sections };
}

export async function exportExamToJsonFile(formId: string): Promise<void> {
  const { form, questions, sections } = await fetchFullExamData(formId);

  const payload: ExportedExamPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    form: {
      title: form.title,
      description: form.description ?? '',
      ...(form.versions && form.versions.length > 0 ? { versions: form.versions } : {}),
      settings: form.settings,
      theme: form.theme,
    },
    sections: sections.map((s) => ({
      id: s.id,
      ...(s.versionId ? { versionId: s.versionId } : {}),
      title: s.title,
      description: s.description ?? '',
      order: s.order,
    })),
    questions: questions.map((q) => ({
      id: q.id,
      ...(q.versionId ? { versionId: q.versionId } : {}),
      type: q.type,
      title: q.title,
      description: q.description ?? '',
      required: Boolean(q.required),
      order: q.order,
      options: (q.options ?? []).map(toOptionItem),
      settings: q.settings ?? {},
      conditions: q.conditions ?? null,
      sectionId: q.sectionId ?? null,
      ...(q.quizSettings ? { quizSettings: q.quizSettings } : {}),
    })),
  };

  const json = JSON.stringify(stripUndefined(payload), null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFilename(form.title)}.examen.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface PersistExamOptions {
  ownerId: string;
  title: string;
  description: string;
  versions?: FormVersion[];
  settings: Form['settings'];
  theme: Form['theme'];
  sections: Array<Omit<Section, 'formId'>>;
  questions: Array<Omit<Question, 'formId'>>;
}

async function writeVersionSectionsAndQuestions(
  targetFormId: string,
  sections: Array<Omit<Section, 'formId'>>,
  questions: Array<Omit<Question, 'formId'>>,
  forcedVersionId?: string
): Promise<void> {
  const sectionIdMap = new Map<string, string>();
  const sectionWrites: Promise<void>[] = [];
  sections.forEach((sec, idx) => {
    const newSecRef = doc(collection(db, 'forms', targetFormId, 'sections'));
    sectionIdMap.set(sec.id, newSecRef.id);
    const resolvedVersionId = forcedVersionId ?? sec.versionId ?? undefined;
    sectionWrites.push(
      setDoc(
        newSecRef,
        stripUndefined({
          formId: targetFormId,
          ...(resolvedVersionId ? { versionId: resolvedVersionId } : {}),
          title: sec.title ?? `Sección ${idx + 1}`,
          description: sec.description ?? '',
          order: sec.order ?? idx,
        })
      )
    );
  });

  const questionIdMap = new Map<string, string>();
  const preparedQuestions = questions.map((q) => {
    const newQRef = doc(collection(db, 'forms', targetFormId, 'questions'));
    questionIdMap.set(q.id, newQRef.id);
    return { q, newQRef };
  });

  const questionWrites = preparedQuestions.map(({ q, newQRef }, idx) => {
    const mappedConditions =
      q.conditions && q.conditions.questionId
        ? {
            ...q.conditions,
            questionId: questionIdMap.get(q.conditions.questionId) ?? q.conditions.questionId,
          }
        : q.conditions ?? null;

    const mappedSectionId = q.sectionId ? sectionIdMap.get(q.sectionId) ?? null : null;
    const resolvedVersionId = forcedVersionId ?? q.versionId ?? undefined;

    return setDoc(
      newQRef,
      stripUndefined({
        formId: targetFormId,
        ...(resolvedVersionId ? { versionId: resolvedVersionId } : {}),
        type: q.type,
        title: q.title ?? '',
        description: q.description ?? '',
        required: Boolean(q.required),
        order: q.order ?? idx,
        options: (q.options ?? []).map(toOptionItem),
        settings: q.settings ?? {},
        conditions: mappedConditions,
        sectionId: mappedSectionId,
        ...(q.quizSettings ? { quizSettings: q.quizSettings } : {}),
      })
    );
  });

  await Promise.all([...sectionWrites, ...questionWrites]);
}

async function persistExamInFirestore({
  ownerId,
  title,
  description,
  versions,
  settings,
  theme,
  sections,
  questions,
}: PersistExamOptions): Promise<{ id: string; title: string; shortCode: string }> {
  const now = Timestamp.now();
  const shortCode = generateShortCode(5);
  const newFormRef = doc(collection(db, 'forms'));

  const safeFormDoc = stripUndefined({
    ownerId,
    title: title.trim() || 'Examen sin título',
    description: description ?? '',
    shortCode,
    ...(versions && versions.length > 0 ? { versions } : {}),
    settings,
    theme,
    published: false,
    createdAt: now,
    updatedAt: now,
  });

  await setDoc(newFormRef, safeFormDoc);
  await writeVersionSectionsAndQuestions(newFormRef.id, sections, questions);

  return {
    id: newFormRef.id,
    title: safeFormDoc.title,
    shortCode,
  };
}

export async function importExamFromJsonPayload(
  ownerId: string,
  payload: any,
  customTitle?: string
): Promise<string> {
  if (!payload || typeof payload !== 'object' || !payload.form || !Array.isArray(payload.questions)) {
    throw new Error('El archivo no tiene el formato válido de examen (.examen.json).');
  }

  const rawForm = payload.form;
  const rawSections: any[] = Array.isArray(payload.sections) ? payload.sections : [];
  const rawQuestions: any[] = payload.questions;

  const sections = rawSections.map((s, idx) => ({
    id: String(s.id ?? `sec-${idx}`),
    ...(s.versionId ? { versionId: String(s.versionId) } : {}),
    title: String(s.title ?? `Sección ${idx + 1}`),
    description: String(s.description ?? ''),
    order: typeof s.order === 'number' ? s.order : idx,
  }));

  const questions = rawQuestions.map((q, idx) => {
    const normalizedTable = q.settings?.table ? normalizeQuestionTable(q.settings.table) : undefined;
    const nextSettings = { ...(q.settings ?? {}) };
    if (normalizedTable) {
      nextSettings.table = normalizedTable;
    } else {
      delete nextSettings.table;
    }

    return {
      id: String(q.id ?? `q-${idx}`),
      ...(q.versionId ? { versionId: String(q.versionId) } : {}),
      type: q.type ?? 'text',
      title: String(q.title ?? 'Pregunta'),
      description: String(q.description ?? ''),
      required: Boolean(q.required),
      order: typeof q.order === 'number' ? q.order : idx,
      options: Array.isArray(q.options) ? q.options.map(toOptionItem) : [],
      settings: nextSettings,
      conditions: q.conditions ?? null,
      sectionId: q.sectionId ? String(q.sectionId) : null,
      ...(q.quizSettings ? { quizSettings: q.quizSettings } : {}),
    };
  });

  const defaultTitle = String(rawForm.title ?? 'Examen importado');
  const importedVersions: FormVersion[] | undefined = Array.isArray(rawForm.versions)
    ? rawForm.versions
    : undefined;
  const created = await persistExamInFirestore({
    ownerId,
    title: customTitle?.trim() || defaultTitle,
    description: String(rawForm.description ?? ''),
    ...(importedVersions && importedVersions.length > 0 ? { versions: importedVersions } : {}),
    settings: rawForm.settings ?? {
      collectEmail: false,
      requireLogin: false,
      limitResponses: null,
      confirmationMessage: '¡Respuesta registrada!',
      isQuiz: false,
      securityEnabled: false,
      maxViolations: 3,
      fullscreen: true,
      disableCopy: true,
      preventTabSwitch: true,
    },
    theme: rawForm.theme ?? {
      primaryColor: '#1B3B6F',
      backgroundColor: '#ffffff',
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      showProgressBar: false,
    },
    sections,
    questions,
  });

  return created.id;
}

async function generateAiVariationQuestions(
  questions: Question[],
  versionLabel: string,
  extraInstruction?: string
): Promise<Question[]> {
  if (questions.length === 0) return [];

  const questionsJson = JSON.stringify(
    questions.map((q) => ({
      id: q.id,
      title: q.title,
      description: q.description ?? '',
      type: q.type,
      options: (q.options ?? []).map((o) => toOptionItem(o).label),
      correctAnswer: q.quizSettings?.correctAnswer ?? null,
      points: q.quizSettings?.points ?? 1,
      settings: q.settings ?? {},
    })),
    null,
    2
  );

  const extraBlock = extraInstruction?.trim()
    ? `\nIndicaciones adicionales del docente: "${extraInstruction.trim()}".`
    : '';

  const prompt = `Eres un docente experto diseñando exámenes equivalentes para evitar que los alumnos se copien en el aula.
A partir de este examen base, genera una NUEVA VERSIÓN PARALELA (${versionLabel}) con actividades equivalentes en tema, dificultad, estructura y puntaje, pero con NUEVOS NÚMEROS, DATOS O CASOS DE EJERCICIO.${extraBlock}

Preguntas base:
\`\`\`json
${questionsJson}
\`\`\`

Devuelve ÚNICAMENTE un array JSON con EXACTAMENTE ${questions.length} preguntas en el mismo orden y con el mismo "id" y "type" de cada pregunta original. Sin markdown, sin \`\`\`, sin texto adicional.

Cada objeto del array debe respetar esta estructura:
{
  "id": "mismo id de la pregunta original",
  "title": "nueva consigna con otros datos o ejercicio equivalente",
  "description": "descripción (si tenía o vacía)",
  "type": "mismo type que la original",
  "options": ["opción 1", "opción 2", ...],
  "correctAnswer": "respuesta correcta recalculada" | ["respuestas"] | null,
  "points": 1,
  "settings": {}
}

REGLAS ESTRICTAS:
1. Mantén exactamente el MISMO "id" y el MISMO "type" para cada pregunta.
2. Mantén notación LaTeX entre $...$ en fórmulas matemáticas.
3. En ejercicios de cálculo o prácticos: cambia los números, coeficientes o valores numéricos de manera coherente y RECALCULA con exactitud las "options", la "correctAnswer" y las celdas de tabla para que la respuesta correcta sea 100% válida matemáticamente.
4. En preguntas conceptuales de opción múltiple/casillas: cambia los ejemplos o formula una pregunta paralela equivalente evaluando exactamente el mismo contenido.
5. Si la pregunta original tiene "settings.table", devuelve un objeto "settings.table" actualizado con los nuevos valores de datos y de respuestas esperadas, manteniendo "headers", cantidad de filas/columnas y "editableCells".
6. Para preguntas "multipleChoice", "checkbox" o "dropdown", asegúrate de que "correctAnswer" coincida EXACTAMENTE con el texto de una (o varias, en checkbox) de las strings dentro de "options".`;

  const text = await callAi({ prompt, temperature: 0.75, maxTokens: 8192 });
  const modified = parseJsonArrayFromAi(text, { escapeLatex: true });

  if (!Array.isArray(modified) || modified.length !== questions.length) {
    throw new Error(
      `La IA devolvió ${modified?.length ?? 0} preguntas al generar "${versionLabel}", pero se esperaban ${questions.length}.`
    );
  }

  return questions.map((origQ, idx) => {
    const modQ = modified.find((m: any) => m?.id === origQ.id) ?? modified[idx];
    const extracted = extractTableFromQuestionPayload(modQ);
    const mergedSettings: Question['settings'] = {
      ...origQ.settings,
      ...extracted.settings,
    };

    if (origQ.settings?.requireProcedurePhoto) {
      mergedSettings.requireProcedurePhoto = true;
    }
    if (origQ.settings?.imageUrl && !mergedSettings.imageUrl) {
      mergedSettings.imageUrl = origQ.settings.imageUrl;
    }
    if (!extracted.settings.table) {
      delete mergedSettings.table;
    }

    const rawOptions: any[] = Array.isArray(modQ.options) ? modQ.options : origQ.options ?? [];
    const options: OptionItem[] = rawOptions.map((opt, optIdx) => {
      if (typeof opt === 'string') {
        const origImg = origQ.options?.[optIdx]?.imageUrl;
        return origImg ? { label: opt, imageUrl: origImg } : { label: opt };
      }
      return toOptionItem(opt);
    });

    const nextCorrectAnswer =
      extracted.correctAnswer !== undefined
        ? extracted.correctAnswer
        : origQ.quizSettings?.correctAnswer ?? null;

    const quizSettings = origQ.quizSettings
      ? {
          correctAnswer: nextCorrectAnswer,
          points: origQ.quizSettings.points ?? modQ.points ?? 1,
        }
      : nextCorrectAnswer !== null && nextCorrectAnswer !== undefined
        ? {
            correctAnswer: nextCorrectAnswer,
            points: modQ.points ?? 1,
          }
        : undefined;

    return {
      ...origQ,
      title: extracted.title || origQ.title,
      description: modQ.description !== undefined ? String(modQ.description ?? '') : origQ.description,
      options,
      settings: mergedSettings,
      ...(quizSettings ? { quizSettings } : {}),
    };
  });
}

function applyShuffleToExamQuestions(questions: Question[], sections: Section[]): Question[] {
  const shuffleOptionsOnQuestion = (q: Question): Question => {
    if (
      (q.type === 'multipleChoice' || q.type === 'checkbox' || q.type === 'dropdown') &&
      q.options.length > 1
    ) {
      return { ...q, options: shuffleArray(q.options) };
    }
    return q;
  };

  if (sections.length === 0) {
    return shuffleArray(questions).map((q, idx) => ({
      ...shuffleOptionsOnQuestion(q),
      order: idx,
    }));
  }

  // Mezclar preguntas dentro de cada sección (y las sueltas sin sección), manteniendo el orden de secciones
  const result: Question[] = [];
  const orphanQuestions = shuffleArray(questions.filter((q) => !q.sectionId));
  result.push(...orphanQuestions);

  for (const sec of sections) {
    const secQs = shuffleArray(questions.filter((q) => q.sectionId === sec.id));
    result.push(...secQs);
  }

  return result.map((q, idx) => ({
    ...shuffleOptionsOnQuestion(q),
    order: idx,
  }));
}

export async function addExamVersionInPlace(params: {
  formId: string;
  sourceVersionId?: string;
  newLabel: string;
  variationMode: VariationMode;
  aiInstruction?: string;
}): Promise<{ version: FormVersion; questionCount: number }> {
  const {
    formId,
    sourceVersionId = ORIGINAL_VERSION_ID,
    newLabel,
    variationMode,
    aiInstruction,
  } = params;

  const { form, questions: allQuestions, sections: allSections } = await fetchFullExamData(formId);
  const sourceQuestions = filterQuestionsByVersion(allQuestions, sourceVersionId);
  const sourceSections = filterSectionsByVersion(allSections, sourceVersionId);

  let nextQuestions = sourceQuestions.map((q) => ({ ...q }));

  if (variationMode === 'ai' || variationMode === 'ai_shuffle') {
    nextQuestions = await generateAiVariationQuestions(
      nextQuestions,
      newLabel,
      aiInstruction
    );
  }

  if (variationMode === 'shuffle' || variationMode === 'ai_shuffle') {
    nextQuestions = applyShuffleToExamQuestions(nextQuestions, sourceSections);
  }

  const versionId = `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  await writeVersionSectionsAndQuestions(formId, sourceSections, nextQuestions, versionId);

  const newVersion: FormVersion = {
    id: versionId,
    label: newLabel.trim() || 'Nueva versión',
    createdAt: new Date().toISOString(),
  };

  const nextVersions = [...getFormVersions(form), newVersion];
  await updateDoc(doc(db, 'forms', formId), {
    versions: stripUndefined(nextVersions),
    updatedAt: Timestamp.now(),
  });

  return {
    version: newVersion,
    questionCount: nextQuestions.length,
  };
}

export async function replicateExamWithOptionalAi(params: {
  sourceFormId: string;
  ownerId: string;
  newTitle: string;
  variationMode: VariationMode;
  aiInstruction?: string;
  versionLabel?: string;
}): Promise<{ id: string; title: string; shortCode: string }> {
  const { sourceFormId, ownerId, newTitle, variationMode, aiInstruction, versionLabel } = params;
  const { form, questions, sections } = await fetchFullExamData(sourceFormId);

  if (variationMode === 'exact' && hasMultipleVersions(form)) {
    return persistExamInFirestore({
      ownerId,
      title: newTitle,
      description: form.description ?? '',
      versions: form.versions,
      settings: form.settings,
      theme: form.theme,
      sections,
      questions,
    });
  }

  const baseQuestions = hasMultipleVersions(form)
    ? filterQuestionsByVersion(questions, ORIGINAL_VERSION_ID)
    : questions;
  const baseSections = hasMultipleVersions(form)
    ? filterSectionsByVersion(sections, ORIGINAL_VERSION_ID)
    : sections;

  let nextQuestions: Question[] = baseQuestions.map((q) => ({ ...q, versionId: null }));
  const cleanSections: Section[] = baseSections.map((s) => ({ ...s, versionId: null }));

  if (variationMode === 'ai' || variationMode === 'ai_shuffle') {
    nextQuestions = await generateAiVariationQuestions(
      nextQuestions,
      versionLabel || newTitle,
      aiInstruction
    );
  }

  if (variationMode === 'shuffle' || variationMode === 'ai_shuffle') {
    nextQuestions = applyShuffleToExamQuestions(nextQuestions, cleanSections);
  }

  return persistExamInFirestore({
    ownerId,
    title: newTitle,
    description: form.description ?? '',
    settings: form.settings,
    theme: form.theme,
    sections: cleanSections,
    questions: nextQuestions,
  });
}

export async function generateExamPaperPdf(params: {
  formId: string;
  mode: 'student' | 'teacher';
  versionId?: string;
}): Promise<void> {
  const { formId, mode, versionId } = params;
  const { form, questions: allQuestions, sections: allSections } = await fetchFullExamData(formId);

  const targetVersionId = normalizeVersionId(versionId);
  const multiVersion = hasMultipleVersions(form);
  const versionLabel = multiVersion ? getVersionLabel(form, targetVersionId) : '';
  const questions = multiVersion
    ? filterQuestionsByVersion(allQuestions, targetVersionId)
    : allQuestions;
  const sections = multiVersion
    ? filterSectionsByVersion(allSections, targetVersionId)
    : allSections;

  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const PAGE_W = 210;
  const PAGE_H = 297;
  const MARGIN_X = 15;
  const MARGIN_TOP = 14;
  const MARGIN_BOTTOM = 16;
  const CONTENT_W = PAGE_W - MARGIN_X * 2;

  const COLOR_PRIMARY: [number, number, number] = [27, 59, 111];
  const COLOR_INK: [number, number, number] = [28, 25, 23];
  const COLOR_MUTED: [number, number, number] = [87, 83, 78];
  const COLOR_SUBTLE: [number, number, number] = [140, 134, 128];
  const COLOR_BORDER: [number, number, number] = [196, 190, 178];
  const COLOR_SOFT_BG: [number, number, number] = [247, 245, 240];
  const COLOR_GREEN: [number, number, number] = [21, 128, 61];
  const COLOR_GREEN_BG: [number, number, number] = [236, 253, 243];
  const COLOR_EDITABLE_BG: [number, number, number] = [254, 252, 245];
  const COLOR_WHITE: [number, number, number] = [255, 255, 255];

  let y = MARGIN_TOP;

  function ensureSpace(neededMm: number): boolean {
    if (y + neededMm > PAGE_H - MARGIN_BOTTOM) {
      doc.addPage();
      y = MARGIN_TOP;
      return true;
    }
    return false;
  }

  function drawWrappedLines(
    text: string,
    x: number,
    maxWidth: number,
    fontSize: number,
    style: 'normal' | 'bold' | 'italic' = 'normal',
    color: [number, number, number] = COLOR_INK
  ) {
    const clean = cleanTextForPdf(text);
    if (!clean.trim()) return;
    doc.setFont('helvetica', style);
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);
    const lineH = fontSize * 0.44 + 0.7;
    const lines = doc.splitTextToSize(clean, maxWidth) as string[];
    for (const line of lines) {
      ensureSpace(lineH + 1);
      doc.text(line, x, y + fontSize * 0.35);
      y += lineH;
    }
  }

  function drawPaperTable(table: QuestionTable, correctAnswerRaw: string | string[] | null | undefined) {
    const colCount = Math.max(1, table.headers.length);
    const colW = CONTENT_W / colCount;
    const editableSet = new Set(table.editableCells ?? []);
    const fontSize = colCount >= 5 ? 7.5 : 8.5;
    const lineH = fontSize * 0.44 + 0.9;
    const padX = 2.2;
    const padY = 2.2;

    if (table.caption) {
      drawWrappedLines(table.caption, MARGIN_X, CONTENT_W, 8.5, 'italic', COLOR_MUTED);
      y += 1;
    }

    const drawHeaderRow = () => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(fontSize);
      const wrappedHeaders = table.headers.map((h) =>
        doc.splitTextToSize(cleanTextForPdf(h), Math.max(8, colW - padX * 2)) as string[]
      );
      const maxLines = Math.max(1, ...wrappedHeaders.map((l) => l.length));
      const rowH = maxLines * lineH + padY * 2;
      ensureSpace(rowH + 4);

      for (let c = 0; c < colCount; c++) {
        const cx = MARGIN_X + c * colW;
        doc.setFillColor(...COLOR_SOFT_BG);
        doc.setDrawColor(...COLOR_BORDER);
        doc.setLineWidth(0.3);
        doc.rect(cx, y, colW, rowH, 'FD');
        doc.setTextColor(...COLOR_INK);
        doc.text(wrappedHeaders[c], cx + padX, y + padY + lineH * 0.78);
      }
      y += rowH;
    };

    drawHeaderRow();

    table.rows.forEach((row, rIdx) => {
      const cellsText = table.headers.map((_, cIdx) => {
        const coord = cellCoordKey(rIdx, cIdx);
        const isEditable = editableSet.has(coord);
        if (isEditable && mode === 'student') {
          return '';
        }
        return cleanTextForPdf(row.cells[cIdx] ?? '');
      });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(fontSize);
      const wrappedCells = cellsText.map((txt) =>
        txt ? (doc.splitTextToSize(txt, Math.max(8, colW - padX * 2)) as string[]) : ['']
      );
      const minEditableH = editableSet.size > 0 && mode === 'student' ? 8.5 : 6.5;
      const maxLines = Math.max(1, ...wrappedCells.map((l) => l.length));
      const rowH = Math.max(minEditableH, maxLines * lineH + padY * 2);

      if (ensureSpace(rowH)) {
        drawHeaderRow();
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(fontSize);
      }

      for (let c = 0; c < colCount; c++) {
        const cx = MARGIN_X + c * colW;
        const coord = cellCoordKey(rIdx, c);
        const isEditable = editableSet.has(coord);

        if (isEditable) {
          doc.setFillColor(...(mode === 'teacher' ? COLOR_GREEN_BG : COLOR_EDITABLE_BG));
        } else {
          doc.setFillColor(255, 255, 255);
        }
        doc.setDrawColor(...COLOR_BORDER);
        doc.setLineWidth(0.25);
        doc.rect(cx, y, colW, rowH, 'FD');

        if (cellsText[c]) {
          doc.setFont('helvetica', isEditable && mode === 'teacher' ? 'bold' : 'normal');
          doc.setTextColor(...(isEditable && mode === 'teacher' ? COLOR_GREEN : COLOR_INK));
          doc.text(wrappedCells[c], cx + padX, y + padY + lineH * 0.78);
        }
      }
      y += rowH;
    });

    if (mode === 'teacher' && editableSet.size === 0 && correctAnswerRaw) {
      y += 1.5;
      const ansStr = Array.isArray(correctAnswerRaw)
        ? correctAnswerRaw.join(', ')
        : String(correctAnswerRaw);
      drawWrappedLines(`Respuesta esperada: ${ansStr}`, MARGIN_X, CONTENT_W, 8.5, 'bold', COLOR_GREEN);
    }

    y += 3.5;
  }

  const isQuiz = Boolean(form.settings?.isQuiz);
  const totalPoints = questions.reduce((sum, q) => sum + (q.quizSettings?.points ?? 1), 0);

  // Header block
  doc.setFillColor(...COLOR_PRIMARY);
  doc.rect(MARGIN_X, y, CONTENT_W, 1.4, 'F');
  y += 4;

  const badgeText =
    mode === 'teacher'
      ? 'CLAVE DE CORRECCION DOCENTE'
      : 'EVALUACION ESCRITA — HOJA DEL ESTUDIANTE';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...(mode === 'teacher' ? COLOR_GREEN : COLOR_PRIMARY));
  doc.text(badgeText, MARGIN_X, y + 2.5);

  const metaParts: string[] = [];
  if (versionLabel) metaParts.push(cleanTextForPdf(versionLabel));
  if (form.shortCode) metaParts.push(`Codigo: ${form.shortCode}`);
  if (isQuiz) metaParts.push(`Puntaje total: ${totalPoints} pts`);
  metaParts.push(`${questions.length} actividades`);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(metaParts.join('  |  '), PAGE_W - MARGIN_X, y + 2.5, { align: 'right' });
  y += 6.5;

  drawWrappedLines(form.title, MARGIN_X, CONTENT_W, 14, 'bold', COLOR_INK);
  if (form.description?.trim()) {
    y += 0.5;
    drawWrappedLines(form.description, MARGIN_X, CONTENT_W, 9.5, 'normal', COLOR_MUTED);
  }
  y += 2;

  if (mode === 'student') {
    ensureSpace(19);
    doc.setFillColor(...COLOR_SOFT_BG);
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.35);
    doc.roundedRect(MARGIN_X, y, CONTENT_W, 16, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...COLOR_INK);
    doc.text('Estudiante: __________________________________________', MARGIN_X + 3, y + 6);
    doc.text('Curso / Div.: ______________', MARGIN_X + 122, y + 6);
    doc.text('Fecha: _____ / _____ / __________', MARGIN_X + 3, y + 12.5);
    doc.text('Nota final: __________ / 10', MARGIN_X + 122, y + 12.5);
    y += 20;
  } else {
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.35);
    doc.line(MARGIN_X, y, PAGE_W - MARGIN_X, y);
    y += 5;
  }

  // Group and render questions respecting sections
  const renderList: Array<{ section: Section | null; questions: Question[] }> = [];
  if (sections.length === 0) {
    renderList.push({ section: null, questions });
  } else {
    const loose = questions.filter((q) => !q.sectionId);
    if (loose.length > 0) renderList.push({ section: null, questions: loose });
    for (const sec of sections) {
      const secQs = questions.filter((q) => q.sectionId === sec.id);
      if (secQs.length > 0) renderList.push({ section: sec, questions: secQs });
    }
  }

  let globalIndex = 0;

  for (const group of renderList) {
    if (group.section) {
      ensureSpace(14);
      doc.setFillColor(...COLOR_SOFT_BG);
      doc.setDrawColor(...COLOR_PRIMARY);
      doc.setLineWidth(0.6);
      doc.line(MARGIN_X, y, MARGIN_X, y + 7);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(...COLOR_PRIMARY);
      doc.text(cleanTextForPdf(group.section.title || 'Seccion'), MARGIN_X + 3, y + 5);
      y += 8.5;
      if (group.section.description?.trim()) {
        drawWrappedLines(group.section.description, MARGIN_X + 3, CONTENT_W - 3, 8.5, 'italic', COLOR_MUTED);
        y += 2;
      }
    }

    for (const q of group.questions) {
      globalIndex += 1;
      const points = q.quizSettings?.points ?? 1;
      const headerLabel = isQuiz
        ? `Actividad ${globalIndex} (${points} ${points === 1 ? 'pt' : 'pts'})${q.required ? ' *' : ''}`
        : `Actividad ${globalIndex}${q.required ? ' *' : ''}`;

      ensureSpace(16);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...COLOR_PRIMARY);
      doc.text(headerLabel.toUpperCase(), MARGIN_X, y + 3);
      if (q.settings?.requireProcedurePhoto) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7.5);
        doc.setTextColor(...COLOR_MUTED);
        doc.text('(Requiere desarrollo escrito / procedimiento)', PAGE_W - MARGIN_X, y + 3, { align: 'right' });
      }
      y += 5;

      drawWrappedLines(q.title || 'Actividad', MARGIN_X, CONTENT_W, 10, 'bold', COLOR_INK);
      if (q.description?.trim()) {
        drawWrappedLines(q.description, MARGIN_X, CONTENT_W, 8.5, 'normal', COLOR_MUTED);
      }
      y += 1.5;

      const correctAnswer = q.quizSettings?.correctAnswer;

      if (q.settings?.table) {
        drawPaperTable(q.settings.table, correctAnswer);
      }

      if (q.type === 'multipleChoice' || q.type === 'checkbox' || q.type === 'dropdown') {
        const correctList = Array.isArray(correctAnswer)
          ? correctAnswer.map(normalizeComparable)
          : correctAnswer !== null && correctAnswer !== undefined
            ? [normalizeComparable(correctAnswer)]
            : [];
        const isMulti = q.type === 'checkbox';

        q.options.forEach((rawOpt, optIdx) => {
          const opt = toOptionItem(rawOpt);
          const isOptCorrect = mode === 'teacher' && correctList.includes(normalizeComparable(opt.label));
          const letter = String.fromCharCode(65 + (optIdx % 26));
          const cleanOptText = `${letter}) ${cleanTextForPdf(opt.label)}`;
          const lines = doc.splitTextToSize(cleanOptText, CONTENT_W - 10) as string[];
          const blockH = Math.max(5.5, lines.length * 4.4);
          ensureSpace(blockH + 1);

          // Draw square or circle marker
          const markerX = MARGIN_X + 2;
          const markerY = y + 1;
          if (isOptCorrect) {
            doc.setFillColor(...COLOR_GREEN);
            doc.setDrawColor(...COLOR_GREEN);
          } else {
            doc.setDrawColor(...COLOR_MUTED);
          }
          doc.setLineWidth(0.35);

          if (isMulti) {
            doc.rect(markerX, markerY, 3.2, 3.2, isOptCorrect ? 'FD' : 'D');
          } else {
            doc.circle(markerX + 1.6, markerY + 1.6, 1.6, isOptCorrect ? 'FD' : 'D');
          }

          doc.setFont('helvetica', isOptCorrect ? 'bold' : 'normal');
          doc.setFontSize(9.5);
          doc.setTextColor(...(isOptCorrect ? COLOR_GREEN : COLOR_INK));
          doc.text(lines, MARGIN_X + 8, y + 3.5);
          y += blockH + 0.8;
        });
      } else if (q.type === 'linearScale') {
        const min = q.settings?.min ?? 1;
        const max = q.settings?.max ?? 5;
        ensureSpace(12);
        const vals: number[] = [];
        for (let v = min; v <= max; v++) vals.push(v);
        let cx = MARGIN_X + 2;
        vals.forEach((v) => {
          const isTarget = mode === 'teacher' && String(correctAnswer ?? '') === String(v);
          doc.setFillColor(...(isTarget ? COLOR_GREEN_BG : COLOR_WHITE));
          doc.setDrawColor(...(isTarget ? COLOR_GREEN : COLOR_BORDER));
          doc.roundedRect(cx, y, 8, 7, 1, 1, 'FD');
          doc.setFont('helvetica', isTarget ? 'bold' : 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(...(isTarget ? COLOR_GREEN : COLOR_INK));
          doc.text(String(v), cx + 4, y + 4.8, { align: 'center' });
          cx += 10.5;
        });
        y += 9;
        if (q.settings?.minLabel || q.settings?.maxLabel) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(7.5);
          doc.setTextColor(...COLOR_MUTED);
          doc.text(
            `${min}: ${cleanTextForPdf(q.settings?.minLabel ?? '')}   |   ${max}: ${cleanTextForPdf(q.settings?.maxLabel ?? '')}`,
            MARGIN_X + 2,
            y + 2
          );
          y += 5;
        }
      } else if (!q.settings?.table) {
        if (mode === 'student') {
          const lineCount = q.type === 'paragraph' ? Math.max(3, Math.min(7, q.settings?.rows ?? 4)) : 2;
          if (q.type === 'date') {
            ensureSpace(8);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(...COLOR_MUTED);
            doc.text('Respuesta:  _____ / _____ / _________', MARGIN_X, y + 4);
            y += 7.5;
          } else if (q.type === 'time') {
            ensureSpace(8);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(...COLOR_MUTED);
            doc.text('Respuesta:  _____ : _____', MARGIN_X, y + 4);
            y += 7.5;
          } else {
            for (let l = 0; l < lineCount; l++) {
              ensureSpace(6.5);
              doc.setDrawColor(...COLOR_BORDER);
              doc.setLineWidth(0.25);
              doc.line(MARGIN_X, y + 5.2, PAGE_W - MARGIN_X, y + 5.2);
              y += 6.2;
            }
          }
        } else if (correctAnswer !== null && correctAnswer !== undefined && String(correctAnswer).trim() !== '') {
          const ansText = Array.isArray(correctAnswer) ? correctAnswer.join(', ') : String(correctAnswer);
          const wrapped = doc.splitTextToSize(`Respuesta esperada: ${cleanTextForPdf(ansText)}`, CONTENT_W - 6) as string[];
          const boxH = wrapped.length * 4.5 + 4;
          ensureSpace(boxH + 2);
          doc.setFillColor(...COLOR_GREEN_BG);
          doc.setDrawColor(...COLOR_GREEN);
          doc.setLineWidth(0.3);
          doc.roundedRect(MARGIN_X, y, CONTENT_W, boxH, 1.2, 1.2, 'FD');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.8);
          doc.setTextColor(...COLOR_GREEN);
          doc.text(wrapped, MARGIN_X + 3, y + 4.8);
          y += boxH + 2;
        }
      }

      if (q.settings?.requireProcedurePhoto && mode === 'student') {
        ensureSpace(22);
        doc.setDrawColor(...COLOR_BORDER);
        doc.setLineWidth(0.25);
        doc.rect(MARGIN_X, y + 1, CONTENT_W, 18, 'D');
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7.5);
        doc.setTextColor(...COLOR_SUBTLE);
        doc.text('Desarrollo / Calculos auxiliares:', MARGIN_X + 2.5, y + 5);
        y += 21;
      }

      y += 4;
      doc.setDrawColor(235, 232, 224);
      doc.setLineWidth(0.2);
      doc.line(MARGIN_X, y, PAGE_W - MARGIN_X, y);
      y += 4;
    }
  }

  // Page numbers footer on every page
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR_SUBTLE);
    doc.text(
      `${cleanTextForPdf(form.title)} — ${mode === 'student' ? 'Hoja del Estudiante' : 'Clave Docente'}`,
      MARGIN_X,
      PAGE_H - 8
    );
    doc.text(`Pagina ${p} de ${pageCount}`, PAGE_W - MARGIN_X, PAGE_H - 8, { align: 'right' });
  }

  const suffix = mode === 'student' ? 'hoja-alumno' : 'clave-docente';
  const versionSuffix = versionLabel ? `-${sanitizeFilename(versionLabel)}` : '';
  doc.save(`${sanitizeFilename(form.title)}${versionSuffix}-${suffix}.pdf`);
}
