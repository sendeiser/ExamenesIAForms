import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useEditorStore } from '../store/editorStore';
import { useResponses } from '../hooks/useResponses';
import {
  scoreQuiz,
  computeGrade1to10,
  formatGrade1to10,
  snapGrade1to10,
  getGrade1to10Label,
  countCompletedActivities,
  type GradeRoundingMode,
  type QuizScore,
} from '../lib/quizScoring';
import {
  filterQuestionsByVersion,
  getFormVersions,
  getQuestionsForResponse,
  getVersionLabel,
  hasMultipleVersions,
  normalizeVersionId,
} from '../lib/examVersions';
import { generateExamResultsPdf } from '../lib/pdfReportGenerator';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { ProcedurePhotoViewerModal } from '../components/ui/ProcedurePhotoViewerModal';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { exportToCsv } from '../utils/export-csv';
import { ArrowLeft, Download, CheckCircle2, XCircle, Trash2, Edit3, Save, X, Users, FileDown, Eye, Camera, ZoomIn, Clock, RotateCcw, Link2, Check, Layers } from 'lucide-react';
import { LatexRenderer } from '../components/ui/LatexRenderer';
import { QuestionTableView } from '../components/form-view/QuestionTableView';
import { toOptionItem } from '../types/question';
import type { FormResponse, ProcedureValidationStatus } from '../types/response';
import type { Question } from '../types/question';

