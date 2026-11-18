import type { ClipboardEvent } from 'react';
import { Plus, Trash2, PenLine, Columns3, Rows3, X, Table2 } from 'lucide-react';
import {
  cellCoordKey,
  compareCoords,
  parseCellCoord,
  parseTabularClipboardText,
} from '../../lib/tableUtils';
import type { QuestionTable } from '../../types/question';

interface TableEditorProps {
  table: QuestionTable;
  isQuiz?: boolean;
  onChange: (nextTable: QuestionTable) => void;
  onRemove: () => void;
}

export function TableEditor({ table, isQuiz = false, onChange, onRemove }: TableEditorProps) {
  const editableSet = new Set(table.editableCells ?? []);
  const colCount = Math.max(1, table.headers.length);

  function commit(next: Partial<QuestionTable>) {
    const merged: QuestionTable = {
      headers: next.headers ?? table.headers,
      rows: next.rows ?? table.rows,
      editableCells: next.editableCells ?? table.editableCells ?? [],
      ...(next.caption !== undefined
        ? next.caption.trim()
          ? { caption: next.caption }
          : {}
        : table.caption
          ? { caption: table.caption }
          : {}),
    };
    onChange(merged);
  }

  function updateHeader(colIdx: number, value: string) {
    const headers = [...table.headers];
    headers[colIdx] = value;
    commit({ headers });
  }

  function updateCell(rowIdx: number, colIdx: number, value: string) {
    const rows = table.rows.map((r, rI) =>
      rI === rowIdx
        ? { cells: r.cells.map((c, cI) => (cI === colIdx ? value : c)) }
        : r
    );
    commit({ rows });
  }

  function toggleEditableCell(rowIdx: number, colIdx: number) {
    const coord = cellCoordKey(rowIdx, colIdx);
    const next = new Set(editableSet);
    if (next.has(coord)) {
      next.delete(coord);
    } else {
      next.add(coord);
    }
    commit({ editableCells: Array.from(next).sort(compareCoords) });
  }

  function addRow() {
    const newRow = { cells: Array.from({ length: colCount }, () => '') };
    commit({ rows: [...table.rows, newRow] });
  }

  function removeRow(targetIdx: number) {
    if (table.rows.length <= 1) return;
    const rows = table.rows.filter((_, idx) => idx !== targetIdx);
    const editableCells: string[] = [];
    for (const coord of editableSet) {
      const parsed = parseCellCoord(coord);
      if (!parsed) continue;
      const [r, c] = parsed;
      if (r === targetIdx) continue;
      editableCells.push(cellCoordKey(r > targetIdx ? r - 1 : r, c));
    }
    commit({ rows, editableCells: editableCells.sort(compareCoords) });
  }

  function addColumn() {
    const headers = [...table.headers, `Columna ${colCount + 1}`];
    const rows = table.rows.map((r) => ({ cells: [...r.cells, ''] }));
    commit({ headers, rows });
  }

  function removeColumn(targetCol: number) {
    if (colCount <= 1) return;
    const headers = table.headers.filter((_, idx) => idx !== targetCol);
    const rows = table.rows.map((r) => ({
      cells: r.cells.filter((_, idx) => idx !== targetCol),
    }));
    const editableCells: string[] = [];
    for (const coord of editableSet) {
      const parsed = parseCellCoord(coord);
      if (!parsed) continue;
      const [r, c] = parsed;
      if (c === targetCol) continue;
      editableCells.push(cellCoordKey(r, c > targetCol ? c - 1 : c));
    }
    commit({ headers, rows, editableCells: editableCells.sort(compareCoords) });
  }

  function handlePasteGrid(
    e: ClipboardEvent<HTMLInputElement>,
    startRow: number,
    startCol: number,
    inHeader = false
  ) {
    const pasted = e.clipboardData.getData('text');
    const grid = parseTabularClipboardText(pasted);
    if (!grid) return;

    e.preventDefault();
    const maxPasteCols = Math.max(...grid.map((row) => row.length));
    const neededCols = Math.max(colCount, startCol + maxPasteCols);

    const headers = Array.from({ length: neededCols }, (_, c) => table.headers[c] ?? `Columna ${c + 1}`);
    let nextRows = table.rows.map((r) => ({
      cells: Array.from({ length: neededCols }, (_, c) => r.cells[c] ?? ''),
    }));

    let bodyGrid = grid;
    if (inHeader) {
      grid[0].forEach((val, offset) => {
        headers[startCol + offset] = val;
      });
      bodyGrid = grid.slice(1);
    }

    const bodyStartRow = inHeader ? 0 : startRow;
    const neededRows = Math.max(nextRows.length, bodyStartRow + bodyGrid.length);
    while (nextRows.length < neededRows) {
      nextRows.push({ cells: Array.from({ length: neededCols }, () => '') });
    }

    bodyGrid.forEach((pastedRow, rOffset) => {
      const targetRow = nextRows[bodyStartRow + rOffset];
      pastedRow.forEach((val, cOffset) => {
        targetRow.cells[startCol + cOffset] = val;
      });
    });

    commit({ headers, rows: nextRows });
  }

  return (
    <div className="rounded-xl border border-sand-300 bg-sand-50/70 p-3.5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-brand-50 text-brand-600 border border-brand-200/80">
            <Table2 className="h-3.5 w-3.5" />
          </span>
          <div>
            <span className="text-xs font-bold text-ink">Tabla de la actividad</span>
            <span className="ml-2 text-[11px] font-mono text-ink-subtle">
              {table.rows.length}×{colCount}
              {editableSet.size > 0 && ` · ${editableSet.size} editable${editableSet.size === 1 ? '' : 's'}`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1 rounded-lg border border-sand-300 bg-white px-2.5 py-1 text-xs font-medium text-ink-light hover:border-brand-400 hover:text-brand-700 transition-colors"
          >
            <Rows3 className="h-3.5 w-3.5" />
            + Fila
          </button>
          <button
            type="button"
            onClick={addColumn}
            className="inline-flex items-center gap-1 rounded-lg border border-sand-300 bg-white px-2.5 py-1 text-xs font-medium text-ink-light hover:border-brand-400 hover:text-brand-700 transition-colors"
          >
            <Columns3 className="h-3.5 w-3.5" />
            + Columna
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
            title="Quitar tabla de esta actividad"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Quitar
          </button>
        </div>
      </div>

      <input
        type="text"
        value={table.caption ?? ''}
        onChange={(e) => commit({ caption: e.target.value })}
        placeholder="Título o pie opcional de la tabla (admite LaTeX $...$)"
        className="w-full rounded-lg border border-sand-300 bg-white px-2.5 py-1.5 text-xs text-ink placeholder:text-ink-light/60 focus:border-brand-600 focus:outline-none"
      />

      <div className="overflow-x-auto rounded-lg border border-sand-300 bg-white">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-sand-100/90">
              {table.headers.map((header, colIdx) => (
                <th
                  key={colIdx}
                  className="border-b border-r border-sand-300 last:border-r-0 p-1.5 min-w-[125px] text-left font-semibold"
                >
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={header}
                      onChange={(e) => updateHeader(colIdx, e.target.value)}
                      onPaste={(e) => handlePasteGrid(e, 0, colIdx, true)}
                      placeholder={`Columna ${colIdx + 1}`}
                      className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-xs font-semibold text-ink focus:border-brand-500 focus:bg-white focus:outline-none"
                    />
                    {colCount > 1 && (
                      <button
                        type="button"
                        onClick={() => removeColumn(colIdx)}
                        title="Eliminar columna"
                        className="rounded p-1 text-ink-subtle hover:bg-red-50 hover:text-red-500 transition-colors shrink-0"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </th>
              ))}
              <th className="w-9 border-b border-sand-300 bg-sand-100/90" aria-label="Acciones de fila" />
            </tr>
          </thead>

          <tbody>
            {table.rows.map((row, rowIdx) => (
              <tr key={rowIdx} className="group border-b border-sand-200 last:border-b-0">
                {table.headers.map((_, colIdx) => {
                  const coord = cellCoordKey(rowIdx, colIdx);
                  const isEditable = editableSet.has(coord);
                  const val = row.cells[colIdx] ?? '';

                  return (
                    <td
                      key={colIdx}
                      className={`border-r border-sand-200 last:border-r-0 p-1.5 align-middle transition-colors ${
                        isEditable ? 'bg-brand-50/70' : 'bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={val}
                          onChange={(e) => updateCell(rowIdx, colIdx, e.target.value)}
                          onPaste={(e) => handlePasteGrid(e, rowIdx, colIdx, false)}
                          placeholder={
                            isEditable
                              ? isQuiz
                                ? 'Clave esperada (opc.)'
                                : 'Para completar'
                              : 'Texto o $LaTeX$'
                          }
                          className={`w-full rounded border px-2 py-1 text-xs focus:outline-none transition-colors ${
                            isEditable
                              ? 'border-brand-300 bg-white text-brand-900 placeholder:text-brand-500/70 focus:border-brand-600'
                              : 'border-sand-200 bg-sand-50/40 text-ink placeholder:text-ink-light/55 focus:border-brand-500 focus:bg-white'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => toggleEditableCell(rowIdx, colIdx)}
                          title={
                            isEditable
                              ? 'Celda editable por el alumno (click para dejar fija)'
                              : 'Marcar para que el alumno complete esta celda'
                          }
                          aria-pressed={isEditable}
                          className={`rounded p-1.5 transition-colors shrink-0 ${
                            isEditable
                              ? 'bg-brand-600 text-white shadow-sm hover:bg-brand-700'
                              : 'text-ink-subtle hover:bg-sand-100 hover:text-brand-600'
                          }`}
                        >
                          <PenLine className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  );
                })}

                <td className="p-1 text-center align-middle">
                  <button
                    type="button"
                    onClick={() => removeRow(rowIdx)}
                    disabled={table.rows.length <= 1}
                    title="Eliminar fila"
                    className="rounded p-1 text-ink-subtle hover:bg-red-50 hover:text-red-500 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-subtle">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-brand-600 text-white">
            <PenLine className="h-2.5 w-2.5" />
          </span>
          Marca las celdas que el alumno debe completar (si escribes un valor en ellas, se usará para autoevaluación).
        </span>
        <span className="font-mono text-[10px] opacity-80">Tip: puedes pegar tablas desde Excel / Sheets</span>
      </div>
    </div>
  );
}
