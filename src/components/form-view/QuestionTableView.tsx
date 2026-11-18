import { LatexRenderer } from '../ui/LatexRenderer';
import {
  cellCoordKey,
  formatEditableTableAnswer,
  parseEditableTableAnswer,
} from '../../lib/tableUtils';
import type { QuestionTable } from '../../types/question';

interface QuestionTableViewProps {
  table: QuestionTable;
  value?: any;
  onChange?: (nextFormattedAnswer: string) => void;
  readOnly?: boolean;
}

export function QuestionTableView({
  table,
  value,
  onChange,
  readOnly = false,
}: QuestionTableViewProps) {
  const editableSet = new Set(table.editableCells ?? []);
  const cellValues = parseEditableTableAnswer(value);
  const colCount = Math.max(1, table.headers.length);
  const colWidth = `${100 / colCount}%`;
  const cellBorder = 'color-mix(in srgb, var(--form-primary, #1B3B6F) 36%, #9CA3AF)';
  const headerBg = 'color-mix(in srgb, var(--form-primary, #1B3B6F) 11%, var(--form-card-bg, #ffffff))';

  function handleCellChange(coord: string, nextVal: string) {
    if (!onChange) return;
    const nextMap = { ...cellValues, [coord]: nextVal };
    onChange(formatEditableTableAnswer(table, nextMap));
  }

  return (
    <div className="space-y-1.5">
      {table.caption && (
        <div
          className="text-xs font-medium opacity-80"
          style={{ color: 'var(--form-text, #1C1917)' }}
        >
          <LatexRenderer text={table.caption} />
        </div>
      )}

      <div
        className="overflow-x-auto transition-colors"
        style={{
          borderRadius: 'var(--form-radius, 0.5rem)',
          backgroundColor: 'var(--form-card-bg, #ffffff)',
        }}
      >
        <table className="w-full table-fixed border-collapse text-xs sm:text-sm">
          <colgroup>
            {table.headers.map((_, colIdx) => (
              <col key={colIdx} style={{ width: colWidth }} />
            ))}
          </colgroup>
          <thead>
            <tr style={{ backgroundColor: headerBg }}>
              {table.headers.map((header, colIdx) => (
                <th
                  key={colIdx}
                  className="border border-b-2 px-3.5 py-2.5 text-left font-semibold align-middle break-words"
                  style={{
                    borderColor: cellBorder,
                    color: 'var(--form-text, #1C1917)',
                  }}
                >
                  <LatexRenderer text={header || `Columna ${colIdx + 1}`} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIdx) => (
              <tr key={rowIdx}>
                {table.headers.map((header, colIdx) => {
                  const coord = cellCoordKey(rowIdx, colIdx);
                  const isEditable = editableSet.has(coord);
                  const staticText = row.cells[colIdx] ?? '';

                  return (
                    <td
                      key={colIdx}
                      className="border px-3.5 py-2.5 align-middle break-words"
                      style={{
                        borderColor: cellBorder,
                        color: 'var(--form-text, #1C1917)',
                        backgroundColor: isEditable
                          ? 'color-mix(in srgb, var(--form-primary, #1B3B6F) 4%, var(--form-card-bg, #ffffff))'
                          : 'transparent',
                      }}
                    >
                      {isEditable ? (
                        readOnly || !onChange ? (
                          <span className="inline-block rounded border border-dashed px-2 py-0.5 text-xs font-mono opacity-85">
                            {cellValues[coord]?.trim() || '________'}
                          </span>
                        ) : (
                          <input
                            type="text"
                            value={cellValues[coord] ?? ''}
                            onChange={(e) => handleCellChange(coord, e.target.value)}
                            placeholder="Completar..."
                            aria-label={`${header || `Columna ${colIdx + 1}`}, fila ${rowIdx + 1}`}
                            className="w-full min-w-0 rounded border px-2.5 py-1.5 text-xs sm:text-sm transition-colors focus:outline-none"
                          />
                        )
                      ) : (
                        <LatexRenderer text={staticText} />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editableSet.size > 0 && !readOnly && (
        <p className="text-[11px] opacity-70" style={{ color: 'var(--form-text, #1C1917)' }}>
          Completa directamente las celdas habilitadas dentro de la tabla.
        </p>
      )}
    </div>
  );
}
