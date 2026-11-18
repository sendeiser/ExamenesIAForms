import type { QuestionSettings, QuestionTable, QuestionTableRow } from '../types/question';

export function cellCoordKey(rowIdx: number, colIdx: number): string {
  return `${rowIdx}:${colIdx}`;
}

export function parseCellCoord(coord: string): [number, number] | null {
  const match = /^(\d+):(\d+)$/.exec(coord.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2])];
}

export function compareCoords(a: string, b: string): number {
  const pa = parseCellCoord(a);
  const pb = parseCellCoord(b);
  if (!pa || !pb) return a.localeCompare(b);
  return pa[0] - pb[0] || pa[1] - pb[1];
}

export function createDefaultQuestionTable(rowCount = 2, colCount = 3): QuestionTable {
  const safeCols = Math.max(1, colCount);
  const safeRows = Math.max(1, rowCount);
  return {
    headers: Array.from({ length: safeCols }, (_, i) => `Columna ${i + 1}`),
    rows: Array.from({ length: safeRows }, () => ({
      cells: Array.from({ length: safeCols }, () => ''),
    })),
    editableCells: [],
  };
}

/**
 * Normaliza cualquier objeto de tabla (incluyendo `rows: string[][]` generado por IA)
 * al formato compatible con Firestore (`rows: { cells: string[] }[]`).
 */
export function normalizeQuestionTable(raw: any): QuestionTable | undefined {
  if (!raw || typeof raw !== 'object') return undefined;

  const rawHeaders = Array.isArray(raw.headers)
    ? raw.headers.map((h: any) => String(h ?? ''))
    : [];

  const rawRows: string[][] = Array.isArray(raw.rows)
    ? raw.rows.map((row: any) => {
        if (Array.isArray(row)) {
          return row.map((c: any) => String(c ?? ''));
        }
        if (row && typeof row === 'object' && Array.isArray(row.cells)) {
          return row.cells.map((c: any) => String(c ?? ''));
        }
        return [];
      })
    : [];

  const colCount = Math.max(
    rawHeaders.length,
    ...rawRows.map((r) => r.length),
    0
  );

  if (colCount === 0) return undefined;

  const headers = Array.from({ length: colCount }, (_, i) =>
    rawHeaders[i] !== undefined ? rawHeaders[i] : `Columna ${i + 1}`
  );

  const normalizedSourceRows = rawRows.length > 0 ? rawRows : [Array.from({ length: colCount }, () => '')];
  const rows: QuestionTableRow[] = normalizedSourceRows.map((cells) => ({
    cells: Array.from({ length: colCount }, (_, c) => cells[c] ?? ''),
  }));

  const editableSet = new Set<string>();
  if (Array.isArray(raw.editableCells)) {
    for (const coord of raw.editableCells) {
      if (typeof coord !== 'string') continue;
      const parsed = parseCellCoord(coord);
      if (parsed && parsed[0] < rows.length && parsed[1] < colCount) {
        editableSet.add(cellCoordKey(parsed[0], parsed[1]));
      }
    }
  }

  const caption =
    typeof raw.caption === 'string' && raw.caption.trim()
      ? raw.caption.trim()
      : undefined;

  const result: QuestionTable = {
    headers,
    rows,
    editableCells: Array.from(editableSet).sort(compareCoords),
  };

  if (caption) {
    result.caption = caption;
  }

  return result;
}

function splitMarkdownCells(line: string): string[] {
  let trimmed = line.trim();
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
  if (trimmed.endsWith('|') && !trimmed.endsWith('\\|')) {
    trimmed = trimmed.slice(0, -1);
  }
  return trimmed
    .split(/(?<!\\)\|/)
    .map((cell) => cell.replace(/\\\|/g, '|').trim());
}

const MARKDOWN_SEPARATOR_RE =
  /^\s*\|?(?:\s*:?-{2,}:?\s*\|)+\s*(?:\s*:?-{2,}:?\s*)?\|?\s*$/;

export interface ParsedTableBlock {
  table: QuestionTable;
  beforeText: string;
  afterText: string;
  remainingText: string;
}

function parseMarkdownTableBlock(text: string): ParsedTableBlock | null {
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length - 1; i++) {
    const headerLine = lines[i];
    const separatorLine = lines[i + 1];

    if (!headerLine.includes('|') || !MARKDOWN_SEPARATOR_RE.test(separatorLine)) {
      continue;
    }

    const headers = splitMarkdownCells(headerLine);
    if (headers.length < 1) continue;

    const bodyRows: string[][] = [];
    let endIdx = i + 2;
    while (endIdx < lines.length && lines[endIdx].includes('|') && lines[endIdx].trim() !== '') {
      bodyRows.push(splitMarkdownCells(lines[endIdx]));
      endIdx++;
    }

    const table = normalizeQuestionTable({ headers, rows: bodyRows });
    if (!table) continue;

    const beforeText = lines.slice(0, i).join('\n').trim();
    const afterText = lines.slice(endIdx).join('\n').trim();
    const remainingText = [beforeText, afterText].filter(Boolean).join('\n\n');
    return { table, beforeText, afterText, remainingText };
  }

  return null;
}

