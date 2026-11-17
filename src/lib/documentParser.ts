export interface PreparedDocument {
  filename: string;
  ext: 'pdf' | 'docx' | 'txt' | 'md';
  pages: string[];
  totalPages: number;
  isScannedPdf: boolean;
  rawFile: File;
}

export interface PdfSpanInput {
  text: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  isBold: boolean;
}

interface PdfLine {
  y: number;
  x: number;
  text: string;
  fontSize: number;
  isBold: boolean;
}

const PAGE_NUMBER_REGEX = /^(?:p[áa]g(?:ina)?\.?|page)?\s*\d+(?:\s*(?:de|\/)\s*\d+)?$/i;
const BULLET_PREFIX_REGEX = /^[•●▪▫‣◦·]\s+/;
const LIST_ITEM_REGEX = /^(?:[-*]|\d+[.)])\s+/;

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/** Parsea rangos de página como "1-3, 5, 8-10" dentro de [1, totalPages]. */
export function parsePageRange(input: string, totalPages: number): number[] {
  const clean = input.trim().toLowerCase();
  if (!clean || clean === 'todas' || clean === 'all') {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const selected = new Set<number>();
  const tokens = clean.split(/[,;\s]+/).filter(Boolean);

  for (const token of tokens) {
    const rangeMatch = token.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const start = Math.max(1, Math.min(totalPages, Number(rangeMatch[1])));
      const end = Math.max(1, Math.min(totalPages, Number(rangeMatch[2])));
      const [from, to] = start <= end ? [start, end] : [end, start];
      for (let p = from; p <= to; p++) {
        selected.add(p);
      }
      continue;
    }

    const single = Number(token);
    if (Number.isInteger(single) && single >= 1 && single <= totalPages) {
      selected.add(single);
    }
  }

  return Array.from(selected).sort((a, b) => a - b);
}

export function buildMarkdownFromPages(
  doc: PreparedDocument,
  pageRangeInput = ''
): { markdown: string; selectedPages: number[] } {
  if (doc.ext !== 'pdf' || doc.totalPages <= 1) {
    return {
      markdown: doc.pages[0] ?? '',
      selectedPages: doc.totalPages > 0 ? [1] : [],
    };
  }

  const selectedPages = parsePageRange(pageRangeInput, doc.totalPages);
  const parts = selectedPages
    .map((pageNum) => {
      const content = (doc.pages[pageNum - 1] ?? '').trim();
      if (!content) return '';
      return selectedPages.length > 1 ? `<!-- Página ${pageNum} -->\n${content}` : content;
    })
    .filter(Boolean);

  return {
    markdown: parts.join('\n\n---\n\n'),
    selectedPages,
  };
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo PDF.'));
    reader.readAsDataURL(file);
  });
}

