import type { AiProvider } from '../store/aiSettingsStore';

export type ParsedDocument =
  | { kind: 'text'; filename: string; text: string }
  | { kind: 'pdf'; filename: string; dataUrl: string };

async function extractPdfText(file: File): Promise<string> {
  const [pdfjsLib, workerModule] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerModule.default;

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .trim();
    if (pageText) {
      pages.push(pageText);
    }
  }

  const fullText = pages.join('\n\n');
  if (!fullText.trim()) {
    throw new Error(
      'No se pudo extraer texto del PDF (puede estar escaneado como imagen). Prueba con OpenRouter o sube un archivo TXT/DOCX.'
    );
  }
  return fullText;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo PDF.'));
    reader.readAsDataURL(file);
  });
}

async function decompressDeflateRaw(compressed: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Tu navegador no soporta la descompresión de archivos DOCX. Usa formato PDF o TXT.');
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

function extractTextFromWordXml(xmlText: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error('El contenido XML del archivo DOCX está dañado.');
  }

  const paragraphs = Array.from(doc.getElementsByTagName('*')).filter((el) => el.localName === 'p');
  const lines: string[] = [];

  for (const p of paragraphs) {
    let line = '';
    const descendants = Array.from(p.getElementsByTagName('*'));
    for (const node of descendants) {
      if (node.localName === 't') {
        line += node.textContent ?? '';
      } else if (node.localName === 'tab') {
        line += '\t';
      } else if (node.localName === 'br' || node.localName === 'cr') {
        line += '\n';
      }
    }
    if (line.trim()) {
      lines.push(line);
    }
  }

  return lines.join('\n');
}

/** Extrae texto plano desde un archivo .docx (ZIP con word/document.xml) en el navegador. */
export async function extractDocxText(buffer: ArrayBuffer): Promise<string> {
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
        throw new Error('Método de compresión no soportado en el DOCX. Convierte el archivo a PDF o TXT.');
      }

      const xmlText = decoder.decode(xmlBytes);
      const extracted = extractTextFromWordXml(xmlText);
      if (!extracted.trim()) {
        throw new Error('El documento DOCX no contiene texto legible.');
      }
      return extracted;
    }

    offset += 46 + fileNameLen + extraLen + commentLen;
  }

  throw new Error('No se encontró contenido de texto en el archivo DOCX.');
}

/** Prepara un documento (.txt, .pdf o .docx) según el proveedor de IA seleccionado. */
export async function parseDocumentForAi(
  file: File,
  provider: AiProvider = 'openrouter'
): Promise<ParsedDocument> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'txt') {
    const text = await file.text();
    return { kind: 'text', filename: file.name, text };
  }

  if (ext === 'pdf') {
    if (provider === 'groq') {
      const text = await extractPdfText(file);
      return { kind: 'text', filename: file.name, text };
    }
    const dataUrl = await readFileAsDataUrl(file);
    return { kind: 'pdf', filename: file.name, dataUrl };
  }

  if (ext === 'docx') {
    const buffer = await file.arrayBuffer();
    const text = await extractDocxText(buffer);
    return { kind: 'text', filename: file.name, text };
  }

  throw new Error('Formato de archivo no soportado. Usa PDF, TXT o DOCX.');
}