function buildSimulatedProcedurePhoto(studentName: string, activityTitle: string): string {
  const safeName = studentName.replace(/[<>&"]/g, '');
  const safeTitle = activityTitle.slice(0, 42).replace(/[<>&"]/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420">
    <rect width="640" height="420" fill="#fffdf7"/>
    <g stroke="#dbeafe" stroke-width="1">
      <line x1="0" y1="60" x2="640" y2="60"/>
      <line x1="0" y1="100" x2="640" y2="100"/>
      <line x1="0" y1="140" x2="640" y2="140"/>
      <line x1="0" y1="180" x2="640" y2="180"/>
      <line x1="0" y1="220" x2="640" y2="220"/>
      <line x1="0" y1="260" x2="640" y2="260"/>
      <line x1="0" y1="300" x2="640" y2="300"/>
      <line x1="0" y1="340" x2="640" y2="340"/>
    </g>
    <line x1="64" y1="0" x2="64" y2="420" stroke="#fca5a5" stroke-width="2"/>
    <text x="82" y="42" font-family="Georgia, serif" font-size="18" font-weight="bold" fill="#1e3a8a">Hoja de procedimiento (simulada)</text>
    <text x="82" y="88" font-family="monospace" font-size="15" fill="#334155">Alumno: ${safeName}</text>
    <text x="82" y="128" font-family="monospace" font-size="14" fill="#475569">Actividad: ${safeTitle}</text>
    <text x="82" y="172" font-family="Georgia, serif" font-size="17" fill="#0f172a">1) Planteo:   2x + 4 = 12</text>
    <text x="82" y="214" font-family="Georgia, serif" font-size="17" fill="#0f172a">2) Despeje:   2x = 12 - 4 = 8</text>
    <text x="82" y="256" font-family="Georgia, serif" font-size="17" fill="#0f172a">3) Solucion:  x = 8 / 2 = 4</text>
    <rect x="78" y="280" width="160" height="44" rx="8" fill="none" stroke="#1d4ed8" stroke-width="2"/>
    <text x="94" y="308" font-family="Georgia, serif" font-size="17" font-weight="bold" fill="#1d4ed8">Rta verificada</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export default function ExamResultsPage() {
  const { formId } = useParams<{ formId: string }>();
  const form = useEditorStore((s) => s.form);
  const allQuestions = useEditorStore((s) => s.allQuestions);
  const loadForm = useEditorStore((s) => s.loadForm);
  const updateForm = useEditorStore((s) => s.updateForm);
  const { responses, loading, deleteResponse, updateResponse } = useResponses(formId!);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [versionFilter, setVersionFilter] = useState<'all' | string>('all');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [editAnswers, setEditAnswers] = useState<Record<string, any>>({});
  const [simulateOpen, setSimulateOpen] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simConfig, setSimConfig] = useState({ total: 10, pass: 7, fail: 3 });
  const [pdfConfigOpen, setPdfConfigOpen] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [pdfSections, setPdfSections] = useState({
    header: true,
    meta: true,
    summary: true,
    distribution: true,
    studentList: true,
    studentDetail: true,
    footer: true,
  });
  const [editingScores, setEditingScores] = useState(false);
  const [scoreOverrides, setScoreOverrides] = useState<Record<string, number>>({});
  const [gradeOverrides, setGradeOverrides] = useState<Record<string, number>>({});
  const [gradeRounding, setGradeRounding] = useState<GradeRoundingMode>('quarter');
  const [validatingKey, setValidatingKey] = useState<string | null>(null);
  const [zoomedProcedurePhoto, setZoomedProcedurePhoto] = useState<{
    photos: string[];
    index: number;
    title: string;
  } | null>(null);
  const [copiedResultLinkId, setCopiedResultLinkId] = useState<string | null>(null);

  useEffect(() => {
    setVersionFilter('all');
    if (formId) loadForm(formId);
  }, [formId]);

  useEffect(() => {
    const nextScores: Record<string, number> = {};
    const nextGrades: Record<string, number> = {};
    for (const r of responses) {
      if (typeof r.scoreOverride === 'number') nextScores[r.id] = r.scoreOverride;
      if (typeof r.gradeOverride === 'number') nextGrades[r.id] = r.gradeOverride;
    }
    setScoreOverrides(nextScores);
    setGradeOverrides(nextGrades);
  }, [responses]);

  useEffect(() => {
    if (form?.settings?.gradeRounding) {
      setGradeRounding(form.settings.gradeRounding);
    }
  }, [form?.settings?.gradeRounding]);

  function handleChangeGradeRounding(nextMode: GradeRoundingMode) {
    setGradeRounding(nextMode);
    if (form?.settings) {
      updateForm({ settings: { ...form.settings, gradeRounding: nextMode } });
    }
  }

  async function resetAllOverrides() {
    const affectedIds = new Set([
      ...Object.keys(scoreOverrides),
      ...Object.keys(gradeOverrides),
    ]);
    setScoreOverrides({});
    setGradeOverrides({});
    await Promise.all(
      Array.from(affectedIds).map((id) =>
        updateResponse(id, { scoreOverride: null, gradeOverride: null })
      )
    );
  }

  async function handleCopyResultLink(responseId: string) {
    if (!formId) return;
    const url = `${window.location.origin}/view/${formId}?result=${responseId}`;
    await navigator.clipboard.writeText(url);
    setCopiedResultLinkId(responseId);
    setTimeout(() => setCopiedResultLinkId((prev) => (prev === responseId ? null : prev)), 2000);
  }

  const versions = useMemo(() => getFormVersions(form), [form]);
  const multiVersion = hasMultipleVersions(form);

  const responseVersionMap = useMemo(() => {
    const map = new Map<string, { versionId: string; versionLabel: string; questions: Question[] }>();
    for (const r of responses) {
      const studentQs = getQuestionsForResponse(allQuestions, r);
      const vId = normalizeVersionId(r.versionId ?? studentQs[0]?.versionId);
      const vLabel = getVersionLabel(form, vId, r.versionLabel);
      map.set(r.id, { versionId: vId, versionLabel: vLabel, questions: studentQs });
    }
    return map;
  }, [responses, allQuestions, form]);

  const versionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const entry of responseVersionMap.values()) {
      counts[entry.versionId] = (counts[entry.versionId] ?? 0) + 1;
    }
    return counts;
  }, [responseVersionMap]);

  const scored = useMemo(() => {
    if (!form?.settings?.isQuiz) return null;
    return responses.map((r) => {
      const studentQs = responseVersionMap.get(r.id)?.questions ?? allQuestions;
      return {
        response: r,
        score: scoreQuiz(studentQs, r.answers, r.procedureValidations),
      };
    });
  }, [responses, allQuestions, responseVersionMap, form]);

  const displayScores = useMemo(() => {
    if (!scored) return null;
    return scored.map((item) => {
      const override = scoreOverrides[item.response.id];
      if (override === undefined || override === item.score.earnedPoints) return item;
      return {
        ...item,
        score: {
          ...item.score,
          earnedPoints: override,
          percentage: item.score.totalPoints > 0 ? (override / item.score.totalPoints) * 100 : 0,
        },
      };
    });
  }, [scored, scoreOverrides]);

  const filteredResponses = useMemo(() => {
    if (!multiVersion || versionFilter === 'all') return responses;
    return responses.filter((r) => responseVersionMap.get(r.id)?.versionId === versionFilter);
  }, [responses, multiVersion, versionFilter, responseVersionMap]);

  const filteredDisplayScores = useMemo(() => {
    if (!displayScores) return null;
    if (!multiVersion || versionFilter === 'all') return displayScores;
    return displayScores.filter(
      (item) => responseVersionMap.get(item.response.id)?.versionId === versionFilter
    );
  }, [displayScores, multiVersion, versionFilter, responseVersionMap]);

  const selectedStudentItem = useMemo(() => {
    if (!selectedStudentId) return null;
    const items: any[] = displayScores ?? scored ?? responses;
    const found = items.find((item) => (item.response ?? item).id === selectedStudentId);
    if (!found) return null;
    return {
      response: (found.response ?? found) as FormResponse,
      score: (found.score ?? null) as QuizScore | null,
    };
  }, [selectedStudentId, displayScores, scored, responses]);

  if (loading) return <LoadingSpinner />;

  function getStudentProcedureSummary(r: FormResponse) {
    const studentQs = responseVersionMap.get(r.id)?.questions ?? allQuestions;
    const photoQs = studentQs.filter((q) => q.settings?.requireProcedurePhoto);
    if (photoQs.length === 0) return { total: 0, pending: 0, validated: 0, rejected: 0 };
    let pending = 0;
    let validated = 0;
    let rejected = 0;
    for (const q of photoQs) {
      const status = r.procedureValidations?.[q.id];
      if (status === 'validated') validated++;
      else if (status === 'rejected') rejected++;
      else pending++;
    }
    return { total: photoQs.length, pending, validated, rejected };
  }

  async function handleValidateProcedure(
    response: FormResponse,
    questionId: string,
    nextStatus: ProcedureValidationStatus | null
  ) {
    setValidatingKey(`${response.id}:${questionId}`);
    try {
      const nextValidations: Record<string, ProcedureValidationStatus> = {
        ...(response.procedureValidations ?? {}),
      };
      if (nextStatus === null) {
        delete nextValidations[questionId];
      } else {
        nextValidations[questionId] = nextStatus;
      }
      await updateResponse(response.id, { procedureValidations: nextValidations });
    } finally {
      setValidatingKey(null);
    }
  }

  function getStudentGrade(responseId: string, earned: number, total: number): number {
    const manualGrade = gradeOverrides[responseId];
    if (manualGrade !== undefined) {
      return snapGrade1to10(manualGrade, gradeRounding);
    }
    return computeGrade1to10(earned, total, gradeRounding);
  }

  const activeScoredList = filteredDisplayScores;
  const activeResponsesList = filteredResponses;

  const totalRespondents = activeScoredList?.length ?? activeResponsesList.length;
  const totalPoints = activeScoredList?.[0]?.score.totalPoints ?? 0;
  const avgEarned = activeScoredList && activeScoredList.length > 0
    ? activeScoredList.reduce((s, r) => s + r.score.earnedPoints, 0) / activeScoredList.length
    : 0;
  const sorted = activeScoredList ? [...activeScoredList].sort((a, b) => b.score.earnedPoints - a.score.earnedPoints) : [];
  const highestEarned = sorted[0]?.score.earnedPoints ?? 0;
  const lowestEarned = sorted[sorted.length - 1]?.score.earnedPoints ?? 0;

  const studentGrades = activeScoredList
    ? activeScoredList.map((item) => getStudentGrade(item.response.id, item.score.earnedPoints, item.score.totalPoints))
    : [];
  const avgGrade = studentGrades.length > 0
    ? studentGrades.reduce((sum, g) => sum + g, 0) / studentGrades.length
    : 0;
  const highestGrade = studentGrades.length > 0 ? Math.max(...studentGrades) : 1;
  const lowestGrade = studentGrades.length > 0 ? Math.min(...studentGrades) : 1;
  const passed = studentGrades.filter((g) => g >= 6).length;
  const passRate = activeScoredList && activeScoredList.length > 0 ? (passed / activeScoredList.length) * 100 : 0;

  function handleExport() {
    if (!form?.settings?.isQuiz || !activeScoredList) {
      const headers = multiVersion
        ? ['Nombre', 'Tema', 'Email', 'Actividades', 'Fecha']
        : ['Nombre', 'Email', 'Fecha', ...allQuestions.map((q) => q.title)];
      const rows = activeResponsesList.map((r) => {
        const meta = responseVersionMap.get(r.id);
        const studentQs = meta?.questions ?? allQuestions;
        if (multiVersion) {
          return [
            r.respondent?.name ?? '',
            meta?.versionLabel ?? 'Tema 1',
            r.respondent?.email ?? r.respondentEmail ?? '',
            `${countCompletedActivities(studentQs, r.answers)}/${studentQs.length}`,
            r.submittedAt?.toLocaleString('es-ES') ?? '',
          ];
        }
        return [
          r.respondent?.name ?? '',
          r.respondent?.email ?? r.respondentEmail ?? '',
          r.submittedAt?.toLocaleString('es-ES') ?? '',
          ...allQuestions.map((q) => String(r.answers[q.id] ?? '')),
        ];
      });
      exportToCsv(`${form?.title ?? 'resultados'}.csv`, [headers, ...rows]);
      return;
    }

    const list = activeScoredList;
    if (multiVersion) {
      const headers = ['Nombre', 'Tema', 'Email', 'Actividades', 'Puntaje', 'Total', 'Nota (1-10)', 'Porcentaje', 'Aprobado', 'Fecha'];
      const rows = list.map(({ response: r, score: s }) => {
        const meta = responseVersionMap.get(r.id);
        const studentQs = meta?.questions ?? allQuestions;
        const grade = getStudentGrade(r.id, s.earnedPoints, s.totalPoints);
        return [
          r.respondent?.name ?? '',
          meta?.versionLabel ?? 'Tema 1',
          r.respondent?.email ?? r.respondentEmail ?? '',
          `${countCompletedActivities(studentQs, r.answers)}/${studentQs.length}`,
          String(s.earnedPoints),
          String(s.totalPoints),
          formatGrade1to10(grade, gradeRounding),
          `${s.percentage.toFixed(0)}%`,
          grade >= 6 ? 'Sí' : 'No',
          r.submittedAt?.toLocaleString('es-ES') ?? '',
        ];
      });
      exportToCsv(`${form?.title ?? 'resultados'}_calificaciones.csv`, [headers, ...rows]);
      return;
    }

    const headers = [
      'Nombre', 'Email', 'Puntaje', 'Total', 'Nota (1-10)', 'Porcentaje', 'Aprobado',
      ...allQuestions.flatMap((q) => [
        `${q.title} (respuesta)`,
        `${q.title} (correcta)`,
        `${q.title} (puntos)`,
      ]),
    ];

    const rows = list.map(({ response: r, score: s }) => {
      const grade = getStudentGrade(r.id, s.earnedPoints, s.totalPoints);
      return [
        r.respondent?.name ?? '',
        r.respondent?.email ?? r.respondentEmail ?? '',
        String(s.earnedPoints),
        String(s.totalPoints),
        formatGrade1to10(grade, gradeRounding),
        `${s.percentage.toFixed(0)}%`,
        grade >= 6 ? 'Sí' : 'No',
        ...s.results.flatMap((res) => [
          Array.isArray(res.userAnswer) ? res.userAnswer.join('; ') : String(res.userAnswer ?? ''),
          Array.isArray(res.correctAnswer) ? res.correctAnswer.join('; ') : String(res.correctAnswer ?? ''),
          `${res.earned}/${res.points}`,
        ]),
      ];
    });

    exportToCsv(`${form?.title ?? 'resultados'}_calificaciones.csv`, [headers, ...rows]);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const deletedId = deleteTarget;
    await deleteResponse(deletedId);
    if (selectedStudentId === deletedId) setSelectedStudentId(null);
    if (editTarget === deletedId) cancelEdit();
    setDeleteTarget(null);
  }

  function startEdit(r: FormResponse) {
    setSelectedStudentId(r.id);
    setEditTarget(r.id);
    setEditAnswers({ ...r.answers });
  }

  function cancelEdit() {
    setEditTarget(null);
    setEditAnswers({});
  }

  function closeStudentModal() {
    if (selectedStudentItem && editTarget === selectedStudentItem.response.id) {
      cancelEdit();
    }
    setZoomedProcedurePhoto(null);
    setSelectedStudentId(null);
  }

  async function saveEdit() {
    if (!editTarget) return;
    await updateResponse(editTarget, { answers: editAnswers });
    setEditTarget(null);
    setEditAnswers({});
  }

  function renderAnswerInput(q: Question, value: any, onChange: (v: any) => void) {
    switch (q.type) {
      case 'text':
      case 'paragraph':
        return (
          <input
            type="text"
            value={String(value ?? '')}
            onChange={(e) => onChange(e.target.value)}
            className="w-full text-xs border rounded px-2 py-1"
          />
        );
      case 'multipleChoice':
        return (
          <select value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} className="text-xs border rounded px-2 py-1">
            <option value="">—</option>
            {(q.options ?? []).map((opt: any, i: number) => {
              const item = toOptionItem(opt);
              return <option key={i} value={item.label}>{item.label}</option>;
            })}
          </select>
        );
      case 'checkbox': {
        const selected: string[] = Array.isArray(value) ? value : [];
        return (
          <div className="flex flex-wrap gap-1">
            {(q.options ?? []).map((opt: any, i: number) => {
              const item = toOptionItem(opt);
              const checked = selected.includes(item.label);
              return (
                <label key={`${item.label}-${i}`} className="flex items-center gap-1 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const next = selected.includes(item.label)
                        ? selected.filter((s) => s !== item.label)
                        : [...selected, item.label];
                      onChange(next);
                    }}
                  />
                  {item.label}
                </label>
              );
            })}
          </div>
        );
      }
      case 'dropdown':
        return (
          <select value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} className="text-xs border rounded px-2 py-1">
            <option value="">—</option>
            {(q.options ?? []).map((opt: any, i: number) => {
              const item = toOptionItem(opt);
              return <option key={i} value={item.label}>{item.label}</option>;
            })}
          </select>
        );
      default:
        return <span className="text-xs text-gray-400">{String(value ?? '')}</span>;
    }
  }

  function renderAnswerReadonly(_q: Question, value: any) {
    if (Array.isArray(value)) return value.join(', ');
    return String(value ?? '—');
  }

  const firstNames = [
    'Sofía', 'Mateo', 'Valentina', 'Santiago', 'Camila', 'Benjamín', 'Isabella', 'Sebastián',
    'Luciana', 'Julián', 'María', 'Emiliano', 'Ximena', 'Nicolás', 'Renata', 'Diego',
    'Emma', 'Lucas', 'Abigail', 'Samuel', 'Valeria', 'Gabriel', 'Antonella', 'Daniel',
    'Catalina', 'Pablo', 'Mía', 'Adrián', 'Alexa', 'Fernando',
  ];

  const lastNames = [
    'García', 'Rodríguez', 'Martínez', 'López', 'Hernández', 'González', 'Pérez', 'Ramírez',
    'Torres', 'Flores', 'Rivera', 'Castillo', 'Reyes', 'Ortiz', 'Morales', 'Cruz',
    'Vargas', 'Mendoza', 'Ramos', 'Jiménez', 'Ríos', 'Castro', 'Romero', 'Medina',
    'Silva', 'Delgado', 'Sandoval', 'Guerrero', 'Rojas', 'Acosta',
  ];

  function randomItem<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function randomName(): string {
    return `${randomItem(firstNames)} ${randomItem(lastNames)}`;
  }

  function generateCorrectAnswer(q: Question): any {
    const s = q.quizSettings;
    if (!s || s.correctAnswer === null || s.correctAnswer === undefined) return null;
    return s.correctAnswer;
  }

  function generateWrongAnswer(q: Question): any {
    const s = q.quizSettings;
    if (!s || s.correctAnswer === null || s.correctAnswer === undefined) return null;

    const correct = s.correctAnswer;

    switch (q.type) {
      case 'multipleChoice':
      case 'dropdown': {
        const optionLabels = (q.options ?? []).map((o) => toOptionItem(o).label);
        const wrongOptions = optionLabels.filter((lbl) => lbl !== correct);
        if (wrongOptions.length > 0) return randomItem(wrongOptions);
        return correct;
      }
      case 'checkbox': {
        const correctArr = (Array.isArray(correct) ? correct : [String(correct)]) as string[];
        const optionLabels = (q.options ?? []).map((o) => toOptionItem(o).label);
        const wrongOptions = optionLabels.filter((lbl) => !correctArr.includes(lbl));
        if (wrongOptions.length > 0) {
          const pickCount = Math.max(1, Math.floor(Math.random() * wrongOptions.length));
          const shuffled = [...wrongOptions].sort(() => Math.random() - 0.5);
          return shuffled.slice(0, pickCount);
        }
        return [];
      }
      case 'linearScale': {
        const min = q.settings?.min ?? 1;
        const max = q.settings?.max ?? 5;
        const wrong = Math.floor(Math.random() * (max - min + 1)) + min;
        return String(wrong === Number(correct) ? (wrong + 1 > max ? min : wrong + 1) : wrong);
      }
      case 'text':
      case 'paragraph':
        return 'Respuesta incorrecta';
      case 'date':
        return '2025-01-01';
      case 'time':
        return '12:00';
      default:
        return 'N/A';
    }
  }

  async function handleSimulate() {
    if (!formId || !form?.settings?.isQuiz) return;
    setSimulating(true);

    // Determine which students pass/fail
    const passCount = Math.min(simConfig.pass, simConfig.total);
    const failCount = simConfig.total - passCount;

    const students: { name: string; pass: boolean }[] = [];
    for (let i = 0; i < passCount; i++) students.push({ name: randomName(), pass: true });
    for (let i = 0; i < failCount; i++) students.push({ name: randomName(), pass: false });
    students.sort(() => Math.random() - 0.5);

    const submissions = students.map((student, sIdx) => {
      const chosenVersion = versions[sIdx % versions.length];
      const versionQs = filterQuestionsByVersion(allQuestions, chosenVersion.id).filter(
        (q) => q.quizSettings || q.settings?.requireProcedurePhoto
      );
      const answers: Record<string, any> = {};
      const procedurePhotos: Record<string, string[]> = {};
      for (const q of versionQs) {
        if (q.quizSettings) {
          // Pass students: 90% chance correct; Fail students: 10% chance correct
          const shouldBeCorrect = student.pass ? Math.random() < 0.9 : Math.random() < 0.1;
          answers[q.id] = shouldBeCorrect ? generateCorrectAnswer(q) : generateWrongAnswer(q);
        }
        if (q.settings?.requireProcedurePhoto) {
          procedurePhotos[q.id] = [buildSimulatedProcedurePhoto(student.name, q.title || 'Actividad')];
        }
      }
      return {
        respondentId: null,
        respondentEmail: `${student.name.toLowerCase().replace(/\s+/g, '.')}@email.com`,
        respondent: { name: student.name, email: `${student.name.toLowerCase().replace(/\s+/g, '.')}@email.com` },
        versionId: chosenVersion.id,
        versionLabel: chosenVersion.label,
        answers,
        ...(Object.keys(procedurePhotos).length > 0 ? { procedurePhotos } : {}),
        submittedAt: Timestamp.now(),
      };
    });

    const col = collection(db, 'forms', formId, 'responses');
    await Promise.all(submissions.map((s) => addDoc(col, s)));

    setSimulating(false);
    setSimulateOpen(false);
  }

  async function handleDownloadPdf() {
    setPdfError('');
    setPdfGenerating(true);
    setPdfConfigOpen(false);

    try {
      await new Promise((r) => setTimeout(r, 0));
      const rawItems = activeScoredList;
      const itemsForPdf = rawItems
        ? rawItems.map((it) => ({ response: it.response, score: it.score }))
        : activeResponsesList.map((r) => ({ response: r, score: null }));

      generateExamResultsPdf({
        form,
        questions: allQuestions,
        allQuestions,
        items: itemsForPdf,
        scoreOverrides,
        gradeOverrides,
        gradeRounding,
        sections: pdfSections,
      });
    } catch (err) {
      console.error('Error exporting PDF:', err);
      setPdfError(
        err instanceof Error
          ? `No se pudo generar el PDF: ${err.message}`
          : 'No se pudo generar el archivo PDF.'
      );
    } finally {
      setPdfGenerating(false);
    }
  }

  const hasManualOverrides =
    Object.keys(scoreOverrides).length > 0 || Object.keys(gradeOverrides).length > 0;

  return (
    <div className="space-y-6 print:space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Link to={`/form/${formId}/analytics`}>
            <Button variant="ghost"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <h1 className="text-xl font-bold">{form?.title ?? 'Resultados'} — Informe</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {form?.settings?.isQuiz && (
            <div
              className="inline-flex rounded-lg border border-sand-300 bg-sand-100 p-0.5"
              role="group"
              aria-label="Modo de escala de nota"
            >
              <button
                type="button"
                onClick={() => handleChangeGradeRounding('quarter')}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  gradeRounding === 'quarter'
                    ? 'bg-white text-brand-700 font-semibold shadow-sm'
                    : 'text-ink-subtle hover:text-ink'
                }`}
              >
                Nota 1-10 (0.25)
              </button>
              <button
                type="button"
                onClick={() => handleChangeGradeRounding('integer')}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  gradeRounding === 'integer'
                    ? 'bg-white text-brand-700 font-semibold shadow-sm'
                    : 'text-ink-subtle hover:text-ink'
                }`}
              >
                Nota 1-10 (Redondeado)
              </button>
            </div>
          )}
          <Button
            variant={editingScores ? 'primary' : 'secondary'}
            onClick={() => setEditingScores(!editingScores)}
          >
            <Edit3 className="h-4 w-4" />
            <span className="hidden sm:inline">{editingScores ? 'Finalizar edición' : 'Editar notas'}</span>
          </Button>
          {hasManualOverrides && (
            <Button
              variant="ghost"
              onClick={resetAllOverrides}
              className="text-xs text-amber-700 hover:bg-amber-50"
            >
              Restablecer notas
            </Button>
          )}
          <Button variant="secondary" onClick={() => setSimulateOpen(true)} disabled={!form?.settings?.isQuiz}>
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Simular</span>
          </Button>
          <Button variant="secondary" onClick={() => setPdfConfigOpen(true)} disabled={pdfGenerating}>
            <FileDown className="h-4 w-4" />
            <span className="hidden sm:inline">{pdfGenerating ? 'Generando...' : 'Exportar PDF'}</span>
          </Button>
          <Button variant="secondary" onClick={handleExport}>
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Exportar CSV</span>
          </Button>
        </div>
      </div>

      {pdfError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-2 print:hidden">
          <span>{pdfError}</span>
          <button type="button" onClick={() => setPdfError('')} className="p-1 hover:bg-red-100 rounded">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Header visible in print ── */}
      <div className="hidden print:block">
        <h1 className="text-xl font-bold">{form?.title ?? 'Resultados'} — Informe</h1>
        <p className="text-xs text-gray-500">Generado el {new Date().toLocaleString()}</p>
      </div>

      {/* ── Version filter chips ── */}
      {multiVersion && (
        <div className="flex flex-wrap items-center gap-1.5 print:hidden">
          <span className="inline-flex items-center gap-1 text-xs font-mono uppercase tracking-wider text-ink-light mr-1">
            <Layers className="h-3.5 w-3.5 text-brand-600" />
            Filtrar tema:
          </span>
          <button
            type="button"
            onClick={() => setVersionFilter('all')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors ${
              versionFilter === 'all'
                ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                : 'bg-white text-ink border-sand-300 hover:bg-sand-100'
            }`}
          >
            Todos ({responses.length})
          </button>
          {versions.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setVersionFilter(v.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors ${
                versionFilter === v.id
                  ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                  : 'bg-white text-ink border-sand-300 hover:bg-sand-100'
              }`}
            >
              {v.label} ({versionCounts[v.id] ?? 0})
            </button>
          ))}
        </div>
      )}

      {/* ── Stats cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 print:grid-cols-5 print:gap-2">
        <Card className="p-4 text-center">
          <p className="font-mono text-2xl font-bold text-gray-900">{totalRespondents}</p>
          <p className="text-xs text-gray-500">Total estudiantes</p>
        </Card>
        {scored && (
          <>
            <Card className="p-4 text-center">
              <p className="font-mono text-2xl font-bold text-brand-600">{avgGrade.toFixed(2)} / 10</p>
              <p className="text-xs text-ink-light">Promedio ({avgEarned.toFixed(1)}/{totalPoints} pts)</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="font-mono text-2xl font-bold text-green-600">
                {formatGrade1to10(highestGrade, gradeRounding)} / 10
              </p>
              <p className="text-xs text-gray-500">Nota más alta ({highestEarned}/{totalPoints} pts)</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="font-mono text-2xl font-bold text-red-600">
                {formatGrade1to10(lowestGrade, gradeRounding)} / 10
              </p>
              <p className="text-xs text-gray-500">Nota más baja ({lowestEarned}/{totalPoints} pts)</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="font-mono text-2xl font-bold text-blue-600">{passRate.toFixed(1)}%</p>
              <p className="text-xs text-gray-500">Aprobación (&gt;= 6)</p>
            </Card>
          </>
        )}
      </div>

      {/* ── Responses table ── */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm hidden sm:table">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-8 print:hidden" />
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
                {multiVersion && (
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Tema</th>
                )}
                <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Actividades</th>
                {scored && (
                  <>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Puntaje</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Nota (1-10)</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">%</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Aprobado</th>
                  </>
                )}
                <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha y hora</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-24 print:hidden">Acciones</th>
              </tr>
            </thead>
              <tbody>
                {(activeScoredList ?? activeResponsesList).map((item: any) => {
                  const r: FormResponse = item.response ?? item;
                  const s: QuizScore | null = item.score ?? null;
                  const isSelected = selectedStudentId === r.id;
                  const editing = editTarget === r.id;
                  const earnedVal = s ? (scoreOverrides[r.id] ?? s.earnedPoints) : 0;
                  const pctVal = s && s.totalPoints > 0 ? (earnedVal / s.totalPoints) * 100 : 0;
                  const studentGrade = s ? getStudentGrade(r.id, earnedVal, s.totalPoints) : 1;
                  const gradeEdited = gradeOverrides[r.id] !== undefined;
                  const procSummary = getStudentProcedureSummary(r);
                  const versionMeta = responseVersionMap.get(r.id);
                  const studentQs = versionMeta?.questions ?? allQuestions;
                  const versionLabel = versionMeta?.versionLabel ?? 'Tema 1';
                  const completedCount = countCompletedActivities(studentQs, r.answers);
                  const correctCount = s ? s.results.filter((res) => res.isCorrect).length : null;

                return (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedStudentId(r.id)}
                    title="Haz clic para ver todo lo que hizo este alumno"
                    className={`group border-b cursor-pointer transition-colors ${
                      isSelected ? 'bg-brand-50/70' : 'hover:bg-brand-50/40'
                    }`}
                  >
                    <td className="px-4 py-3 text-gray-400 print:hidden">
                      <Eye className={`h-4 w-4 transition-colors ${isSelected ? 'text-brand-600' : 'text-gray-400 group-hover:text-brand-600'}`} />
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{r.respondent?.name || '—'}</span>
                        {procSummary.pending > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                            <Clock className="h-3 w-3" />
                            Falta validar procedimiento ({procSummary.pending})
                          </span>
                        )}
                        {procSummary.total > 0 && procSummary.pending === 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 border border-green-200 px-2 py-0.5 text-[10px] font-semibold text-green-800">
                            <Camera className="h-3 w-3" />
                            Procedimiento validado
                          </span>
                        )}
                      </div>
                    </td>
                    {multiVersion && (
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex rounded-full bg-purple-50 border border-purple-200 px-2 py-0.5 text-[11px] font-mono font-semibold text-purple-800">
                          {versionLabel}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3 text-gray-500">{r.respondent?.email || r.respondentEmail || '—'}</td>
                    <td className="px-4 py-3 text-center font-mono text-xs text-ink">
                      <span className="font-semibold">{completedCount}/{studentQs.length}</span>
                      {correctCount !== null && s && (
                        <span className="block text-[10px] text-ink-subtle">
                          {correctCount}/{s.results.length} ok
                        </span>
                      )}
                    </td>
                    {s && (
                      <>
                        <td
                          className="px-4 py-3 text-center"
                          onClick={editingScores ? (e) => e.stopPropagation() : undefined}
                        >
                          {editingScores ? (
                            <input
                              type="number"
                              min={0}
                              max={s.totalPoints}
                              value={earnedVal}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                const v = Math.max(0, Math.min(s.totalPoints, Number(e.target.value) || 0));
                                setScoreOverrides((prev) => ({ ...prev, [r.id]: v }));
                                setGradeOverrides((prev) => {
                                  if (prev[r.id] === undefined) return prev;
                                  const next = { ...prev };
                                  delete next[r.id];
                                  return next;
                                });
                                void updateResponse(r.id, { scoreOverride: v, gradeOverride: null });
                              }}
                              className="w-16 text-center border rounded px-1 py-0.5 text-sm font-mono"
                            />
                          ) : (
                            <span className={scoreOverrides[r.id] !== undefined ? 'text-amber-600' : ''}>
                              {earnedVal}/{s.totalPoints}
                            </span>
                          )}
                        </td>
                        <td
                          className="px-4 py-3 text-center font-mono"
                          onClick={editingScores ? (e) => e.stopPropagation() : undefined}
                        >
                          {editingScores ? (
                            <input
                              type="number"
                              min={1}
                              max={10}
                              step={gradeRounding === 'integer' ? 1 : 0.25}
                              value={studentGrade}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                const parsed = Number(e.target.value);
                                if (Number.isNaN(parsed)) return;
                                const snapped = snapGrade1to10(parsed, gradeRounding);
                                setGradeOverrides((prev) => ({
                                  ...prev,
                                  [r.id]: snapped,
                                }));
                                void updateResponse(r.id, { gradeOverride: snapped });
                              }}
                              className="w-16 text-center border rounded px-1 py-0.5 text-sm font-mono font-bold"
                            />
                          ) : (
                            <span
                              className={`font-bold ${
                                gradeEdited
                                  ? 'text-amber-600'
                                  : studentGrade >= 6
                                    ? 'text-brand-700'
                                    : 'text-red-600'
                              }`}
                            >
                              {formatGrade1to10(studentGrade, gradeRounding)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center font-mono">
                          {pctVal.toFixed(0)}%
                        </td>
                        <td className="px-4 py-3 text-center">
                          {studentGrade >= 6 ? (
                            <span className="text-green-600 font-medium">Aprobado</span>
                          ) : (
                            <span className="text-red-600 font-medium">Reprobado</span>
                          )}
                        </td>
                      </>
                    )}
                    <td className="px-4 py-3 text-gray-400 text-xs font-mono">
                      {r.submittedAt?.toLocaleString('es-ES') ?? ''}
                    </td>
                    <td className="px-4 py-3 print:hidden" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        {editing ? (
                          <>
                            <button onClick={saveEdit} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Guardar">
                              <Save className="h-4 w-4" />
                            </button>
                            <button onClick={cancelEdit} className="p-1 text-gray-400 hover:bg-gray-100 rounded" title="Cancelar">
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEdit(r)} className="p-1 text-brand-600 hover:bg-brand-50 rounded" title="Editar respuestas">
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button onClick={() => setDeleteTarget(r.id)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Eliminar">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* ── Mobile card view (no table) ── */}
          <div className="sm:hidden divide-y">
            {(activeScoredList ?? activeResponsesList).map((item: any) => {
              const r: FormResponse = item.response ?? item;
              const s: QuizScore | null = item.score ?? null;
              const isSelected = selectedStudentId === r.id;
              const editing = editTarget === r.id;
              const earnedVal = s ? (scoreOverrides[r.id] ?? s.earnedPoints) : 0;
              const pctVal = s && s.totalPoints > 0 ? (earnedVal / s.totalPoints) * 100 : 0;
              const studentGrade = s ? getStudentGrade(r.id, earnedVal, s.totalPoints) : 1;
              const procSummary = getStudentProcedureSummary(r);
              const versionMeta = responseVersionMap.get(r.id);
              const studentQs = versionMeta?.questions ?? allQuestions;
              const versionLabel = versionMeta?.versionLabel ?? 'Tema 1';
              const completedCount = countCompletedActivities(studentQs, r.answers);

              return (
                <div
                  key={r.id}
                  onClick={() => setSelectedStudentId(r.id)}
                  className={`px-4 py-3 space-y-1.5 cursor-pointer transition-colors ${
                    isSelected ? 'bg-brand-50/70' : 'hover:bg-brand-50/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <Eye className={`h-4 w-4 -ml-1 shrink-0 ${isSelected ? 'text-brand-600' : 'text-gray-400'}`} />
                      <span className="font-medium text-sm">{r.respondent?.name || '—'}</span>
                      {multiVersion && (
                        <span className="inline-flex rounded-full bg-purple-50 border border-purple-200 px-2 py-0.5 text-[10px] font-mono font-semibold text-purple-800">
                          {versionLabel}
                        </span>
                      )}
                      {procSummary.pending > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                          <Clock className="h-3 w-3" />
                          Falta validar ({procSummary.pending})
                        </span>
                      )}
                      {procSummary.total > 0 && procSummary.pending === 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 border border-green-200 px-2 py-0.5 text-[10px] font-semibold text-green-800">
                          <Camera className="h-3 w-3" />
                          Validado
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 print:hidden" onClick={(e) => e.stopPropagation()}>
                      {editing ? (
                        <>
                          <button onClick={saveEdit} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Guardar">
                            <Save className="h-4 w-4" />
                          </button>
                          <button onClick={cancelEdit} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded" title="Cancelar">
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(r)} className="p-1.5 text-brand-600 hover:bg-brand-50 rounded" title="Editar respuestas">
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button onClick={() => setDeleteTarget(r.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Eliminar">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-gray-500">{r.respondent?.email || r.respondentEmail || '—'}</div>

                  <div className="flex items-center gap-3 text-xs flex-wrap">
                    <span>
                      Actividades: <strong className="font-mono">{completedCount}/{studentQs.length}</strong>
                    </span>
                    {s && (
                      <>
                        <span>
                          Nota:{' '}
                          <strong className={`font-mono ${studentGrade >= 6 ? 'text-brand-700' : 'text-red-600'}`}>
                            {formatGrade1to10(studentGrade, gradeRounding)}/10
                          </strong>
                        </span>
                        <span>
                          Puntaje: <strong className={scoreOverrides[r.id] !== undefined ? 'text-amber-600' : ''}>{earnedVal}/{s.totalPoints}</strong>
                        </span>
                        <span className="font-mono">{pctVal.toFixed(0)}%</span>
                        <span className={studentGrade >= 6 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                          {studentGrade >= 6 ? 'Aprobado' : 'Reprobado'}
                        </span>
                      </>
                    )}
                    <span className="text-gray-400 ml-auto font-mono">{r.submittedAt?.toLocaleString('es-ES') ?? ''}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {activeResponsesList.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            {multiVersion && versionFilter !== 'all'
              ? 'Sin respuestas registradas para este tema'
              : 'Sin respuestas aún'}
          </div>
        )}
      </Card>

      {/* ── Student full detail modal ── */}
      <Modal
        open={selectedStudentItem !== null}
        onClose={closeStudentModal}
        title={
          selectedStudentItem
            ? `Detalle de ${selectedStudentItem.response.respondent?.name || 'estudiante'}`
            : 'Detalle del estudiante'
        }
        size="lg"
      >
        {selectedStudentItem && (() => {
          const { response: r, score: s } = selectedStudentItem;
          const studentVersionMeta = responseVersionMap.get(r.id);
          const studentQuestions = studentVersionMeta?.questions ?? allQuestions;
          const studentVersionLabel = studentVersionMeta?.versionLabel ?? 'Tema 1';
          const editing = editTarget === r.id;
          const currentAnswers = editing ? editAnswers : r.answers;
          const scoreResultMap = new Map(s?.results.map((res) => [res.questionId, res]) ?? []);
          const effectiveEarned = s ? (scoreOverrides[r.id] ?? s.earnedPoints) : 0;
          const pct = s && s.totalPoints > 0 ? (effectiveEarned / s.totalPoints) * 100 : 0;
          const studentGrade = s ? getStudentGrade(r.id, effectiveEarned, s.totalPoints) : 1;
          const correctCount = s ? s.results.filter((res) => res.isCorrect).length : 0;
          const wrongCount = s ? s.results.filter((res) => !res.isCorrect).length : 0;
          const hasOverride = s ? (scoreOverrides[r.id] !== undefined || gradeOverrides[r.id] !== undefined) : false;

          return (
            <div className="space-y-4">
              {/* Summary banner */}
              <div className="rounded-xl border border-sand-300 bg-sand-50/70 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-display text-base font-bold text-ink truncate">
                      {r.respondent?.name || 'Estudiante sin nombre'}
                    </p>
                    {multiVersion && (
                      <span className="inline-flex rounded-full bg-purple-100 border border-purple-200 px-2 py-0.5 text-[10px] font-mono font-semibold text-purple-800">
                        {studentVersionLabel}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink-light truncate">
                    {r.respondent?.email || r.respondentEmail || 'Sin correo'}
                  </p>
                  {r.submittedAt && (
                    <p className="text-[11px] font-mono text-ink-subtle pt-0.5">
                      Entregado: {r.submittedAt.toLocaleString('es-ES')}
                    </p>
                  )}
                </div>

                {s && (
                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1 shrink-0">
                    <div className="flex items-baseline gap-2">
                      <span
                        className={`font-mono text-2xl font-bold ${
                          hasOverride
                            ? 'text-amber-600'
                            : studentGrade >= 6
                              ? 'text-brand-700'
                              : 'text-red-600'
                        }`}
                      >
                        {formatGrade1to10(studentGrade, gradeRounding)}/10
                      </span>
                      <span className="font-mono text-xs text-ink-subtle">
                        ({effectiveEarned}/{s.totalPoints} · {pct.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-ink-light">{getGrade1to10Label(studentGrade)}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          studentGrade >= 6 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {studentGrade >= 6 ? 'Aprobado' : 'Reprobado'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Metrics bar */}
              {s && (
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg border border-sand-200 bg-white px-3 py-2">
                    <p className="font-mono text-sm font-bold text-ink">{studentQuestions.length}</p>
                    <p className="text-[11px] text-ink-subtle">Actividades</p>
                  </div>
                  <div className="rounded-lg border border-green-200 bg-green-50/60 px-3 py-2">
                    <p className="font-mono text-sm font-bold text-green-700">{correctCount}</p>
                    <p className="text-[11px] text-green-700">Correctas</p>
                  </div>
                  <div className="rounded-lg border border-red-200 bg-red-50/60 px-3 py-2">
                    <p className="font-mono text-sm font-bold text-red-700">{wrongCount}</p>
                    <p className="text-[11px] text-red-700">Incorrectas</p>
                  </div>
                </div>
              )}

              {/* Activity-by-activity work */}
              <div className="space-y-3">
                {studentQuestions.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-6">
                    Este examen no tiene actividades registradas.
                  </p>
                ) : (
                  studentQuestions.map((q, qIdx) => {
                    const res = scoreResultMap.get(q.id);
                    const rawVal = currentAnswers[q.id];
                    const hasAnswer =
                      rawVal !== undefined &&
                      rawVal !== null &&
                      String(rawVal).trim() !== '' &&
                      (!Array.isArray(rawVal) || rawVal.length > 0);
                    const isTableInlineText =
                      q.type === 'text' && (q.settings?.table?.editableCells?.length ?? 0) > 0;

                    return (
                      <div
                        key={q.id}
                        className={`rounded-xl border p-4 space-y-2.5 ${
                          res
                            ? res.isCorrect
                              ? 'border-green-200 bg-white'
                              : 'border-red-200 bg-red-50/20'
                            : 'border-sand-300 bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 min-w-0 flex-1">
                            {res ? (
                              res.isCorrect ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                              )
                            ) : (
                              <span className="mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-sand-200 text-[10px] font-mono font-semibold text-ink-light shrink-0">
                                {qIdx + 1}
                              </span>
                            )}
                            <div className="min-w-0 flex-1">
                              <span className="text-[11px] font-mono text-ink-subtle uppercase tracking-wide">
                                Actividad {qIdx + 1}
                              </span>
                              <div className="text-sm font-medium text-ink mt-0.5">
                                <LatexRenderer text={q.title || 'Pregunta sin título'} />
                              </div>
                            </div>
                          </div>

                          {res ? (
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-mono font-semibold ${
                                res.isCorrect
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {res.earned}/{res.points} pts
                            </span>
                          ) : (
                            <span className="shrink-0 rounded-full bg-sand-100 border border-sand-200 px-2 py-0.5 text-[11px] text-ink-subtle">
                              Sin puntaje
                            </span>
                          )}
                        </div>

                        {q.settings?.table && (
                          <QuestionTableView
                            table={q.settings.table}
                            value={currentAnswers[q.id]}
                            readOnly={!editing}
                            onChange={
                              editing
                                ? (v) => setEditAnswers((prev) => ({ ...prev, [q.id]: v }))
                                : undefined
                            }
                          />
                        )}

                        {editing ? (
                          !isTableInlineText && (
                            <div className="pt-1">
                              <span className="text-ink-subtle text-[11px] font-medium block mb-1">
                                Editar respuesta:
                              </span>
                              {renderAnswerInput(q, currentAnswers[q.id], (v) =>
                                setEditAnswers((prev) => ({ ...prev, [q.id]: v }))
                              )}
                            </div>
                          )
                        ) : (
                          <div className="rounded-lg bg-sand-50/80 border border-sand-200 px-3 py-2 text-xs">
                            <span className="font-semibold text-ink-light">Respuesta: </span>
                            {hasAnswer ? (
                              <span className="font-mono text-ink">
                                <LatexRenderer text={renderAnswerReadonly(q, rawVal)} />
                              </span>
                            ) : (
                              <span className="italic text-ink-subtle">Sin responder</span>
                            )}
                          </div>
                        )}

                        {res && !res.isCorrect && res.correctAnswer !== null && res.correctAnswer !== undefined && (
                          <div className="rounded-lg bg-green-50/80 border border-green-200 px-3 py-1.5 text-xs text-green-800">
                            <span className="font-semibold">Correcta: </span>
                            <span className="font-mono">
                              <LatexRenderer
                                text={
                                  Array.isArray(res.correctAnswer)
                                    ? res.correctAnswer.join(', ')
                                    : String(res.correctAnswer)
                                }
                              />
                            </span>
                          </div>
                        )}

                        {(q.settings?.requireProcedurePhoto || (r.procedurePhotos?.[q.id]?.length ?? 0) > 0) && (() => {
                          const photos = r.procedurePhotos?.[q.id] ?? [];
                          const procStatus = r.procedureValidations?.[q.id];
                          const isSavingProc = validatingKey === `${r.id}:${q.id}`;

                          return (
                            <div className="rounded-xl border border-sand-300 bg-sand-50/60 p-3 space-y-2.5">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink">
                                  <Camera className="h-3.5 w-3.5 text-brand-700" />
                                  Procedimiento del estudiante
                                </span>
                                {procStatus === 'validated' ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 border border-green-200 px-2 py-0.5 text-[11px] font-semibold text-green-800">
                                    <CheckCircle2 className="h-3 w-3" />
                                    Procedimiento validado
                                  </span>
                                ) : procStatus === 'rejected' ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 border border-red-200 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                                    <XCircle className="h-3 w-3" />
                                    Procedimiento rechazado (0 pts)
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                                    <Clock className="h-3 w-3" />
                                    Falta validar procedimiento
                                  </span>
                                )}
                              </div>

                              {photos.length > 0 ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                  {photos.map((photoSrc, pIdx) => (
                                    <button
                                      key={pIdx}
                                      type="button"
                                      onClick={() =>
                                        setZoomedProcedurePhoto({
                                          photos,
                                          index: pIdx,
                                          title: `Actividad ${qIdx + 1} — ${r.respondent?.name || 'Estudiante'}`,
                                        })
                                      }
                                      className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-sand-300 bg-white hover:border-brand-500 transition-colors"
                                    >
                                      <img
                                        src={photoSrc}
                                        alt={`Procedimiento ${pIdx + 1}`}
                                        className="h-full w-full object-cover"
                                      />
                                      <span className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                                        <span className="opacity-0 group-hover:opacity-100 rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold text-ink inline-flex items-center gap-1 shadow">
                                          <ZoomIn className="h-3 w-3" />
                                          Ampliar
                                        </span>
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                                  No se adjuntaron fotos de procedimiento para esta actividad.
                                </p>
                              )}

                              <div className="flex flex-wrap items-center gap-2 pt-1">
                                <button
                                  type="button"
                                  disabled={isSavingProc}
                                  onClick={() => handleValidateProcedure(r, q.id, 'validated')}
                                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                                    procStatus === 'validated'
                                      ? 'bg-green-600 text-white shadow-sm'
                                      : 'bg-white border border-green-300 text-green-700 hover:bg-green-50'
                                  }`}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Validar como correcto
                                </button>

                                <button
                                  type="button"
                                  disabled={isSavingProc}
                                  onClick={() => handleValidateProcedure(r, q.id, 'rejected')}
                                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                                    procStatus === 'rejected'
                                      ? 'bg-red-600 text-white shadow-sm'
                                      : 'bg-white border border-red-300 text-red-700 hover:bg-red-50'
                                  }`}
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                  Rechazar procedimiento
                                </button>

                                {(procStatus === 'validated' || procStatus === 'rejected') && (
                                  <button
                                    type="button"
                                    disabled={isSavingProc}
                                    onClick={() => handleValidateProcedure(r, q.id, null)}
                                    className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-ink-subtle hover:bg-sand-200/70 hover:text-ink transition-colors disabled:opacity-50"
                                  >
                                    <RotateCcw className="h-3 w-3" />
                                    Volver a pendiente
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Modal footer actions */}
              <div className="pt-3 border-t border-sand-200 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  {editing ? (
                    <>
                      <Button onClick={saveEdit}>
                        <Save className="h-4 w-4" />
                        Guardar cambios
                      </Button>
                      <Button variant="secondary" onClick={cancelEdit}>
                        Cancelar edición
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="secondary" onClick={() => startEdit(r)}>
                        <Edit3 className="h-4 w-4" />
                        Editar respuestas
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => handleCopyResultLink(r.id)}
                      >
                        {copiedResultLinkId === r.id ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Link2 className="h-4 w-4" />
                        )}
                        {copiedResultLinkId === r.id ? 'Link copiado' : 'Copiar link de resultado'}
                      </Button>
                    </>
                  )}
                </div>
                <Button variant="ghost" onClick={closeStudentModal}>
                  Cerrar
                </Button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ── Procedure photo enhanced zoom viewer modal ── */}
      <ProcedurePhotoViewerModal
        open={zoomedProcedurePhoto !== null}
        onClose={() => setZoomedProcedurePhoto(null)}
        photos={zoomedProcedurePhoto?.photos ?? []}
        initialIndex={zoomedProcedurePhoto?.index ?? 0}
        title={zoomedProcedurePhoto?.title ?? 'Foto del procedimiento'}
        zIndexClass="z-[60]"
      />

      {/* ── Non-quiz hint ── */}
      {!scored && (
        <Card className="p-6 text-center text-gray-600 text-sm print:hidden">
          Este formulario no tiene modo examen activado. Los resultados muestran solo las respuestas sin calificación.
          <br />
          <Link to={`/form/${formId}`} className="text-brand-600 hover:underline">Activar modo examen en el editor</Link>
        </Card>
      )}

      {/* ── Delete confirmation modal ── */}
      <Modal open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} title="Eliminar respuesta" size="sm">
        <p className="text-sm text-gray-600 mb-4">¿Estás seguro de eliminar esta respuesta? Esta acción no se puede deshacer.</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
          <Button onClick={handleDelete} className="!bg-red-600 hover:!bg-red-700">Eliminar</Button>
        </div>
      </Modal>

      {/* ── Simulate responses modal ── */}
      <Modal open={simulateOpen} onClose={() => { if (!simulating) setSimulateOpen(false); }} title="Simular respuestas">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Genera respuestas aleatorias de alumnos simulados para probar el reporte de calificaciones.
          </p>
          {!form?.settings?.isQuiz && (
            <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
              El modo examen no está activado. Las respuestas se generarán sin calificación.
            </p>
          )}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Total alumnos</label>
              <input
                type="number" min={1} max={100}
                value={simConfig.total}
                onChange={(e) => {
                  const total = Math.max(1, Math.min(100, Number(e.target.value)));
                  setSimConfig((prev) => ({ total, pass: Math.min(prev.pass, total), fail: total - Math.min(prev.pass, total) }));
                }}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Aprobados</label>
              <input
                type="number" min={0} max={simConfig.total}
                value={simConfig.pass}
                onChange={(e) => {
                  const pass = Math.max(0, Math.min(simConfig.total, Number(e.target.value)));
                  setSimConfig((prev) => ({ ...prev, pass, fail: prev.total - pass }));
                }}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Reprobados</label>
              <input
                type="number" min={0} max={simConfig.total}
                value={simConfig.fail}
                onChange={(e) => {
                  const fail = Math.max(0, Math.min(simConfig.total, Number(e.target.value)));
                  setSimConfig((prev) => ({ ...prev, fail, pass: prev.total - fail }));
                }}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setSimulateOpen(false)} disabled={simulating}>Cancelar</Button>
            <Button onClick={handleSimulate} disabled={simulating || simConfig.total === 0}>
              {simulating ? 'Generando...' : `Generar ${simConfig.total} respuestas`}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── PDF export config modal ── */}
      <Modal open={pdfConfigOpen} onClose={() => { if (!pdfGenerating) setPdfConfigOpen(false); }} title="Configurar PDF">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Selecciona las secciones que deseas incluir en el informe PDF.</p>

          <div className="space-y-2">
            {[
              { key: 'header', label: 'Encabezado (título del informe)' },
              { key: 'meta', label: 'Metadatos (institución, evaluación, fechas)' },
              { key: 'summary', label: 'Resumen (estudiantes, aprobados, reprobados)' },
              { key: 'distribution', label: 'Distribución de calificaciones' },
              { key: 'studentList', label: 'Lista de calificaciones' },
              { key: 'studentDetail', label: 'Detalle por estudiante' },
              { key: 'footer', label: 'Pie (observaciones, firma)' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={(pdfSections as any)[key]}
                  onChange={() => setPdfSections((prev) => ({ ...prev, [key]: !(prev as any)[key] }))}
                  className="accent-brand-600"
                />
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setPdfConfigOpen(false)}>Cancelar</Button>
            <Button onClick={handleDownloadPdf}>
              <Download className="h-4 w-4" />
              Descargar PDF
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── PROFESSIONAL PRINT REPORT ── */}
      <div className="hidden print:block print-report">
        <div className="max-w-[210mm] mx-auto px-[15mm] py-[10mm]">
          {/* Header */}
          <div data-section="header" className="text-center border-b-2 border-gray-900 pb-6 mb-8">
            <h1 className="text-2xl font-bold uppercase tracking-wide text-gray-900">Informe de Resultados Académicos</h1>
            <p className="text-lg text-gray-700 mt-1 font-medium">{form?.title ?? 'Evaluación'}</p>
          </div>

          {/* Meta info */}
          <table data-section="meta" className="w-full text-sm mb-8">
            <tbody>
              <tr>
                <td className="text-gray-500 pr-4 py-1 w-32 font-medium">Institución:</td>
                <td className="text-gray-900 py-1">Institución Educativa</td>
                <td className="text-gray-500 pr-4 py-1 w-32 font-medium">Fecha de corte:</td>
                <td className="text-gray-900 py-1">{new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
              </tr>
              <tr>
                <td className="text-gray-500 pr-4 py-1 font-medium">Evaluación:</td>
                <td className="text-gray-900 py-1">{form?.title ?? '—'}</td>
                <td className="text-gray-500 pr-4 py-1 font-medium">Total estudiantes:</td>
                <td className="text-gray-900 py-1">{totalRespondents}</td>
              </tr>
              {activeScoredList && activeScoredList.length > 0 && (
                <tr>
                  <td className="text-gray-500 pr-4 py-1 font-medium">Escala de nota:</td>
                  <td className="text-gray-900 py-1">1–10 ({gradeRounding === 'integer' ? 'redondeado' : 'cada 0.25'})</td>
                  <td className="text-gray-500 pr-4 py-1 font-medium">Promedio grupal:</td>
                  <td className="text-gray-900 py-1">Nota {avgGrade.toFixed(2)}/10 · {avgEarned.toFixed(1)}/{totalPoints} pts</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Summary cards */}
          {activeScoredList && (
            <div data-section="summary" className="grid grid-cols-5 gap-3 mb-8">
              <div className="border border-gray-300 rounded p-3 text-center">
                <p className="text-2xl font-bold text-gray-900">{totalRespondents}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mt-1">Estudiantes</p>
              </div>
              <div className="border border-gray-300 rounded p-3 text-center">
                <p className="text-2xl font-bold text-gray-900">{avgGrade.toFixed(2)}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mt-1">Promedio 1-10</p>
              </div>
              <div className="border border-gray-300 rounded p-3 text-center">
                <p className="text-2xl font-bold text-gray-900">{passed}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mt-1">Aprobados</p>
              </div>
              <div className="border border-gray-300 rounded p-3 text-center">
                <p className="text-2xl font-bold text-gray-900">{totalRespondents - passed}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mt-1">Reprobados</p>
              </div>
              <div className="border border-gray-300 rounded p-3 text-center">
                <p className="text-2xl font-bold text-gray-900">{passRate.toFixed(1)}%</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mt-1">Aprobación</p>
              </div>
            </div>
          )}

          {/* Grade distribution */}
          {activeScoredList && (
            <div data-section="distribution" className="mb-8">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">Distribución de calificaciones (1–10)</h2>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-400">
                    <th className="text-left py-2 font-medium text-gray-600">Rango (1-10)</th>
                    <th className="text-left py-2 font-medium text-gray-600">Nivel</th>
                    <th className="text-left py-2 font-medium text-gray-600">Categoría</th>
                    <th className="text-center py-2 font-medium text-gray-600">Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {(gradeRounding === 'integer'
                    ? [
                        { range: '9 a 10', letter: 'A', label: 'Excelente', min: 9, max: 10.01 },
                        { range: '8', letter: 'B', label: 'Muy bueno', min: 8, max: 9 },
                        { range: '7', letter: 'C', label: 'Bueno', min: 7, max: 8 },
                        { range: '6', letter: 'D', label: 'Suficiente', min: 6, max: 7 },
                        { range: '1 a 5', letter: 'F', label: 'Insuficiente', min: 0, max: 6 },
                      ]
                    : [
                        { range: '9.00 a 10', letter: 'A', label: 'Excelente', min: 9, max: 10.01 },
                        { range: '8.00 a 8.75', letter: 'B', label: 'Muy bueno', min: 8, max: 9 },
                        { range: '7.00 a 7.75', letter: 'C', label: 'Bueno', min: 7, max: 8 },
                        { range: '6.00 a 6.75', letter: 'D', label: 'Suficiente', min: 6, max: 7 },
                        { range: '1.00 a 5.75', letter: 'F', label: 'Insuficiente', min: 0, max: 6 },
                      ]
                  ).map((g) => {
                    const items = activeScoredList;
                    const count = items.filter(({ response: resp, score: sc }) => {
                      const gradeVal = getStudentGrade(resp.id, sc.earnedPoints, sc.totalPoints);
                      return gradeVal >= g.min && gradeVal < g.max;
                    }).length;
                    return (
                      <tr key={g.letter} className="border-b border-gray-200">
                        <td className="py-1.5 text-gray-700">{g.range}</td>
                        <td className="py-1.5 font-bold text-gray-900">{g.letter}</td>
                        <td className="py-1.5 text-gray-700">{g.label}</td>
                        <td className="py-1.5 text-center font-medium text-gray-900">{count}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Full student table */}
          <div data-section="studentList" className="mb-8">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">Lista de calificaciones</h2>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-900">
                  <th className="text-left py-2 font-bold text-gray-900 w-8">N°</th>
                  <th className="text-left py-2 font-bold text-gray-900">Estudiante</th>
                  {multiVersion && <th className="text-center py-2 font-bold text-gray-900">Tema</th>}
                  {activeScoredList && (
                    <>
                      <th className="text-center py-2 font-bold text-gray-900">Puntaje</th>
                      <th className="text-center py-2 font-bold text-gray-900">Nota (1-10)</th>
                      <th className="text-center py-2 font-bold text-gray-900">%</th>
                      <th className="text-center py-2 font-bold text-gray-900">Estado</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {(activeScoredList ?? activeResponsesList).map((item: any, idx: number) => {
                  const r: FormResponse = item.response ?? item;
                  const s: QuizScore | null = item.score ?? null;
                  const earned = s ? (scoreOverrides[r.id] ?? s.earnedPoints) : 0;
                  const pct = s && s.totalPoints > 0 ? (earned / s.totalPoints) * 100 : 0;
                  const gradeVal = s ? getStudentGrade(r.id, earned, s.totalPoints) : 1;
                  const vLabel = responseVersionMap.get(r.id)?.versionLabel ?? 'Tema 1';
                  return (
                    <tr key={r.id} className="border-b border-gray-200">
                      <td className="py-1.5 text-gray-500">{idx + 1}</td>
                      <td className="py-1.5 font-medium text-gray-900">{r.respondent?.name || '—'}</td>
                      {multiVersion && <td className="py-1.5 text-center text-gray-700">{vLabel}</td>}
                      {s && (
                        <>
                          <td className="py-1.5 text-center font-mono text-gray-900">{earned}/{s.totalPoints}</td>
                          <td className="py-1.5 text-center font-mono font-bold text-gray-900">{formatGrade1to10(gradeVal, gradeRounding)}</td>
                          <td className="py-1.5 text-center font-mono text-gray-900">{pct.toFixed(0)}%</td>
                          <td className="py-1.5 text-center">
                            <span className={`font-medium text-[10px] px-2 py-0.5 rounded ${gradeVal >= 6 ? 'text-green-800 bg-green-100' : 'text-red-800 bg-red-100'}`}>
                              {gradeVal >= 6 ? 'APROBADO' : 'REPROBADO'}
                            </span>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Per-student detailed reports */}
          {activeScoredList && (
            <div data-section="studentDetail">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-6">Detalle por estudiante</h2>
              {activeScoredList.map(({ response: r, score: s }, idx) => {
                const earned = scoreOverrides[r.id] ?? s.earnedPoints;
                const pct = s.totalPoints > 0 ? (earned / s.totalPoints) * 100 : 0;
                const gradeVal = getStudentGrade(r.id, earned, s.totalPoints);
                const vLabel = responseVersionMap.get(r.id)?.versionLabel ?? 'Tema 1';
                return (
                <div key={r.id} className="mb-12 print:break-before-page">
                  {idx > 0 && <div className="h-0 print:break-before-page" />}
                  <div className="border-t-2 border-gray-900 pt-6">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <p className="text-lg font-bold text-gray-900">
                          {r.respondent?.name || '—'}{multiVersion ? ` (${vLabel})` : ''}
                        </p>
                        <p className="text-xs text-gray-500">{r.respondent?.email || r.respondentEmail || '—'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Nota final (1–10)</p>
                        <p className="text-3xl font-bold text-gray-900">{formatGrade1to10(gradeVal, gradeRounding)} / 10</p>
                        <p className="text-sm font-bold text-gray-900">{earned}/{s.totalPoints} pts ({pct.toFixed(0)}%) — {getGrade1to10Label(gradeVal)}</p>
                      </div>
                    </div>

                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="border-b-2 border-gray-900">
                          <th className="text-left py-2 font-bold text-gray-900 w-8">N°</th>
                          <th className="text-left py-2 font-bold text-gray-900">Pregunta</th>
                          <th className="text-center py-2 font-bold text-gray-900 w-24">Respuesta</th>
                          <th className="text-center py-2 font-bold text-gray-900 w-24">Correcta</th>
                          <th className="text-center py-2 font-bold text-gray-900 w-16">Puntaje</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.results.map((res, qIdx) => {
                          return (
                            <tr key={res.questionId} className={`border-b border-gray-200 ${res.isCorrect ? '' : 'bg-red-50'}`}>
                              <td className="py-1.5 text-gray-500">{qIdx + 1}</td>
                              <td className="py-1.5 text-gray-900">
                                <LatexRenderer text={res.questionTitle} />
                              </td>
                              <td className="py-1.5 text-center font-mono text-gray-900">
                                {Array.isArray(res.userAnswer) ? res.userAnswer.join('; ') : String(res.userAnswer ?? '—')}
                              </td>
                              <td className="py-1.5 text-center font-mono">
                                {!res.isCorrect && res.correctAnswer !== null ? (
                                  <span className="text-green-700">
                                    {Array.isArray(res.correctAnswer) ? res.correctAnswer.join('; ') : String(res.correctAnswer)}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </td>
                              <td className={`py-1.5 text-center font-bold ${res.isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                                {res.earned}/{res.points}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-gray-900 font-bold text-gray-900">
                          <td colSpan={4} className="text-right py-2 pr-4">Total</td>
                          <td className="text-center py-2">{scoreOverrides[r.id] ?? s.earnedPoints}/{s.totalPoints}</td>
                        </tr>
                      </tfoot>
                    </table>

                    <div className="mt-4 text-center text-sm">
                      <span className={`font-bold ${gradeVal >= 6 ? 'text-green-800' : 'text-red-800'}`}>
                        {gradeVal >= 6
                          ? `APROBADO — Nota ${formatGrade1to10(gradeVal, gradeRounding)}/10 (${getGrade1to10Label(gradeVal)})`
                          : `REPROBADO — Nota ${formatGrade1to10(gradeVal, gradeRounding)}/10 (${getGrade1to10Label(gradeVal)})`}
                      </span>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}

          {/* Footer */}
          <div data-section="footer" className="mt-12 pt-6 border-t border-gray-300 text-xs text-gray-500">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-gray-700">Observaciones:</p>
                <div className="mt-2 w-64 h-8 border-b border-gray-300" />
                <div className="mt-4 w-64 h-8 border-b border-gray-300" />
              </div>
              <div className="text-right">
                <div className="mt-8 pt-2 border-t border-gray-400 w-48 text-center">
                  <p className="font-medium text-gray-700">Firma del docente</p>
                </div>
              </div>
            </div>
            <div className="mt-6 text-center">
              <p>Informe generado el {new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
              <p className="mt-1">Sistema de Gestión de Evaluaciones — Documento oficial</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
