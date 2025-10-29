import { useState, useEffect, useCallback, useRef } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";

export interface CellSelection {
  rowId: string;
  columnId: string;
}

export interface SelectionRange {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

interface UseTableCopyPasteProps<T> {
  data: T[];
  columns: Array<{
    id: string;
    getValue: (row: T) => string | number | null | undefined;
    setValue?: (row: T, value: string) => Partial<T>;
  }>;
  onUpdate?: (rowId: string, updates: Partial<T>) => void | Promise<void>;
  getRowId: (row: T) => string;
  enabled?: boolean;
}

export function useTableCopyPaste<T>({
  data,
  columns,
  onUpdate,
  getRowId,
  enabled = true,
}: UseTableCopyPasteProps<T>) {
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [selectionRange, setSelectionRange] = useState<SelectionRange | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ rowIndex: number; colIndex: number } | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);

  const getCellKey = useCallback((rowId: string, columnId: string) => {
    return `${rowId}:${columnId}`;
  }, []);

  const isCellSelected = useCallback(
    (rowId: string, columnId: string) => {
      return selectedCells.has(getCellKey(rowId, columnId));
    },
    [selectedCells, getCellKey]
  );

  const handleCellClick = useCallback(
    (rowId: string, columnId: string, rowIndex: number, colIndex: number, event: ReactMouseEvent<HTMLElement>) => {
      if (!enabled) return;

      if (event.shiftKey && dragStart) {
        const startRow = Math.min(dragStart.rowIndex, rowIndex);
        const endRow = Math.max(dragStart.rowIndex, rowIndex);
        const startCol = Math.min(dragStart.colIndex, colIndex);
        const endCol = Math.max(dragStart.colIndex, colIndex);

        const newSelection = new Set<string>();
        for (let r = startRow; r <= endRow; r++) {
          for (let c = startCol; c <= endCol; c++) {
            const row = data[r];
            const col = columns[c];
            if (row && col) {
              newSelection.add(getCellKey(getRowId(row), col.id));
            }
          }
        }
        setSelectedCells(newSelection);
        setSelectionRange({ startRow, endRow, startCol, endCol });
      } else if (event.ctrlKey || event.metaKey) {
        const cellKey = getCellKey(rowId, columnId);
        const newSelection = new Set(selectedCells);
        if (newSelection.has(cellKey)) {
          newSelection.delete(cellKey);
        } else {
          newSelection.add(cellKey);
        }
        setSelectedCells(newSelection);
        setSelectionRange(null);
      } else {
        const cellKey = getCellKey(rowId, columnId);
        setSelectedCells(new Set([cellKey]));
        setSelectionRange({ startRow: rowIndex, endRow: rowIndex, startCol: colIndex, endCol: colIndex });
      }

      setDragStart({ rowIndex, colIndex });
    },
    [enabled, dragStart, data, columns, getRowId, selectedCells, getCellKey]
  );

  const handleCellMouseDown = useCallback(
    (rowId: string, columnId: string, rowIndex: number, colIndex: number, event: ReactMouseEvent<HTMLElement>) => {
      if (!enabled) return;

      setIsDragging(true);
      setDragStart({ rowIndex, colIndex });

      if (event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }

      const row = data[rowIndex];
      if (!row) return;

      const cellKey = getCellKey(getRowId(row), columnId);
      setSelectedCells(new Set([cellKey]));
      setSelectionRange({ startRow: rowIndex, endRow: rowIndex, startCol: colIndex, endCol: colIndex });
    },
    [enabled, data, getRowId, getCellKey]
  );

  const handleCellMouseEnter = useCallback(
    (rowId: string, columnId: string, rowIndex: number, colIndex: number) => {
      if (!enabled || !isDragging || !dragStart) return;

      const startRow = Math.min(dragStart.rowIndex, rowIndex);
      const endRow = Math.max(dragStart.rowIndex, rowIndex);
      const startCol = Math.min(dragStart.colIndex, colIndex);
      const endCol = Math.max(dragStart.colIndex, colIndex);

      const newSelection = new Set<string>();
      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          const row = data[r];
          const col = columns[c];
          if (row && col) {
            newSelection.add(getCellKey(getRowId(row), col.id));
          }
        }
      }
      setSelectedCells(newSelection);
      setSelectionRange({ startRow, endRow, startCol, endCol });
    },
    [enabled, isDragging, dragStart, data, columns, getRowId, getCellKey]
  );

  const handleCellMouseUp = useCallback(() => {
    if (!enabled) return;
    setIsDragging(false);
  }, [enabled]);

  const copySelectedCells = useCallback(() => {
    if (!enabled || selectedCells.size === 0) return;
    if (typeof navigator === "undefined" || !navigator.clipboard) return;

    const cellsMap = new Map<string, string>();
    selectedCells.forEach((cellKey) => {
      const [rowId, columnId] = cellKey.split(":");
      const row = data.find((r) => getRowId(r) === rowId);
      const column = columns.find((c) => c.id === columnId);
      if (row && column) {
        const value = column.getValue(row);
        cellsMap.set(cellKey, value?.toString() ?? "");
      }
    });

    if (selectionRange) {
      const { startRow, endRow, startCol, endCol } = selectionRange;
      const rows: string[][] = [];

      for (let r = startRow; r <= endRow; r++) {
        const row = data[r];
        if (!row) continue;
        const rowValues: string[] = [];

        for (let c = startCol; c <= endCol; c++) {
          const col = columns[c];
          if (!col) continue;
          const value = col.getValue(row);
          rowValues.push(value?.toString() ?? "");
        }
        rows.push(rowValues);
      }

      const tsvData = rows.map((row) => row.join("\t")).join("\n");
      navigator.clipboard.writeText(tsvData).catch(() => {
        /* noop */
      });
    } else {
      const values = Array.from(cellsMap.values());
      navigator.clipboard.writeText(values.join("\n")).catch(() => {
        /* noop */
      });
    }
  }, [enabled, selectedCells, selectionRange, data, columns, getRowId]);

  const pasteToSelectedCells = useCallback(
    async (clipboardText: string) => {
      if (!enabled || !onUpdate || selectedCells.size === 0) return;

      const lines = clipboardText.split("\n").filter((line) => line.length > 0);
      if (lines.length === 0) return;

      const rows = lines.map((line) => line.split("\t"));

      if (selectionRange) {
        const { startRow, startCol } = selectionRange;
        const updates: Array<{ rowId: string; updates: Partial<T> }> = [];

        rows.forEach((rowValues, rowOffset) => {
          const dataRowIndex = startRow + rowOffset;
          const row = data[dataRowIndex];
          if (!row) return;

          const rowId = getRowId(row);
          const rowUpdates: any = {};

          rowValues.forEach((value, colOffset) => {
            const colIndex = startCol + colOffset;
            const column = columns[colIndex];
            if (!column || !column.setValue) return;

            const updates = column.setValue(row, value);
            Object.assign(rowUpdates, updates);
          });

          if (Object.keys(rowUpdates).length > 0) {
            updates.push({ rowId, updates: rowUpdates });
          }
        });

        for (const { rowId, updates: rowUpdates } of updates) {
          await onUpdate(rowId, rowUpdates);
        }
      } else {
        const sortedCells = Array.from(selectedCells).sort();
        for (let i = 0; i < Math.min(sortedCells.length, rows.length); i++) {
          const cellKey = sortedCells[i];
          const [rowId, columnId] = cellKey.split(":");
          const row = data.find((r) => getRowId(r) === rowId);
          const column = columns.find((c) => c.id === columnId);

          if (row && column && column.setValue && rows[i][0]) {
            const updates = column.setValue(row, rows[i][0]);
            if (Object.keys(updates).length > 0) {
              await onUpdate(rowId, updates);
            }
          }
        }
      }

      setSelectedCells(new Set());
      setSelectionRange(null);
    },
    [enabled, onUpdate, selectedCells, selectionRange, data, columns, getRowId]
  );

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "c") {
        if (selectedCells.size > 0) {
          event.preventDefault();
          copySelectedCells();
        }
      }

      if ((event.ctrlKey || event.metaKey) && event.key === "v" && onUpdate) {
        if (selectedCells.size > 0) {
          event.preventDefault();
          if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
            navigator.clipboard
              .readText()
              .then((text) => {
                pasteToSelectedCells(text);
              })
              .catch(() => {
                /* noop */
              });
          }
        }
      }

      if (event.key === "Escape") {
        setSelectedCells(new Set());
        setSelectionRange(null);
        setIsDragging(false);
        setDragStart(null);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [enabled, selectedCells, copySelectedCells, pasteToSelectedCells, onUpdate]);

  const clearSelection = useCallback(() => {
    setSelectedCells(new Set());
    setSelectionRange(null);
    setDragStart(null);
  }, []);

  return {
    selectedCells,
    isCellSelected,
    handleCellClick,
    handleCellMouseDown,
    handleCellMouseEnter,
    handleCellMouseUp,
    copySelectedCells,
    pasteToSelectedCells,
    clearSelection,
    containerRef,
    hasSelection: selectedCells.size > 0,
  };
}
