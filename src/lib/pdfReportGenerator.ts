import { jsPDF } from 'jspdf';
import type { Form } from '../types/form';
import type { Question, QuestionTable } from '../types/question';
import type { FormResponse } from '../types/response';
import {
  computeGrade1to10,
  formatGrade1to10,
  snapGrade1to10,
  getGrade1to10Label,
  type GradeRoundingMode,
  type QuizScore,
} from './quizScoring';
import {
  parseEditableTableAnswer,
  parseMarkdownOrLatexTable,
  cellCoordKey,
} from './tableUtils';

export interface PdfReportSections {
  header: boolean;
  meta: boolean;
  summary: boolean;
  distribution: boolean;
  studentList: boolean;
  studentDetail: boolean;
  footer: boolean;
}

export interface ScoredStudentItem {
  response: FormResponse;
  score: QuizScore | null;
}

export interface GeneratePdfReportInput {
  form: Form | null;
  questions: Question[];
  items: ScoredStudentItem[];
  scoreOverrides: Record<string, number>;
  gradeOverrides?: Record<string, number>;
  gradeRounding?: GradeRoundingMode;
  sections: PdfReportSections;
}

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN_X = 15;
const MARGIN_TOP = 15;
const MARGIN_BOTTOM = 18;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

const COLOR_PRIMARY: [number, number, number] = [27, 59, 111];
const COLOR_INK: [number, number, number] = [28, 25, 23];
const COLOR_MUTED: [number, number, number] = [87, 83, 78];
const COLOR_SUBTLE: [number, number, number] = [120, 113, 108];
const COLOR_BORDER: [number, number, number] = [214, 209, 197];
const COLOR_SOFT_BG: [number, number, number] = [247, 245, 240];
const COLOR_GREEN: [number, number, number] = [21, 128, 61];
const COLOR_GREEN_BG: [number, number, number] = [240, 253, 244];
const COLOR_RED: [number, number, number] = [185, 28, 28];
const COLOR_RED_BG: [number, number, number] = [254, 242, 242];

export function getGradeLetter(gradeOrPct: number, isScale1to10 = false): string {
  const pct = isScale1to10 ? gradeOrPct * 10 : gradeOrPct;
  if (pct >= 90) return 'A';
  if (pct >= 80) return 'B';
  if (pct >= 70) return 'C';
  if (pct >= 60) return 'D';
  return 'F';
}

export function getGradeLabel(gradeOrPct: number, isScale1to10 = false): string {
  const grade = isScale1to10 ? gradeOrPct : gradeOrPct / 10;
  return getGrade1to10Label(grade);
}