function normalizePlainText(text: string): string {
  return text.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function groupSpansIntoLines(spans: PdfSpanInput[]): PdfLine[] {
  if (spans.length === 0) return [];

  const sortedByY = [...spans].sort((a, b) => b.y - a.y || a.x - b.x);
  const groups: PdfSpanInput[][] = [];

  for (const span of sortedByY) {
    const lastGroup = groups[groups.length - 1];
    if (!lastGroup) {
      groups.push([span]);
      continue;
    }
    const avgY = lastGroup.reduce((acc, s) => acc + s.y, 0) / lastGroup.length;
    const tol = Math.max(2.5, span.fontSize * 0.45);
    if (Math.abs(span.y - avgY) <= tol) {
      lastGroup.push(span);
    } else {
      groups.push([span]);
    }
  }

  return groups
    .map((group) => {
      const ordered = [...group].sort((a, b) => a.x - b.x);
      let lineText = '';
      let boldChars = 0;
      let totalChars = 0;
      const sizeWeights = new Map<number, number>();

      for (let i = 0; i < ordered.length; i++) {
        const curr = ordered[i];
        const prev = i > 0 ? ordered[i - 1] : null;
        const cleanStr = curr.text.replace(/\s+/g, ' ');

        if (prev) {
          const gap = curr.x - (prev.x + prev.width);
          const refSize = Math.max(curr.fontSize, prev.fontSize);
          if (gap > refSize * 2.2) {
            lineText = lineText.trimEnd() + ' | ' + cleanStr.trimStart();
          } else if (gap > refSize * 0.16 && !lineText.endsWith(' ') && !cleanStr.startsWith(' ')) {
            lineText += ' ' + cleanStr;
          } else {
            lineText += cleanStr;
          }
        } else {
          lineText += cleanStr;
        }

        const charLen = curr.text.trim().length;
        if (charLen > 0) {
          totalChars += charLen;
          if (curr.isBold) boldChars += charLen;
          const roundedSize = Math.round(curr.fontSize * 2) / 2;
          sizeWeights.set(roundedSize, (sizeWeights.get(roundedSize) ?? 0) + charLen);
        }
      }

      let dominantSize = ordered[0].fontSize;
      let maxWeight = -1;
      for (const [size, weight] of sizeWeights.entries()) {
        if (weight > maxWeight) {
          maxWeight = weight;
          dominantSize = size;
        }
      }

      return {
        y: ordered[0].y,
        x: ordered[0].x,
        text: lineText.replace(/\s+/g, ' ').trim(),
        fontSize: dominantSize,
        isBold: totalChars > 0 && boldChars / totalChars >= 0.7,
      };
    })
    .filter((line) => line.text.length > 0);
}

function detectBodyFontSize(pageLines: PdfLine[][]): number {
  const counts = new Map<number, number>();
  for (const lines of pageLines) {
    for (const line of lines) {
      const size = Math.round(line.fontSize * 2) / 2;
      counts.set(size, (counts.get(size) ?? 0) + line.text.length);
    }
  }
  let bodySize = 12;
  let maxChars = -1;
  for (const [size, chars] of counts.entries()) {
    if (chars > maxChars) {
      maxChars = chars;
      bodySize = size;
    }
  }
  return bodySize;
}

function normalizeEdgePattern(text: string): string {
  return text.replace(/\d+/g, '#').trim().toLowerCase();
}

function stripRepeatedHeadersAndFooters(pageLines: PdfLine[][]): PdfLine[][] {
  if (pageLines.length < 3) {
    return pageLines.map((lines) =>
      lines.filter((line, idx) => {
        const isEdge = idx === 0 || idx === lines.length - 1;
        return !(isEdge && PAGE_NUMBER_REGEX.test(line.text));
      })
    );
  }

  const headerCounts = new Map<string, number>();
  const footerCounts = new Map<string, number>();

  for (const lines of pageLines) {
    if (lines.length === 0) continue;
    const first = normalizeEdgePattern(lines[0].text);
    const last = normalizeEdgePattern(lines[lines.length - 1].text);
    if (first.length <= 100) headerCounts.set(first, (headerCounts.get(first) ?? 0) + 1);
    if (last.length <= 100) footerCounts.set(last, (footerCounts.get(last) ?? 0) + 1);
  }

  const threshold = Math.ceil(pageLines.length * 0.5);

  return pageLines.map((lines) =>
    lines.filter((line, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === lines.length - 1;
      if ((isFirst || isLast) && PAGE_NUMBER_REGEX.test(line.text)) return false;
      const pattern = normalizeEdgePattern(line.text);
      if (isFirst && (headerCounts.get(pattern) ?? 0) >= threshold) return false;
      if (isLast && (footerCounts.get(pattern) ?? 0) >= threshold) return false;
      return true;
    })
  );
}

function formatLinesAsMarkdown(lines: PdfLine[], bodyFontSize: number): string {
  if (lines.length === 0) return '';

  const blocks: Array<{ kind: 'heading' | 'list' | 'paragraph'; text: string; lastY: number; fontSize: number }> = [];

  for (const line of lines) {
    let text = line.text;
    const isLargeH1 = line.fontSize >= bodyFontSize * 1.45 && text.length <= 120;
    const isLargeH2 = !isLargeH1 && line.fontSize >= bodyFontSize * 1.2 && text.length <= 120;
    const isSubHeading =
      !isLargeH1 &&
      !isLargeH2 &&
      text.length <= 95 &&
      !/[.,:;]$/.test(text) &&
      (line.fontSize >= bodyFontSize * 1.08 || (line.isBold && !BULLET_PREFIX_REGEX.test(text) && !LIST_ITEM_REGEX.test(text)));

    if (isLargeH1) {
      blocks.push({ kind: 'heading', text: `# ${text}`, lastY: line.y, fontSize: line.fontSize });
      continue;
    }
    if (isLargeH2) {
      blocks.push({ kind: 'heading', text: `## ${text}`, lastY: line.y, fontSize: line.fontSize });
      continue;
    }
    if (isSubHeading) {
      blocks.push({ kind: 'heading', text: `### ${text}`, lastY: line.y, fontSize: line.fontSize });
      continue;
    }

    if (BULLET_PREFIX_REGEX.test(text)) {
      text = text.replace(BULLET_PREFIX_REGEX, '- ');
      blocks.push({ kind: 'list', text, lastY: line.y, fontSize: line.fontSize });
      continue;
    }
    if (LIST_ITEM_REGEX.test(text)) {
      blocks.push({ kind: 'list', text, lastY: line.y, fontSize: line.fontSize });
      continue;
    }

    const prev = blocks[blocks.length - 1];
    if (!prev || prev.kind === 'heading') {
      blocks.push({ kind: 'paragraph', text, lastY: line.y, fontSize: line.fontSize });
      continue;
    }

    const verticalGap = prev.lastY - line.y;
    const sameParagraph = verticalGap > 0 && verticalGap <= prev.fontSize * 1.65;

    if (sameParagraph && prev.kind === 'paragraph') {
      if (/[a-záéíóúüñ]-$/i.test(prev.text) && /^[a-záéíóúüñ]/i.test(text)) {
        prev.text = prev.text.slice(0, -1) + text;
      } else {
        prev.text = `${prev.text} ${text}`;
      }
      prev.lastY = line.y;
      prev.fontSize = line.fontSize;
    } else if (sameParagraph && prev.kind === 'list') {
      if (/[a-záéíóúüñ]-$/i.test(prev.text) && /^[a-záéíóúüñ]/i.test(text)) {
        prev.text = prev.text.slice(0, -1) + text;
      } else {
        prev.text = `${prev.text} ${text}`;
      }
      prev.lastY = line.y;
      prev.fontSize = line.fontSize;
    } else {
      blocks.push({ kind: 'paragraph', text, lastY: line.y, fontSize: line.fontSize });
    }
  }

  return blocks
    .map((b) => b.text)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Convierte spans agrupados por página en Markdown limpio eliminando encabezados/pies repetidos. */
export function convertPdfSpansToMarkdownPages(
  pagesSpans: PdfSpanInput[][]
): { pages: string[]; isScannedPdf: boolean } {
  const rawPageLines = pagesSpans.map((spans) => groupSpansIntoLines(spans));
  const totalLines = rawPageLines.reduce((sum, lines) => sum + lines.length, 0);
  if (totalLines === 0) {
    return { pages: pagesSpans.map(() => ''), isScannedPdf: true };
  }

  const bodyFontSize = detectBodyFontSize(rawPageLines);
  const cleanedPages = stripRepeatedHeadersAndFooters(rawPageLines);
  const markdownPages = cleanedPages.map((lines) => formatLinesAsMarkdown(lines, bodyFontSize));

  return {
    pages: markdownPages,
    isScannedPdf: markdownPages.every((p) => !p.trim()),
  };
}

/** Convierte cada página de un PDF en Markdown limpio analizando fuentes y posiciones. */
async function extractPdfMarkdownPages(file: File): Promise<{ pages: string[]; isScannedPdf: boolean }> {
  const [pdfjsLib, workerModule] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerModule.default;

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pagesSpans: PdfSpanInput[][] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const styles = textContent.styles ?? {};
    const spans: PdfSpanInput[] = [];

    for (const item of textContent.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const t = item.transform;
      const fontSize = Math.max(4, Math.hypot(t[2], t[3]) || Math.abs(t[0]) || 12);
      const styleInfo = styles[item.fontName];
      const fontDesc = `${item.fontName ?? ''} ${styleInfo?.fontFamily ?? ''}`;
      spans.push({
        text: item.str,
        x: t[4],
        y: t[5],
        width: item.width ?? 0,
        fontSize,
        isBold: /bold|black|heavy|semibold|demi/i.test(fontDesc),
      });
    }

    pagesSpans.push(spans);
  }

  return convertPdfSpansToMarkdownPages(pagesSpans);
}

async function decompressDeflateRaw(compressed: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Tu navegador no soporta la descompresión de archivos DOCX. Usa formato PDF, MD o TXT.');
  }
  const stream = new Blob([compressed.slice()]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

function findZipEndOfCentralDirectory(view: DataView, byteLength: number): number {
  const minOffset = Math.max(0, byteLength - 65557);
  for (let i = byteLength - 22; i >= minOffset; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      const commentLen = view.getUint16(i + 20, true);
      if (i + 22 + commentLen === byteLength) {
        return i;
      }
    }
  }
  return -1;
}

function extractParagraphText(p: Element): string {
  let line = '';
  const descendants = Array.from(p.getElementsByTagName('*'));
  for (const node of descendants) {
    if (node.localName === 't') {
      line += node.textContent ?? '';
    } else if (node.localName === 'tab') {
      line += ' ';
    } else if (node.localName === 'br' || node.localName === 'cr') {
      line += '\n';
    }
  }
  return line.replace(/[ \t]+/g, ' ').trim();
}

function formatWordParagraph(p: Element): string {
  const text = extractParagraphText(p);
  if (!text) return '';

  const pPr = Array.from(p.children).find((el) => el.localName === 'pPr');
  if (pPr) {
    const pStyle = Array.from(pPr.children).find((el) => el.localName === 'pStyle');
    const styleVal = (pStyle?.getAttribute('w:val') ?? pStyle?.getAttribute('val') ?? '').toLowerCase();
    if (/^(?:heading|titulo|title)1$|title/.test(styleVal)) return `# ${text}`;
    if (/^(?:heading|titulo|subtitle)2$|subtitle/.test(styleVal)) return `## ${text}`;
    if (/^(?:heading|titulo)3$/.test(styleVal)) return `### ${text}`;
    if (/^(?:heading|titulo)[4-6]$/.test(styleVal)) return `#### ${text}`;

    const hasNumPr = Array.from(pPr.children).some((el) => el.localName === 'numPr');
    if (hasNumPr || /list/.test(styleVal)) {
      return LIST_ITEM_REGEX.test(text) ? text : `- ${text}`;
    }
  }

  return text;
}

function formatWordTable(tbl: Element): string {
  const rows = Array.from(tbl.children).filter((el) => el.localName === 'tr');
  const matrix = rows
    .map((tr) =>
      Array.from(tr.children)
        .filter((el) => el.localName === 'tc')
        .map((tc) =>
          Array.from(tc.children)
            .filter((el) => el.localName === 'p')
            .map((p) => extractParagraphText(p))
            .filter(Boolean)
            .join(' ')
            .replace(/\|/g, '\\|')
        )
    )
    .filter((r) => r.length > 0);

  if (matrix.length === 0) return '';
  const colCount = Math.max(...matrix.map((r) => r.length));
  const normalizeRow = (r: string[]) =>
    `| ${Array.from({ length: colCount }, (_, i) => r[i] ?? '').join(' | ')} |`;

  const lines = [normalizeRow(matrix[0]), `| ${Array(colCount).fill('---').join(' | ')} |`];
  for (let i = 1; i < matrix.length; i++) {
    lines.push(normalizeRow(matrix[i]));
  }
  return lines.join('\n');
}

function extractMarkdownFromWordXml(xmlText: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error('El contenido XML del archivo DOCX está dañado.');
  }

  const body = Array.from(doc.getElementsByTagName('*')).find((el) => el.localName === 'body');
  const blocks: string[] = [];

  if (body) {
    for (const child of Array.from(body.children)) {
      if (child.localName === 'p') {
        const formatted = formatWordParagraph(child);
        if (formatted) blocks.push(formatted);
      } else if (child.localName === 'tbl') {
        const tableMd = formatWordTable(child);
        if (tableMd) blocks.push(tableMd);
      }
    }
  } else {
    const paragraphs = Array.from(doc.getElementsByTagName('*')).filter((el) => el.localName === 'p');
    for (const p of paragraphs) {
      const formatted = formatWordParagraph(p);
      if (formatted) blocks.push(formatted);
    }
  }

  return blocks.join('\n\n');
}

