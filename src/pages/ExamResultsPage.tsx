import { useEffect, useMemo, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useEditorStore } from '../store/editorStore';
import { useResponses } from '../hooks/useResponses';
import { scoreQuiz, type QuizScore } from '../lib/quizScoring';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { exportToCsv } from '../utils/export-csv';
import { ArrowLeft, Download, ChevronDown, ChevronRight, CheckCircle2, XCircle, Trash2, Edit3, Save, Printer, X, Users, FileDown } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { LatexRenderer } from '../components/ui/LatexRenderer';
import { toOptionItem } from '../types/question';
import type { FormResponse } from '../types/response';
import type { Question } from '../types/question';

export default function ExamResultsPage() {
  const { formId } = useParams<{ formId: string }>();
  const form = useEditorStore((s) => s.form);
  const questions = useEditorStore((s) => s.questions);
  const loadForm = useEditorStore((s) => s.loadForm);
  const { responses, loading, deleteResponse, updateResponse } = useResponses(formId!);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [editAnswers, setEditAnswers] = useState<Record<string, any>>({});
  const [simulateOpen, setSimulateOpen] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simConfig, setSimConfig] = useState({ total: 10, pass: 7, fail: 3 });
  const [pdfConfigOpen, setPdfConfigOpen] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [pdfSections, setPdfSections] = useState({
    header: true,
    meta: true,
    summary: true,
    distribution: true,
    studentList: true,
    studentDetail: true,
    footer: true,
  });
  const printRef = useRef<HTMLDivElement>(null);
  const [editingScores, setEditingScores] = useState(false);
  const [scoreOverrides, setScoreOverrides] = useState<Record<string, number>>({});

  useEffect(() => { if (formId) loadForm(formId); }, [formId]);

  const scored = useMemo(() => {
    if (!form?.settings?.isQuiz) return null;
    return responses.map((r) => ({
      response: r,
      score: scoreQuiz(questions, r.answers),
    }));
  }, [responses, questions, form]);

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

  if (loading) return <LoadingSpinner />;

  const totalRespondents = scored?.length ?? responses.length;
  const totalPoints = (displayScores ?? scored)?.[0]?.score.totalPoints ?? 0;
  const avgEarned = displayScores && displayScores.length > 0
    ? displayScores.reduce((s, r) => s + r.score.earnedPoints, 0) / displayScores.length
    : 0;
  const sorted = displayScores ? [...displayScores].sort((a, b) => b.score.earnedPoints - a.score.earnedPoints) : [];
  const highestEarned = sorted[0]?.score.earnedPoints ?? 0;
  const lowestEarned = sorted[sorted.length - 1]?.score.earnedPoints ?? 0;
  const passed = displayScores ? displayScores.filter((r) => r.score.percentage >= 60).length : 0;
  const passRate = displayScores && displayScores.length > 0 ? (passed / displayScores.length) * 100 : 0;

  function toggleRow(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleExport() {
    if (!form?.settings?.isQuiz || !scored) {
      const headers = ['Nombre', 'Email', 'Fecha', ...questions.map((q) => q.title)];
      const rows = responses.map((r) => [
        r.respondent?.name ?? '',
        r.respondent?.email ?? r.respondentEmail ?? '',
        r.submittedAt?.toLocaleString() ?? '',
        ...questions.map((q) => String(r.answers[q.id] ?? '')),
      ]);
      exportToCsv(`${form?.title ?? 'resultados'}.csv`, [headers, ...rows]);
      return;
    }

    const headers = [
      'Nombre', 'Email', 'Puntaje', 'Total', 'Porcentaje', 'Aprobado',
      ...questions.flatMap((q) => [
        `${q.title} (respuesta)`,
        `${q.title} (correcta)`,
        `${q.title} (puntos)`,
      ]),
    ];

    const rows = scored.map(({ response: r, score: s }) => [
      r.respondent?.name ?? '',
      r.respondent?.email ?? r.respondentEmail ?? '',
      String(s.earnedPoints),
      String(s.totalPoints),
      `${s.percentage}%`,
      s.percentage >= 60 ? 'Sí' : 'No',
      ...s.results.flatMap((res) => [
        Array.isArray(res.userAnswer) ? res.userAnswer.join('; ') : String(res.userAnswer ?? ''),
        Array.isArray(res.correctAnswer) ? res.correctAnswer.join('; ') : String(res.correctAnswer ?? ''),
        `${res.earned}/${res.points}`,
      ]),
    ]);

    exportToCsv(`${form?.title ?? 'resultados'}_calificaciones.csv`, [headers, ...rows]);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteResponse(deleteTarget);
    setDeleteTarget(null);
  }

  function startEdit(r: FormResponse) {
    setEditTarget(r.id);
    setEditAnswers({ ...r.answers });
  }

  function cancelEdit() {
    setEditTarget(null);
    setEditAnswers({});
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

  function renderAnswerReadonly(q: Question, value: any) {
    if (Array.isArray(value)) return value.join(', ');
    return String(value ?? '—');
  }

  function getGradeLetter(pct: number): string {
    if (pct >= 90) return 'A';
    if (pct >= 80) return 'B';
    if (pct >= 70) return 'C';
    if (pct >= 60) return 'D';
    return 'F';
  }

  function getGradeLabel(pct: number): string {
    if (pct >= 90) return 'Excelente';
    if (pct >= 80) return 'Muy bueno';
    if (pct >= 70) return 'Bueno';
    if (pct >= 60) return 'Suficiente';
    return 'Insuficiente';
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
    const quizQuestions = questions.filter((q) => q.quizSettings);

    // Determine which students pass/fail
    const passCount = Math.min(simConfig.pass, simConfig.total);
    const failCount = simConfig.total - passCount;

    const students: { name: string; pass: boolean }[] = [];
    for (let i = 0; i < passCount; i++) students.push({ name: randomName(), pass: true });
    for (let i = 0; i < failCount; i++) students.push({ name: randomName(), pass: false });
    students.sort(() => Math.random() - 0.5);

    const submissions = students.map((student) => {
      const answers: Record<string, any> = {};
      for (const q of quizQuestions) {
        if (!q.quizSettings) continue;
        // Determine if this specific question should be correct
        // Pass students: 90% chance correct; Fail students: 10% chance correct
        const shouldBeCorrect = student.pass ? Math.random() < 0.9 : Math.random() < 0.1;
        answers[q.id] = shouldBeCorrect ? generateCorrectAnswer(q) : generateWrongAnswer(q);
      }
      return {
        respondentId: null,
        respondentEmail: `${student.name.toLowerCase().replace(/\s+/g, '.')}@email.com`,
        respondent: { name: student.name, email: `${student.name.toLowerCase().replace(/\s+/g, '.')}@email.com` },
        answers,
        submittedAt: Timestamp.now(),
      };
    });

    const col = collection(db, 'forms', formId, 'responses');
    await Promise.all(submissions.map((s) => addDoc(col, s)));

    setSimulating(false);
    setSimulateOpen(false);
  }

  async function handleDownloadPdf() {
    if (!printRef.current) return;
    setPdfGenerating(true);
    setPdfConfigOpen(false);

    const container = printRef.current;
    const sections = container.querySelectorAll<HTMLElement>('[data-section]');

    // Store originals and show/hide sections
    const originals: Map<HTMLElement, string> = new Map();
    sections.forEach((el) => {
      originals.set(el, el.style.display);
      const name = el.getAttribute('data-section')!;
      el.style.display = (pdfSections as any)[name] ? '' : 'none';
    });

    try {
      // Temporarily show the container on screen for capture
      container.classList.remove('hidden', 'print:block');
      container.style.position = 'fixed';
      container.style.top = '0';
      container.style.left = '0';
      container.style.width = '210mm';
      container.style.background = 'white';
      container.style.zIndex = '99999';
      container.style.overflow = 'visible';

      // Wait for DOM to settle
      await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => setTimeout(r, 200));

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: '#ffffff',
        width: container.scrollWidth,
        height: container.scrollHeight,
        windowWidth: container.scrollWidth,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const imgWidth = 190; // mm (A4 minus margins)
      const pageHeight = 297; // mm (A4 height)
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      const pdf = new jsPDF('p', 'mm', 'a4');
      let y = 10;

      if (imgHeight <= pageHeight - 20) {
        pdf.addImage(imgData, 'JPEG', 10, y, imgWidth, imgHeight);
      } else {
        // Split across pages
        const pageImgHeight = pageHeight - 20;
        const ratio = imgWidth / canvas.width;
        let remaining = imgHeight;
        let srcY = 0;

        while (remaining > 0) {
          const h = Math.min(remaining, pageImgHeight);
          const srcH = h / ratio;
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = canvas.width;
          pageCanvas.height = srcH;
          const ctx = pageCanvas.getContext('2d')!;
          ctx.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);
          const pageImg = pageCanvas.toDataURL('image/jpeg', 0.95);
          if (y > 10) pdf.addPage();
          pdf.addImage(pageImg, 'JPEG', 10, y, imgWidth, h);
          srcY += srcH;
          remaining -= h;
          y = 10;
        }
      }

      pdf.save(`${form?.title ?? 'informe'}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      // Restore
      sections.forEach((el) => {
        const orig = originals.get(el);
        el.style.display = orig ?? '';
      });
      container.style.position = '';
      container.style.top = '';
      container.style.left = '';
      container.style.width = '';
      container.style.background = '';
      container.style.zIndex = '';
      container.style.overflow = '';
      container.classList.add('hidden', 'print:block');
      setPdfGenerating(false);
    }
  }

  return (
    <div className="space-y-6 print:space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Link to={`/form/${formId}/analytics`}>
            <Button variant="ghost"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <h1 className="text-xl font-bold">{form?.title ?? 'Resultados'} — Informe</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={editingScores ? 'primary' : 'secondary'}
            onClick={() => {
              if (editingScores) setScoreOverrides({});
              setEditingScores(!editingScores);
            }}
          >
            <Edit3 className="h-4 w-4" />
            <span className="hidden sm:inline">{editingScores ? 'Finalizar edición' : 'Editar notas'}</span>
          </Button>
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

      {/* ── Header visible in print ── */}
      <div className="hidden print:block">
        <h1 className="text-xl font-bold">{form?.title ?? 'Resultados'} — Informe</h1>
        <p className="text-xs text-gray-500">Generado el {new Date().toLocaleString()}</p>
      </div>

      {/* ── Stats cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 print:grid-cols-5 print:gap-2">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{totalRespondents}</p>
          <p className="text-xs text-gray-500">Total estudiantes</p>
        </Card>
        {scored && (
          <>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-indigo-600">{avgEarned.toFixed(1)} / {totalPoints}</p>
              <p className="text-xs text-gray-500">Promedio</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{highestEarned} / {totalPoints}</p>
              <p className="text-xs text-gray-500">Nota más alta</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{lowestEarned} / {totalPoints}</p>
              <p className="text-xs text-gray-500">Nota más baja</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{passRate.toFixed(1)}%</p>
              <p className="text-xs text-gray-500">Tasa de aprobación</p>
            </Card>
          </>
        )}
      </div>

      {/* ── Responses table ── */}
      <Card className="overflow-hidden">
        <div>
          <table className="w-full text-sm hidden sm:table">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-8 print:hidden" />
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                {scored && (
                  <>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Puntaje</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">%</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Aprobado</th>
                  </>
                )}
                <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 w-24 print:hidden">Acciones</th>
              </tr>
            </thead>
              <tbody>
                {(displayScores ?? scored ?? responses).map((item: any) => {
                  const r: FormResponse = item.response ?? item;
                  const s: QuizScore | null = item.score ?? null;
                  const expanded = expandedRows.has(r.id);
                  const editing = editTarget === r.id;

                return (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400 print:hidden">
                      {s && (
                        <button onClick={() => toggleRow(r.id)} className="p-1">
                          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">{r.respondent?.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{r.respondent?.email || r.respondentEmail || '—'}</td>
                    {s && (
                      <>
                        <td className="px-4 py-3 text-center">
                          {editingScores ? (
                            <input
                              type="number"
                              min={0}
                              max={s.totalPoints}
                              value={scoreOverrides[r.id] ?? s.earnedPoints}
                              onChange={(e) => {
                                const v = Math.max(0, Math.min(s.totalPoints, Number(e.target.value) || 0));
                                setScoreOverrides((prev) => ({ ...prev, [r.id]: v }));
                              }}
                              className="w-16 text-center border rounded px-1 py-0.5 text-sm font-mono"
                            />
                          ) : (
                            <span className={scoreOverrides[r.id] !== undefined ? 'text-amber-600' : ''}>
                              {scoreOverrides[r.id] ?? s.earnedPoints}/{s.totalPoints}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center font-mono">
                          {s.totalPoints > 0 ? ((editingScores ? (scoreOverrides[r.id] ?? s.earnedPoints) : s.earnedPoints) / s.totalPoints * 100).toFixed(0) : 0}%
                        </td>
                        <td className="px-4 py-3 text-center">
                          {(() => {
                            const pct = s.totalPoints > 0 ? ((editingScores ? (scoreOverrides[r.id] ?? s.earnedPoints) : s.earnedPoints) / s.totalPoints * 100) : 0;
                            return pct >= 60 ? (
                              <span className="text-green-600 font-medium">Aprobado</span>
                            ) : (
                              <span className="text-red-600 font-medium">Reprobado</span>
                            );
                          })()}
                        </td>
                      </>
                    )}
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {r.submittedAt?.toLocaleString() ?? ''}
                    </td>
                    <td className="px-4 py-3 print:hidden">
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
                            <button onClick={() => startEdit(r)} className="p-1 text-indigo-600 hover:bg-indigo-50 rounded" title="Editar respuestas">
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
            {(displayScores ?? scored ?? responses).map((item: any) => {
              const r: FormResponse = item.response ?? item;
              const s: QuizScore | null = item.score ?? null;
              const expanded = expandedRows.has(r.id);
              const editing = editTarget === r.id;

              return (
                <div key={r.id} className="px-4 py-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {s && (
                        <button onClick={() => toggleRow(r.id)} className="p-1 -ml-1 text-gray-400">
                          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      )}
                      <span className="font-medium text-sm">{r.respondent?.name || '—'}</span>
                    </div>
                    <div className="flex items-center gap-1 print:hidden">
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
                          <button onClick={() => startEdit(r)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded" title="Editar respuestas">
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

                  <div className="flex items-center gap-3 text-xs">
                    {s && (
                      <>
                        <span>
                          Puntaje: <strong className={scoreOverrides[r.id] !== undefined ? 'text-amber-600' : ''}>{scoreOverrides[r.id] ?? s.earnedPoints}/{s.totalPoints}</strong>
                        </span>
                        <span className="font-mono">{s.totalPoints > 0 ? ((scoreOverrides[r.id] ?? s.earnedPoints) / s.totalPoints * 100).toFixed(0) : 0}%</span>
                        <span className={((scoreOverrides[r.id] ?? s.earnedPoints) / s.totalPoints * 100) >= 60 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                          {((scoreOverrides[r.id] ?? s.earnedPoints) / s.totalPoints * 100) >= 60 ? 'Aprobado' : 'Reprobado'}
                        </span>
                      </>
                    )}
                    <span className="text-gray-400 ml-auto">{r.submittedAt?.toLocaleString() ?? ''}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {responses.length === 0 && (
          <div className="text-center py-12 text-gray-400">Sin respuestas aún</div>
        )}
      </Card>

      {/* ── Expandable quiz detail ── */}
      {(displayScores ?? scored)?.map(({ response: r, score: s }) => {
        if (!expandedRows.has(r.id)) return null;
        const editing = editTarget === r.id;
        const currentAnswers = editing ? editAnswers : r.answers;

        return (
          <Card key={`${r.id}-detail`} className="p-6 print:break-inside-avoid">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4">
              Detalle — {r.respondent?.name || '—'}
            </p>
            <div className="space-y-3">
              {s.results.map((res) => {
                const q = questions.find((qq) => qq.id === res.questionId);
                return (
                  <div key={res.questionId} className="flex items-start gap-3 py-2 border-b border-gray-200 last:border-0">
                    {res.isCorrect ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium"><LatexRenderer text={res.questionTitle} /></p>
                      <div className="text-xs text-gray-500 mt-0.5 space-y-1">
                        {editing && q ? (
                          <div className="mt-1">
                            <span className="text-gray-400 text-[10px] block mb-1">Editar respuesta:</span>
                            {renderAnswerInput(q, currentAnswers[q.id], (v) =>
                              setEditAnswers((prev) => ({ ...prev, [q.id]: v })),
                            )}
                          </div>
                        ) : (
                          <span>
                            Respuesta:{' '}
                            <span className="font-mono">
                              <LatexRenderer text={q ? renderAnswerReadonly(q, r.answers[q.id]) : String(r.answers[res.questionId] ?? '')} />
                            </span>
                          </span>
                        )}
                        {!res.isCorrect && res.correctAnswer !== null && (
                          <br />
                        )}
                        {!res.isCorrect && res.correctAnswer !== null && (
                          <span>
                            Correcta:{' '}
                            <span className="font-mono text-green-600">
                              <LatexRenderer text={Array.isArray(res.correctAnswer) ? res.correctAnswer.join(', ') : String(res.correctAnswer)} />
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`text-xs font-mono shrink-0 ${res.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                      {res.earned}/{res.points}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}

      {/* ── Non-quiz expanded detail ── */}
      {!scored && responses.map((r) => {
        if (!expandedRows.has(r.id)) return null;
        const editing = editTarget === r.id;
        const currentAnswers = editing ? editAnswers : r.answers;

        return (
          <Card key={`${r.id}-detail`} className="p-6 print:break-inside-avoid">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-4">
              Detalle — {r.respondent?.name || '—'}
            </p>
            <div className="space-y-2">
              {questions.map((q) => (
                <div key={q.id} className="py-1 border-b border-gray-100 last:border-0">
                  <p className="text-xs font-medium"><LatexRenderer text={q.title} /></p>
                  {editing ? (
                    <div className="mt-1">
                      {renderAnswerInput(q, currentAnswers[q.id], (v) =>
                        setEditAnswers((prev) => ({ ...prev, [q.id]: v })),
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 mt-0.5 font-mono">
                      <LatexRenderer text={renderAnswerReadonly(q, r.answers[q.id])} />
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        );
      })}

      {/* ── Non-quiz hint ── */}
      {!scored && (
        <Card className="p-6 text-center text-gray-600 text-sm print:hidden">
          Este formulario no tiene modo examen activado. Los resultados muestran solo las respuestas sin calificación.
          <br />
          <Link to={`/form/${formId}`} className="text-indigo-600 hover:underline">Activar modo examen en el editor</Link>
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
                  className="accent-indigo-600"
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
      <div ref={printRef} className="hidden print:block print-report">
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
              {(displayScores ?? scored) && (displayScores ?? scored)!.length > 0 && (
                <tr>
                  <td className="text-gray-500 pr-4 py-1 font-medium">Puntaje máximo:</td>
                  <td className="text-gray-900 py-1">{totalPoints} puntos</td>
                  <td className="text-gray-500 pr-4 py-1 font-medium">Promedio grupal:</td>
                  <td className="text-gray-900 py-1">{avgEarned.toFixed(1)} / {totalPoints} ({totalRespondents > 0 ? (avgEarned / totalPoints * 100).toFixed(1) : '0'}%)</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Summary cards */}
          {(displayScores ?? scored) && (
            <div data-section="summary" className="grid grid-cols-4 gap-4 mb-8">
              <div className="border border-gray-300 rounded p-3 text-center">
                <p className="text-2xl font-bold text-gray-900">{totalRespondents}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mt-1">Estudiantes</p>
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
          {(displayScores ?? scored) && (
            <div data-section="distribution" className="mb-8">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">Distribución de calificaciones</h2>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-400">
                    <th className="text-left py-2 font-medium text-gray-600">Rango</th>
                    <th className="text-left py-2 font-medium text-gray-600">Letra</th>
                    <th className="text-left py-2 font-medium text-gray-600">Categoría</th>
                    <th className="text-center py-2 font-medium text-gray-600">Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { range: '90-100%', letter: 'A', label: 'Excelente', min: 90 },
                    { range: '80-89%', letter: 'B', label: 'Muy bueno', min: 80 },
                    { range: '70-79%', letter: 'C', label: 'Bueno', min: 70 },
                    { range: '60-69%', letter: 'D', label: 'Suficiente', min: 60 },
                    { range: '0-59%', letter: 'F', label: 'Insuficiente', min: 0 },
                  ].map((g) => {
                    const items = displayScores ?? scored!;
                    const count = items.filter((r) => {
                      if (g.min === 90) return r.score.percentage >= 90;
                      if (g.min === 0) return r.score.percentage < 60;
                      return r.score.percentage >= g.min && r.score.percentage < g.min + 10;
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
                  {(displayScores ?? scored) && (
                    <>
                      <th className="text-center py-2 font-bold text-gray-900">Puntaje</th>
                      <th className="text-center py-2 font-bold text-gray-900">%</th>
                      <th className="text-center py-2 font-bold text-gray-900">Nota</th>
                      <th className="text-center py-2 font-bold text-gray-900">Estado</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {(displayScores ?? scored ?? responses).map((item: any, idx: number) => {
                  const r: FormResponse = item.response ?? item;
                  const s: QuizScore | null = item.score ?? null;
                  return (
                    <tr key={r.id} className="border-b border-gray-200">
                      <td className="py-1.5 text-gray-500">{idx + 1}</td>
                      <td className="py-1.5 font-medium text-gray-900">{r.respondent?.name || '—'}</td>
                      {s && (
                        <>
                          <td className="py-1.5 text-center font-mono text-gray-900">{scoreOverrides[r.id] ?? s.earnedPoints}/{s.totalPoints}</td>
                          <td className="py-1.5 text-center font-mono text-gray-900">{s.totalPoints > 0 ? ((scoreOverrides[r.id] ?? s.earnedPoints) / s.totalPoints * 100).toFixed(0) : 0}%</td>
                          <td className="py-1.5 text-center font-bold text-gray-900">{getGradeLetter(s.totalPoints > 0 ? ((scoreOverrides[r.id] ?? s.earnedPoints) / s.totalPoints * 100) : 0)}</td>
                          <td className="py-1.5 text-center">
                            <span className={`font-medium text-[10px] px-2 py-0.5 rounded ${(scoreOverrides[r.id] ?? s.earnedPoints) / s.totalPoints * 100 >= 60 ? 'text-green-800 bg-green-100' : 'text-red-800 bg-red-100'}`}>
                              {(scoreOverrides[r.id] ?? s.earnedPoints) / s.totalPoints * 100 >= 60 ? 'APROBADO' : 'REPROBADO'}
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
          {(displayScores ?? scored) && (
            <div data-section="studentDetail">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-6">Detalle por estudiante</h2>
              {(displayScores ?? scored!).map(({ response: r, score: s }, idx) => (
                <div key={r.id} className="mb-12 print:break-before-page">
                  {idx > 0 && <div className="h-0 print:break-before-page" />}
                  <div className="border-t-2 border-gray-900 pt-6">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <p className="text-lg font-bold text-gray-900">{r.respondent?.name || '—'}</p>
                        <p className="text-xs text-gray-500">{r.respondent?.email || r.respondentEmail || '—'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Calificación final</p>
                        <p className="text-3xl font-bold text-gray-900">{scoreOverrides[r.id] ?? s.earnedPoints}/{s.totalPoints}</p>
                        <p className="text-sm font-bold text-gray-900">{s.totalPoints > 0 ? ((scoreOverrides[r.id] ?? s.earnedPoints) / s.totalPoints * 100).toFixed(0) : 0}% — {getGradeLetter(s.totalPoints > 0 ? ((scoreOverrides[r.id] ?? s.earnedPoints) / s.totalPoints * 100) : 0)} ({getGradeLabel(s.totalPoints > 0 ? ((scoreOverrides[r.id] ?? s.earnedPoints) / s.totalPoints * 100) : 0)})</p>
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
                          const q = questions.find((qq) => qq.id === res.questionId);
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
                      <span className={`font-bold ${(() => { const pct = s.totalPoints > 0 ? ((scoreOverrides[r.id] ?? s.earnedPoints) / s.totalPoints * 100) : 0; return pct >= 60 ? 'text-green-800' : 'text-red-800'; })()}`}>
                        {(() => { const pct = s.totalPoints > 0 ? ((scoreOverrides[r.id] ?? s.earnedPoints) / s.totalPoints * 100) : 0; return pct >= 60
                          ? `APROBADO — ${getGradeLetter(pct)} (${getGradeLabel(pct)})`
                          : `REPROBADO — ${getGradeLetter(pct)} (${getGradeLabel(pct)})`;
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
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