/** Convierte expresiones LaTeX y símbolos Unicode fuera de WinAnsi a texto legible para PDF. */
export function cleanTextForPdf(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  let text = Array.isArray(raw) ? raw.join(', ') : String(raw);
  if (!text) return '';

  const embeddedTable = parseMarkdownOrLatexTable(text);
  if (embeddedTable) {
    const tableLines = [
      embeddedTable.table.headers.join(' | '),
      ...embeddedTable.table.rows.map((r) => r.cells.join(' | ')),
    ].join('\n');
    text = [embeddedTable.beforeText, tableLines, embeddedTable.afterText]
      .filter(Boolean)
      .join('\n');
  }

  text = text
    .replace(/\$\$/g, '')
    .replace(/\\\[|\\\]|\\\(|\\\)/g, '')
    .replace(/\$([^$]+)\$/g, '$1')
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)')
    .replace(/\\sqrt\[([^\]]+)\]\{([^{}]+)\}/g, 'raiz[$1]($2)')
    .replace(/\\sqrt\{([^{}]+)\}/g, 'sqrt($1)')
    .replace(/\\(?:textbf|textit|text|mathrm|mathbf|emph|mbox)\{([^{}]*)\}/g, '$1')
    .replace(/\\mathbb\{([A-Za-z])\}/g, '$1')
    .replace(/\^\{2\}/g, '²')
    .replace(/\^\{3\}/g, '³')
    .replace(/\^\{([^{}]+)\}/g, '^$1')
    .replace(/_\{([^{}]+)\}/g, '_$1')
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\pm/g, '±')
    .replace(/\\cdot/g, '·')
    .replace(/\\leq|\\le/g, '<=')
    .replace(/\\geq|\\ge/g, '>=')
    .replace(/\\neq|\\ne/g, '!=')
    .replace(/\\approx/g, '~=')
    .replace(/\\Rightarrow/g, '=>')
    .replace(/\\Leftrightarrow/g, '<=>')
    .replace(/\\rightarrow|\\to/g, '->')
    .replace(/\\infty/g, 'infinito')
    .replace(/\\alpha/g, 'alpha')
    .replace(/\\beta/g, 'beta')
    .replace(/\\gamma/g, 'gamma')
    .replace(/\\delta/g, 'delta')
    .replace(/\\Delta/g, 'Delta')
    .replace(/\\theta/g, 'theta')
    .replace(/\\lambda/g, 'lambda')
    .replace(/\\mu/g, 'mu')
    .replace(/\\pi/g, 'pi')
    .replace(/\\rho/g, 'rho')
    .replace(/\\sigma/g, 'sigma')
    .replace(/\\Sigma/g, 'Sigma')
    .replace(/\\phi/g, 'phi')
    .replace(/\\omega/g, 'omega')
    .replace(/\\Omega/g, 'Ohm')
    .replace(/\\sum/g, 'Sum')
    .replace(/\\int/g, 'Int')
    .replace(/\\in/g, 'en')
    .replace(/\\notin/g, 'no en')
    .replace(/\\emptyset/g, 'vacio')
    .replace(/\\left|\\right/g, '')
    .replace(/\\([a-zA-Z]+)/g, '$1')
    .replace(/[{}]/g, '');

  const unicodeMap: Record<string, string> = {
    '≤': '<=',
    '≥': '>=',
    '≠': '!=',
    '≈': '~=',
    '→': '->',
    '⇒': '=>',
    '⇔': '<=>',
    '∞': 'infinito',
    '√': 'sqrt',
    'π': 'pi',
    'α': 'alpha',
    'β': 'beta',
    'γ': 'gamma',
    'δ': 'delta',
    'Δ': 'Delta',
    'θ': 'theta',
    'λ': 'lambda',
    'μ': 'mu',
    'σ': 'sigma',
    'φ': 'phi',
    'ω': 'omega',
    'Ω': 'Ohm',
    '∑': 'Sum',
    '∫': 'Int',
    '∈': 'en',
    '∉': 'no en',
    '⊂': 'subconjunto',
    '⊆': 'subconjunto=',
    '∪': 'U',
    '∩': 'inter',
    '∅': 'vacio',
    'ℕ': 'N',
    'ℤ': 'Z',
    'ℚ': 'Q',
    'ℝ': 'R',
    'ℂ': 'C',
    '✓': '[OK]',
    '✔': '[OK]',
    '✗': '[X]',
    '✘': '[X]',
    '•': '-',
  };

  text = text.replace(
    /[≤≥≠≈→⇒⇔∞√πγαβδΔθλμσφωΩ∑∫∈∉⊂⊆∪∩∅ℕℤℚℝℂ✓✔✗✘•]/g,
    (ch) => unicodeMap[ch] ?? '?'
  );

  return text.replace(/[^\x09\x0A\x20-\x7E\xA0-\xFF\u2013\u2014]/g, '');
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'informe';
}