/** Extrae Markdown limpio desde un archivo .docx (ZIP con word/document.xml) en el navegador. */
export async function extractDocxMarkdown(buffer: ArrayBuffer): Promise<string> {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const eocdOffset = findZipEndOfCentralDirectory(view, bytes.length);

  if (eocdOffset === -1) {
    throw new Error('El archivo no es un documento .docx válido (ZIP inválido).');
  }

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  let offset = view.getUint32(eocdOffset + 16, true);
  const decoder = new TextDecoder('utf-8');

  for (let entry = 0; entry < totalEntries; entry++) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) {
      break;
    }

    const compressionMethod = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const fileNameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);

    const fileName = decoder.decode(bytes.subarray(offset + 46, offset + 46 + fileNameLen));

    if (fileName === 'word/document.xml') {
      if (localHeaderOffset + 30 > bytes.length || view.getUint32(localHeaderOffset, true) !== 0x04034b50) {
        throw new Error('Encabezado corrupto dentro del archivo DOCX.');
      }
      const localNameLen = view.getUint16(localHeaderOffset + 26, true);
      const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
      const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
      const compressedSlice = bytes.subarray(dataStart, dataStart + compressedSize);

      let xmlBytes: Uint8Array;
      if (compressionMethod === 0) {
        xmlBytes = compressedSlice;
      } else if (compressionMethod === 8) {
        xmlBytes = await decompressDeflateRaw(compressedSlice);
      } else {
        throw new Error('Método de compresión no soportado en el DOCX. Convierte el archivo a PDF, MD o TXT.');
      }

      const xmlText = decoder.decode(xmlBytes);
      const extracted = extractMarkdownFromWordXml(xmlText);
      if (!extracted.trim()) {
        throw new Error('El documento DOCX no contiene texto legible.');
      }
      return extracted;
    }

    offset += 46 + fileNameLen + extraLen + commentLen;
  }

  throw new Error('No se encontró contenido de texto en el archivo DOCX.');
}

/** Convierte un archivo (.pdf, .docx, .txt o .md) en un documento preparado con Markdown por página. */
export async function prepareDocument(file: File): Promise<PreparedDocument> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'txt' || ext === 'md') {
    const rawText = normalizePlainText(await file.text());
    return {
      filename: file.name,
      ext,
      pages: [rawText],
      totalPages: 1,
      isScannedPdf: false,
      rawFile: file,
    };
  }

  if (ext === 'docx') {
    const buffer = await file.arrayBuffer();
    const markdown = await extractDocxMarkdown(buffer);
    return {
      filename: file.name,
      ext: 'docx',
      pages: [markdown],
      totalPages: 1,
      isScannedPdf: false,
      rawFile: file,
    };
  }

  if (ext === 'pdf') {
    const { pages, isScannedPdf } = await extractPdfMarkdownPages(file);
    return {
      filename: file.name,
      ext: 'pdf',
      pages,
      totalPages: pages.length,
      isScannedPdf,
      rawFile: file,
    };
  }

  throw new Error('Formato de archivo no soportado. Usa PDF, DOCX, TXT o MD.');
}
