import { useEffect, useMemo, useState } from 'react';
import { parseMarkdownOrLatexTable } from '../../lib/tableUtils';
import type { QuestionTable } from '../../types/question';

interface LatexRendererProps {
  text: string;
}

type KatexModule = { renderToString: (expr: string, opts: { displayMode: boolean; throwOnError: boolean }) => string };

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const MATH_TOKEN_RE = /\\\[(.+?)\\\]|\$\$(.+?)\$\$|\\\((.+?)\\\)|\$(.+?)\$/gs;

function renderLatexToHtml(text: string, katex: KatexModule | null): { html: string; hasRichHtml: boolean } {
  if (!text) return { html: '', hasRichHtml: false };

  let lastIndex = 0;
  let out = '';
  let hasRichHtml = false;
  let match: RegExpExecArray | null;
  MATH_TOKEN_RE.lastIndex = 0;

  while ((match = MATH_TOKEN_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const plain = text.slice(lastIndex, match.index);
      if (plain.includes('\n')) hasRichHtml = true;
      out += escapeHtml(plain).replace(/\n/g, '<br />');
    }

    const displayExpr = match[1] ?? match[2];
    const inlineExpr = match[3] ?? match[4];
    const expr = (displayExpr ?? inlineExpr ?? '').trim();
    const displayMode = Boolean(displayExpr);

    if (katex && expr) {
      try {
        out += katex.renderToString(expr, { displayMode, throwOnError: false });
        hasRichHtml = true;
      } catch {
        out += escapeHtml(match[0]);
      }
    } else {
      out += escapeHtml(match[0]);
    }

    lastIndex = MATH_TOKEN_RE.lastIndex;
  }

  if (lastIndex < text.length) {
    const tail = text.slice(lastIndex);
    if (tail.includes('\n')) hasRichHtml = true;
    out += escapeHtml(tail).replace(/\n/g, '<br />');
  }

  return { html: out, hasRichHtml };
}

function LatexInline({ text, katex }: { text: string; katex: KatexModule | null }) {
  const { html, hasRichHtml } = useMemo(() => renderLatexToHtml(text, katex), [text, katex]);
  if (!hasRichHtml) return <>{text}</>;
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

function InlineRenderedTable({ table, katex }: { table: QuestionTable; katex: KatexModule | null }) {
  const colCount = Math.max(1, table.headers.length);
  const colWidth = `${100 / colCount}%`;
  const cellBorder = 'color-mix(in srgb, var(--form-primary, #1B3B6F) 38%, #9CA3AF)';

  return (
    <div
      className="my-2 overflow-x-auto rounded-lg"
      style={{ backgroundColor: 'var(--form-card-bg, #ffffff)' }}
    >
      <table className="w-full table-fixed border-collapse text-xs sm:text-sm">
        <colgroup>
          {table.headers.map((_, idx) => (
            <col key={idx} style={{ width: colWidth }} />
          ))}
        </colgroup>
        <thead>
          <tr
            style={{
              backgroundColor: 'color-mix(in srgb, var(--form-primary, #1B3B6F) 11%, var(--form-card-bg, #ffffff))',
            }}
          >
            {table.headers.map((header, idx) => (
              <th
                key={idx}
                className="border border-b-2 px-3.5 py-2.5 text-left font-semibold align-middle break-words"
                style={{
                  borderColor: cellBorder,
                  color: 'var(--form-text, #1C1917)',
                }}
              >
                <LatexInline text={header} katex={katex} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rIdx) => (
            <tr key={rIdx}>
              {table.headers.map((_, cIdx) => (
                <td
                  key={cIdx}
                  className="border px-3.5 py-2.5 align-middle break-words"
                  style={{
                    borderColor: cellBorder,
                    color: 'var(--form-text, #1C1917)',
                  }}
                >
                  <LatexInline text={row.cells[cIdx] ?? ''} katex={katex} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LatexRenderer({ text }: LatexRendererProps) {
  const [katex, setKatex] = useState<KatexModule | null>(null);

  useEffect(() => {
    import('katex').then((mod) => setKatex(mod.default as unknown as KatexModule));
  }, []);

  const parsedTable = useMemo(() => parseMarkdownOrLatexTable(text), [text]);

  if (parsedTable) {
    return (
      <span className="block space-y-2">
        {parsedTable.beforeText && (
          <span className="block">
            <LatexInline text={parsedTable.beforeText} katex={katex} />
          </span>
        )}
        <InlineRenderedTable table={parsedTable.table} katex={katex} />
        {parsedTable.afterText && (
          <span className="block">
            <LatexRenderer text={parsedTable.afterText} />
          </span>
        )}
      </span>
    );
  }

  return <LatexInline text={text} katex={katex} />;
}