const LATEX_TABLE_ENV_RE = /\\begin\{(tabular|array)\}\s*\{([^}]*)\}([\s\S]*?)\\end\{\1\}/g;
const LATEX_TEXT_CMD_NAMES = ['textbf', 'textit', 'text', 'mbox', 'emph', 'mathrm', 'mathbf'];

function isPrecededByLeftDelimiter(prefix: string): boolean {
  const trimmed = prefix.trimEnd();
  return /\\left\s*(?:\\\{|\\\[|\\\|?|\(|\[|\||\.)$/.test(trimmed);
}

function isPlainTextCommandArg(cell: string): string | null {
  const trimmed = cell.trim();
  for (const cmd of LATEX_TEXT_CMD_NAMES) {
    const prefix = `\\${cmd}{`;
    if (!trimmed.startsWith(prefix) || !trimmed.endsWith('}')) continue;
    let depth = 0;
    let closedAtEnd = true;
    for (let i = prefix.length - 1; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0 && i < trimmed.length - 1) {
          closedAtEnd = false;
          break;
        }
      }
    }
    if (closedAtEnd && depth === 0) {
      return trimmed.slice(prefix.length, -1).trim();
    }
  }
  return null;
}

function cleanLatexCell(rawCell: string, fromMathArray: boolean): string {
  let cell = rawCell.trim();
  if (!cell) return '';

  // Desenvolver comandos tipográficos si envuelven toda la celda (ej: \textbf{Edad})
  for (let pass = 0; pass < 3; pass++) {
    const unwrapped = isPlainTextCommandArg(cell);
    if (unwrapped === null) break;
    cell = unwrapped;
  }

  // En \begin{tabular}, si un texto plano tiene \textbf{...} parcial fuera de $...$, limpiarlo
  if (!fromMathArray && !cell.includes('$')) {
    cell = cell.replace(/\\(?:textbf|textit|emph|text)\{([^{}]*)\}/g, '$1').trim();
  }

  if (fromMathArray && cell && !cell.includes('$') && !cell.includes('\\(')) {
    const hasLatexMathSyntax =
      /[\\^_{}=<>±×÷]|^[a-zA-Z]$|^[a-zA-Z]\([^)]*\)$|[\u0370-\u03FF]/.test(cell);
    if (hasLatexMathSyntax) {
      return `$${cell}$`;
    }
  }

  return cell;
}

function stripEnclosingMathDelimiters(before: string, after: string): { beforeText: string; afterText: string } {
  const trimmedBefore = before.trimEnd();
  const trimmedAfter = after.trimStart();
  const pairs: Array<[string, string]> = [
    ['$$', '$$'],
    ['\\[', '\\]'],
    ['\\(', '\\)'],
    ['$', '$'],
  ];

  for (const [open, close] of pairs) {
    if (trimmedBefore.endsWith(open) && trimmedAfter.startsWith(close)) {
      if (open === '$' && trimmedBefore.endsWith('$$')) continue;
      return {
        beforeText: trimmedBefore.slice(0, -open.length).trim(),
        afterText: trimmedAfter.slice(close.length).trim(),
      };
    }
  }

  return {
    beforeText: before.trim(),
    afterText: after.trim(),
  };
}

function parseLatexTabularBlock(text: string): ParsedTableBlock | null {
  LATEX_TABLE_ENV_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = LATEX_TABLE_ENV_RE.exec(text)) !== null) {
    const envName = match[1];
    const colSpec = match[2];
    const body = match[3];
    const rawBefore = text.slice(0, match.index);

    if (envName === 'array') {
      if (isPrecededByLeftDelimiter(rawBefore)) {
        continue;
      }
      const specColCount = (colSpec.match(/[lcrp]/gi) ?? []).length;
      if (specColCount < 2 && !colSpec.includes('|') && !body.includes('\\hline')) {
        continue;
      }
    }

    const cleanedBody = body
      .replace(/\\hline/g, '')
      .replace(/\\toprule|\\midrule|\\bottomrule/g, '')
      .replace(/\\cline\{[^}]*\}/g, '');

    const fromMathArray = envName === 'array';
    const rawRows = cleanedBody
      .split(/\\\\(?:\s*\[[^\]]*\])?/)
      .map((row) => row.trim())
      .filter(Boolean)
      .map((row) =>
        row
          .split(/(?<!\\)&/)
          .map((cell) => cleanLatexCell(cell.replace(/\\&/g, '&'), fromMathArray))
      );

    if (rawRows.length === 0) continue;

    const [headers, ...rows] = rawRows;
    const table = normalizeQuestionTable({
      headers,
      rows: rows.length > 0 ? rows : [Array.from({ length: headers.length }, () => '')],
    });
    if (!table) continue;

    const rawAfter = text.slice(match.index + match[0].length);
    const { beforeText, afterText } = stripEnclosingMathDelimiters(rawBefore, rawAfter);
    const remainingText = [beforeText, afterText].filter(Boolean).join('\n\n');
    return { table, beforeText, afterText, remainingText };
  }

  return null;
}