export function generateExamResultsPdf({
  form,
  questions,
  items,
  scoreOverrides,
  gradeOverrides = {},
  gradeRounding = 'quarter',
  sections,
}: GeneratePdfReportInput): void {
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  let y = MARGIN_TOP;

  const hasQuizScores = items.some((it) => it.score !== null);
  const totalStudents = items.length;
  const totalPoints = items.find((it) => it.score)?.score?.totalPoints ?? 0;

  const effectiveEarned = (item: ScoredStudentItem): number => {
    if (!item.score) return 0;
    return scoreOverrides[item.response.id] ?? item.score.earnedPoints;
  };

  const effectivePct = (item: ScoredStudentItem): number => {
    if (!item.score || item.score.totalPoints <= 0) return 0;
    return (effectiveEarned(item) / item.score.totalPoints) * 100;
  };

  const effectiveGrade = (item: ScoredStudentItem): number => {
    if (!item.score) return 1;
    const overrideGrade = gradeOverrides[item.response.id];
    if (overrideGrade !== undefined) {
      return snapGrade1to10(overrideGrade, gradeRounding);
    }
    return computeGrade1to10(effectiveEarned(item), item.score.totalPoints, gradeRounding);
  };

  const avgEarned =
    hasQuizScores && totalStudents > 0
      ? items.reduce((sum, it) => sum + effectiveEarned(it), 0) / totalStudents
      : 0;
  const avgGrade =
    hasQuizScores && totalStudents > 0
      ? items.reduce((sum, it) => sum + effectiveGrade(it), 0) / totalStudents
      : 0;
  const passedCount = hasQuizScores
    ? items.filter((it) => effectiveGrade(it) >= 6).length
    : 0;
  const passRate = hasQuizScores && totalStudents > 0 ? (passedCount / totalStudents) * 100 : 0;

  function ensureSpace(neededMm: number): boolean {
    if (y + neededMm > PAGE_H - MARGIN_BOTTOM) {
      doc.addPage();
      y = MARGIN_TOP;
      return true;
    }
    return false;
  }

  function drawSectionHeading(title: string) {
    ensureSpace(12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...COLOR_PRIMARY);
    doc.text(title.toUpperCase(), MARGIN_X, y);
    y += 2;
    doc.setDrawColor(...COLOR_PRIMARY);
    doc.setLineWidth(0.4);
    doc.line(MARGIN_X, y, PAGE_W - MARGIN_X, y);
    y += 5;
  }

  function drawTableGrid(
    headers: string[],
    rows: string[][],
    colWidths: number[],
    options?: {
      headerBg?: [number, number, number];
      alignments?: Array<'left' | 'center' | 'right'>;
      fontSize?: number;
      rowHighlight?: (rowIdx: number) => [number, number, number] | null;
    }
  ) {
    const fontSize = options?.fontSize ?? 8;
    const lineHeight = fontSize * 0.45 + 0.8;
    const padX = 2;
    const padY = 2;
    const alignments = options?.alignments ?? headers.map(() => 'left');

    const drawHeaderRow = () => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(fontSize);
      const headerWrapped = headers.map((h, i) =>
        doc.splitTextToSize(cleanTextForPdf(h), Math.max(8, colWidths[i] - padX * 2))
      );
      const maxLines = Math.max(1, ...headerWrapped.map((l) => l.length));
      const rowH = maxLines * lineHeight + padY * 2;
      ensureSpace(rowH + 4);

      let cx = MARGIN_X;
      for (let c = 0; c < headers.length; c++) {
        const w = colWidths[c];
        doc.setFillColor(...(options?.headerBg ?? COLOR_SOFT_BG));
        doc.setDrawColor(...COLOR_BORDER);
        doc.setLineWidth(0.25);
        doc.rect(cx, y, w, rowH, 'FD');

        doc.setTextColor(...COLOR_INK);
        const align = alignments[c] ?? 'left';
        const tx =
          align === 'center' ? cx + w / 2 : align === 'right' ? cx + w - padX : cx + padX;
        doc.text(headerWrapped[c], tx, y + padY + lineHeight * 0.78, { align });
        cx += w;
      }
      y += rowH;
    };

    drawHeaderRow();

    rows.forEach((row, rIdx) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(fontSize);
      const wrapped = headers.map((_, c) =>
        doc.splitTextToSize(cleanTextForPdf(row[c] ?? ''), Math.max(8, colWidths[c] - padX * 2))
      );
      const maxLines = Math.max(1, ...wrapped.map((l) => l.length));
      const rowH = maxLines * lineHeight + padY * 2;

      if (ensureSpace(rowH)) {
        drawHeaderRow();
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(fontSize);
      }

      const bg = options?.rowHighlight?.(rIdx) ?? null;
      let cx = MARGIN_X;
      for (let c = 0; c < headers.length; c++) {
        const w = colWidths[c];
        if (bg) {
          doc.setFillColor(...bg);
          doc.setDrawColor(...COLOR_BORDER);
          doc.setLineWidth(0.2);
          doc.rect(cx, y, w, rowH, 'FD');
        } else {
          doc.setDrawColor(...COLOR_BORDER);
          doc.setLineWidth(0.2);
          doc.rect(cx, y, w, rowH, 'D');
        }

        doc.setTextColor(...COLOR_INK);
        const align = alignments[c] ?? 'left';
        const tx =
          align === 'center' ? cx + w / 2 : align === 'right' ? cx + w - padX : cx + padX;
        doc.text(wrapped[c], tx, y + padY + lineHeight * 0.78, { align });
        cx += w;
      }
      y += rowH;
    });

    y += 4;
  }

  function drawQuestionTable(table: QuestionTable, rawAnswer: any) {
    const colCount = Math.max(1, table.headers.length);
    const colW = CONTENT_W / colCount;
    const colWidths = Array.from({ length: colCount }, () => colW);
    const editableSet = new Set(table.editableCells ?? []);
    const cellAnswers = parseEditableTableAnswer(rawAnswer);

    if (table.caption) {
      ensureSpace(6);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(...COLOR_MUTED);
      doc.text(cleanTextForPdf(table.caption), MARGIN_X, y + 3);
      y += 5;
    }

    const bodyRows = table.rows.map((row, rIdx) =>
      table.headers.map((_, cIdx) => {
        const coord = cellCoordKey(rIdx, cIdx);
        if (editableSet.has(coord)) {
          const val = cellAnswers[coord]?.trim();
          return val ? val : '(Sin completar)';
        }
        return row.cells[cIdx] ?? '';
      })
    );

    drawTableGrid(table.headers, bodyRows, colWidths, { fontSize: 7.5 });
  }

  const nowStr = new Date().toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const roundingLabel = gradeRounding === 'integer' ? '1-10 redondeado' : '1-10 cada 0.25';

  // 1. Header
  if (sections.header) {
    ensureSpace(22);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(...COLOR_PRIMARY);
    doc.text('INFORME DE RESULTADOS ACADEMICOS', PAGE_W / 2, y + 5, { align: 'center' });
    y += 11;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...COLOR_INK);
    const titleLines = doc.splitTextToSize(cleanTextForPdf(form?.title || 'Evaluacion'), CONTENT_W);
    doc.text(titleLines, PAGE_W / 2, y, { align: 'center' });
    y += titleLines.length * 5.2 + 2;

    doc.setDrawColor(...COLOR_INK);
    doc.setLineWidth(0.6);
    doc.line(MARGIN_X, y, PAGE_W - MARGIN_X, y);
    y += 7;
  }

  // 2. Meta
  if (sections.meta) {
    const metaRows: string[][] = [
      ['Evaluacion:', cleanTextForPdf(form?.title || '-'), 'Fecha de corte:', nowStr],
      ['Total estudiantes:', String(totalStudents), 'Actividades:', String(questions.length)],
    ];
    if (hasQuizScores) {
      metaRows.push([
        'Escala de nota:',
        roundingLabel,
        'Promedio nota:',
        `${avgGrade.toFixed(2)} / 10 (bruto ${avgEarned.toFixed(1)}/${totalPoints})`,
      ]);
    }

    doc.setFontSize(8.5);
    for (const [k1, v1, k2, v2] of metaRows) {
      ensureSpace(6);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLOR_MUTED);
      doc.text(k1, MARGIN_X, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLOR_INK);
      doc.text(doc.splitTextToSize(v1, 52)[0] ?? '', MARGIN_X + 34, y);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLOR_MUTED);
      doc.text(k2, MARGIN_X + 94, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLOR_INK);
      doc.text(doc.splitTextToSize(v2, 54)[0] ?? '', MARGIN_X + 126, y);
      y += 5.5;
    }
    y += 3;
  }

  // 3. Summary cards
  if (sections.summary && hasQuizScores) {
    ensureSpace(20);
    const cards = [
      { label: 'ESTUDIANTES', value: String(totalStudents), color: COLOR_INK },
      { label: 'PROMEDIO (1-10)', value: `${avgGrade.toFixed(2)}`, color: COLOR_PRIMARY },
      { label: 'APROBADOS (>=6)', value: String(passedCount), color: COLOR_GREEN },
      { label: 'REPROBADOS (<6)', value: String(totalStudents - passedCount), color: COLOR_RED },
      { label: 'APROBACION', value: `${passRate.toFixed(1)}%`, color: COLOR_PRIMARY },
    ];
    const gap = 3;
    const cardW = (CONTENT_W - gap * (cards.length - 1)) / cards.length;
    const cardH = 16;

    cards.forEach((card, idx) => {
      const cx = MARGIN_X + idx * (cardW + gap);
      doc.setFillColor(...COLOR_SOFT_BG);
      doc.setDrawColor(...COLOR_BORDER);
      doc.setLineWidth(0.3);
      doc.roundedRect(cx, y, cardW, cardH, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11.5);
      doc.setTextColor(...card.color);
      doc.text(card.value, cx + cardW / 2, y + 8, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.2);
      doc.setTextColor(...COLOR_MUTED);
      doc.text(card.label, cx + cardW / 2, y + 13, { align: 'center' });
    });

    y += cardH + 7;
  }

  // 4. Distribution
  if (sections.distribution && hasQuizScores) {
    drawSectionHeading(`Distribucion de calificaciones (${roundingLabel})`);
    const bands =
      gradeRounding === 'integer'
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
          ];
    const distRows = bands.map((b) => {
      const count = items.filter((it) => {
        const g = effectiveGrade(it);
        return g >= b.min && g < b.max;
      }).length;
      return [b.range, b.letter, b.label, String(count)];
    });

    drawTableGrid(
      ['Rango (1-10)', 'Nivel', 'Categoria', 'Estudiantes'],
      distRows,
      [42, 26, 76, 36],
      { alignments: ['left', 'center', 'left', 'center'], fontSize: 8 }
    );
  }

  // 5. Student list
  if (sections.studentList) {
    drawSectionHeading('Lista de calificaciones');
    if (items.length === 0) {
      ensureSpace(10);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(...COLOR_SUBTLE);
      doc.text('No hay respuestas registradas todavia.', MARGIN_X, y);
      y += 8;
    } else if (hasQuizScores) {
      const listRows = items.map((it, idx) => {
        const grade = effectiveGrade(it);
        const gradeStr = formatGrade1to10(grade, gradeRounding);
        const pct = effectivePct(it);
        const earned = effectiveEarned(it);
        const total = it.score?.totalPoints ?? 0;
        return [
          String(idx + 1),
          it.response.respondent?.name || '-',
          it.response.respondent?.email || it.response.respondentEmail || '-',
          `${earned}/${total}`,
          gradeStr,
          `${pct.toFixed(0)}%`,
          grade >= 6 ? 'APROBADO' : 'REPROBADO',
        ];
      });
      drawTableGrid(
        ['N°', 'Estudiante', 'Email', 'Puntaje', 'Nota (1-10)', '%', 'Estado'],
        listRows,
        [9, 43, 50, 19, 21, 14, 24],
        {
          alignments: ['center', 'left', 'left', 'center', 'center', 'center', 'center'],
          fontSize: 7.5,
          rowHighlight: (rowIdx) => (effectiveGrade(items[rowIdx]) < 6 ? COLOR_RED_BG : null),
        }
      );
    } else {
      const listRows = items.map((it, idx) => [
        String(idx + 1),
        it.response.respondent?.name || '-',
        it.response.respondent?.email || it.response.respondentEmail || '-',
        it.response.submittedAt?.toLocaleString() ?? '-',
      ]);
      drawTableGrid(
        ['N°', 'Estudiante', 'Email', 'Fecha de entrega'],
        listRows,
        [12, 58, 66, 44],
        { alignments: ['center', 'left', 'left', 'left'], fontSize: 7.8 }
      );
    }
  }

  // 6. Student detail
  if (sections.studentDetail && items.length > 0) {
    drawSectionHeading('Detalle por estudiante');

    items.forEach((it, sIdx) => {
      const r = it.response;
      const s = it.score;
      const earned = effectiveEarned(it);
      const pct = effectivePct(it);
      const grade = effectiveGrade(it);
      const gradeStr = formatGrade1to10(grade, gradeRounding);

      if (sIdx > 0) {
        ensureSpace(45);
      }

      ensureSpace(20);
      doc.setFillColor(...COLOR_SOFT_BG);
      doc.setDrawColor(...COLOR_PRIMARY);
      doc.setLineWidth(0.35);
      doc.roundedRect(MARGIN_X, y, CONTENT_W, 15, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(...COLOR_INK);
      doc.text(
        cleanTextForPdf(`${sIdx + 1}. ${r.respondent?.name || 'Estudiante sin nombre'}`),
        MARGIN_X + 3,
        y + 5.8
      );

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...COLOR_MUTED);
      doc.text(
        cleanTextForPdf(
          `${r.respondent?.email || r.respondentEmail || 'Sin correo'}${
            r.submittedAt ? `  ·  Entregado: ${r.submittedAt.toLocaleString()}` : ''
          }`
        ),
        MARGIN_X + 3,
        y + 11.2
      );

      if (s) {
        const statusColor = grade >= 6 ? COLOR_GREEN : COLOR_RED;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(...statusColor);
        doc.text(
          `Nota: ${gradeStr}/10  (${earned}/${s.totalPoints} · ${pct.toFixed(0)}%)`,
          PAGE_W - MARGIN_X - 3,
          y + 6,
          { align: 'right' }
        );

        doc.setFontSize(7.5);
        doc.text(
          `${grade >= 6 ? 'APROBADO' : 'REPROBADO'} · ${getGrade1to10Label(grade)}`,
          PAGE_W - MARGIN_X - 3,
          y + 11.2,
          { align: 'right' }
        );
      }

      y += 18;

      const scoreMap = new Map(s?.results.map((res) => [res.questionId, res]) ?? []);

      questions.forEach((q, qIdx) => {
        const res = scoreMap.get(q.id);
        const rawAns = r.answers[q.id];
        const parsedInline = !q.settings?.table ? parseMarkdownOrLatexTable(q.title) : null;
        const effectiveTable = q.settings?.table ?? parsedInline?.table;
        const cleanTitle = cleanTextForPdf(
          parsedInline ? parsedInline.remainingText || `Actividad ${qIdx + 1}` : q.title || `Actividad ${qIdx + 1}`
        );

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        const titleWrapped = doc.splitTextToSize(`${qIdx + 1}. ${cleanTitle}`, CONTENT_W - 26);

        const ansStr = cleanTextForPdf(
          rawAns !== undefined && rawAns !== null && String(rawAns).trim() !== '' && (!Array.isArray(rawAns) || rawAns.length > 0)
            ? rawAns
            : 'Sin responder'
        );
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        const ansWrapped = doc.splitTextToSize(`Respuesta: ${ansStr}`, CONTENT_W - 6);

        const showCorrect = Boolean(
          res && !res.isCorrect && res.correctAnswer !== null && res.correctAnswer !== undefined
        );
        const corrStr = showCorrect ? cleanTextForPdf(res!.correctAnswer) : '';
        const corrWrapped = showCorrect
          ? doc.splitTextToSize(`Correcta: ${corrStr}`, CONTENT_W - 6)
          : [];

        const blockHeight =
          titleWrapped.length * 4 + ansWrapped.length * 3.8 + corrWrapped.length * 3.8 + 8;

        ensureSpace(blockHeight);

        const statusBg = res ? (res.isCorrect ? COLOR_GREEN_BG : COLOR_RED_BG) : null;
        if (statusBg) {
          doc.setFillColor(...statusBg);
          doc.rect(MARGIN_X, y - 1, CONTENT_W, titleWrapped.length * 4 + 3, 'F');
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(...COLOR_INK);
        doc.text(titleWrapped, MARGIN_X + 2, y + 3);

        if (res) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(...(res.isCorrect ? COLOR_GREEN : COLOR_RED));
          doc.text(
            `${res.isCorrect ? 'OK' : 'X'}  ${res.earned}/${res.points}`,
            PAGE_W - MARGIN_X - 2,
            y + 3,
            { align: 'right' }
          );
        }

        y += titleWrapped.length * 4 + 3;

        if (effectiveTable) {
          drawQuestionTable(effectiveTable, rawAns);
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...COLOR_MUTED);
        doc.text(ansWrapped, MARGIN_X + 3, y + 2.5);
        y += ansWrapped.length * 3.8 + 2;

        if (showCorrect) {
          doc.setTextColor(...COLOR_GREEN);
          doc.text(corrWrapped, MARGIN_X + 3, y + 2.5);
          y += corrWrapped.length * 3.8 + 2;
        }

        doc.setDrawColor(...COLOR_BORDER);
        doc.setLineWidth(0.15);
        doc.line(MARGIN_X, y + 1, PAGE_W - MARGIN_X, y + 1);
        y += 4;
      });

      y += 4;
    });
  }

  // 7. Footer
  if (sections.footer) {
    ensureSpace(28);
    y += 4;
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.3);
    doc.line(MARGIN_X, y, PAGE_W - MARGIN_X, y);
    y += 6;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...COLOR_MUTED);
    doc.text('Observaciones:', MARGIN_X, y);
    doc.setDrawColor(...COLOR_BORDER);
    doc.line(MARGIN_X, y + 7, MARGIN_X + 85, y + 7);
    doc.line(MARGIN_X, y + 14, MARGIN_X + 85, y + 14);

    doc.setDrawColor(...COLOR_INK);
    doc.line(PAGE_W - MARGIN_X - 55, y + 12, PAGE_W - MARGIN_X, y + 12);
    doc.text('Firma del docente', PAGE_W - MARGIN_X - 27.5, y + 16.5, { align: 'center' });
  }

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR_SUBTLE);
    doc.text(`Sistema de Evaluaciones · ${nowStr}`, MARGIN_X, PAGE_H - 8);
    doc.text(`Pagina ${p} de ${totalPages}`, PAGE_W - MARGIN_X, PAGE_H - 8, { align: 'right' });
  }

  const baseName = sanitizeFilename(form?.title ?? 'informe');
  const dateStamp = new Date().toISOString().slice(0, 10);
  doc.save(`${baseName}_${dateStamp}.pdf`);
}