/**
 * Detecta una tabla en formato Markdown (`| A | B |`) o LaTeX (`\begin{tabular}` / `\begin{array}`)
 * dentro de un texto y devuelve la tabla estructurada + texto previo y posterior.
 */
export function parseMarkdownOrLatexTable(text: string): ParsedTableBlock | null {
  if (!text) return null;
  const hasPipe = text.includes('|');
  const hasLatexTable = text.includes('\\begin{tabular}') || text.includes('\\begin{array}');
  if (!hasPipe && !hasLatexTable) {
    return null;
  }
  return parseMarkdownTableBlock(text) ?? parseLatexTabularBlock(text);
}

/**
 * Normaliza la tabla de una pregunta recibida desde IA (ya sea en `settings.table`
 * o embebida en `title` en Markdown/LaTeX) y autogenera respuesta esperada si corresponde.
 */
export function extractTableFromQuestionPayload(q: {
  title?: string;
  description?: string;
  settings?: Record<string, any>;
  correctAnswer?: string | string[] | null;
}): {
  title: string;
  settings: QuestionSettings;
  correctAnswer: string | string[] | null | undefined;
} {
  let title = String(q.title ?? '');
  const rawSettings = q.settings && typeof q.settings === 'object' ? { ...q.settings } : {};
  let table = normalizeQuestionTable(rawSettings.table);

  if (!table && title) {
    const parsedFromTitle = parseMarkdownOrLatexTable(title);
    if (parsedFromTitle) {
      table = parsedFromTitle.table;
      title = parsedFromTitle.remainingText || 'Observa o completa la siguiente tabla:';
    }
  }

  const nextSettings: QuestionSettings = { ...rawSettings };
  if (table) {
    nextSettings.table = table;
  } else {
    delete nextSettings.table;
  }

  let correctAnswer = q.correctAnswer;
  if (table && (!correctAnswer || (typeof correctAnswer === 'string' && !correctAnswer.trim()))) {
    const expected = buildExpectedTableAnswer(table);
    if (expected) {
      correctAnswer = expected;
    }
  }

  return { title, settings: nextSettings, correctAnswer };
}

export function formatEditableTableAnswer(
  table: QuestionTable,
  cellValues: Record<string, string>
): string {
  const coords = [...(table.editableCells ?? [])].sort(compareCoords);
  const parts: string[] = [];

  for (const coord of coords) {
    const parsed = parseCellCoord(coord);
    if (!parsed) continue;
    const rawVal = cellValues[coord];
    const trimmed = typeof rawVal === 'string' ? rawVal.trim() : '';
    if (!trimmed) continue;
    parts.push(`[F${parsed[0] + 1}C${parsed[1] + 1}] ${trimmed}`);
  }

  return parts.join(' | ');
}

export function parseEditableTableAnswer(raw: any): Record<string, string> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const mapped: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (parseCellCoord(key)) {
        mapped[key] = String(value ?? '');
      }
    }
    return mapped;
  }

  if (typeof raw !== 'string' || !raw.trim()) {
    return {};
  }

  const matches = Array.from(raw.matchAll(/\[F(\d+)C(\d+)\]\s*/g));
  const result: Record<string, string> = {};

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index ?? raw.length : raw.length;
    let slice = raw.slice(start, end).trim();
    if (i < matches.length - 1) {
      slice = slice.replace(/\s*\|\s*$/, '').trim();
    }
    const rowIdx = Number(m[1]) - 1;
    const colIdx = Number(m[2]) - 1;
    if (rowIdx >= 0 && colIdx >= 0) {
      result[cellCoordKey(rowIdx, colIdx)] = slice;
    }
  }

  return result;
}

export function buildExpectedTableAnswer(table: QuestionTable): string | null {
  const coords = table.editableCells ?? [];
  if (coords.length === 0) return null;

  const expectedValues: Record<string, string> = {};
  for (const coord of coords) {
    const parsed = parseCellCoord(coord);
    if (!parsed) continue;
    const [r, c] = parsed;
    const cellVal = table.rows[r]?.cells[c] ?? '';
    if (cellVal.trim()) {
      expectedValues[coord] = cellVal.trim();
    }
  }

  const formatted = formatEditableTableAnswer(table, expectedValues);
  return formatted || null;
}

/** Parsea texto pegado desde Excel / Google Sheets / Word separado por tabuladores y saltos de línea. */
export function parseTabularClipboardText(raw: string): string[][] | null {
  if (!raw || (!raw.includes('\t') && !raw.includes('\n'))) {
    return null;
  }

  const cleanLines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (cleanLines.length > 0 && cleanLines[cleanLines.length - 1] === '') {
    cleanLines.pop();
  }
  if (cleanLines.length === 0) return null;

  const grid = cleanLines.map((line) => line.split('\t').map((cell) => cell.trim()));
  const hasMultipleCells = grid.length > 1 || grid[0].length > 1;
  return hasMultipleCells ? grid : null;
}
