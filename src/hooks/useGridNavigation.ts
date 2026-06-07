"use client";

/**
 * useGridNavigation
 *
 * Google-Sheets-style cell focus indicator for the GamesTable.
 *
 * Design constraints
 * ──────────────────
 * • Zero lag on arrow-key navigation: the focus indicator is driven entirely
 *   by direct DOM class manipulation — no React state is touched until the
 *   user actually opens a cell for editing.
 * • Desktop only: the hook is a no-op on touch devices.
 * • Decoupled from render: does NOT require data-attributes on every cell.
 *   Column identity is derived from `td.cellIndex` vs the `resolvedColumns`
 *   array; game identity from `data-game-id` on the parent `<tr>`.
 *
 * Lifecycle
 * ─────────
 * 1. User clicks a body <td>  → focus indicator moves to that cell.
 * 2. Arrow keys               → indicator moves imperatively (0 re-renders).
 * 3. Enter                    → calls onActivateCell(gameId, colId).
 * 4. Tab in inline-edit mode  → the inline-edit layer dispatches
 *                               "grid-nav-tab"; the hook moves the indicator
 *                               to the next cell.
 * 5. Escape / click outside   → indicator cleared.
 */

import { useCallback, useEffect, useRef } from "react";

export const GRID_FOCUS_CLASS = "gs-cell-focused";
export const GRID_NAV_TAB_EVENT = "grid-nav-tab";

interface UseGridNavigationOptions {
  /** Ref to the wrapping element that contains the <TableContainer>. */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Whether ANY inline edit is currently open (disables arrow navigation). */
  isEditingCell: boolean;
  /** Whether we're on mobile — hook is fully disabled on mobile. */
  isMobile: boolean;
  /** Whether the table is currently shown (not in worksheet/calendar view). */
  isTableVisible: boolean;
  /**
   * Ordered list of column IDs that match resolvedColumns.
   * Index 0 corresponds to td.cellIndex === 1 (cellIndex 0 is the checkbox).
   */
  columnIds: string[];
  /**
   * Called when the user presses Enter on a focused cell.
   * gameId  — value of data-game-id on the parent <tr>
   * colId   — column id from columnIds
   */
  onActivateCell: (gameId: string, colId: string) => void;
}

export function useGridNavigation({
  containerRef,
  isEditingCell,
  isMobile,
  isTableVisible,
  columnIds,
  onActivateCell,
}: UseGridNavigationOptions) {
  const focusedTdRef = useRef<HTMLTableCellElement | null>(null);

  // ── Internal helpers ───────────────────────────────────────────────────────

  const focusCell = useCallback((td: HTMLTableCellElement) => {
    if (focusedTdRef.current === td) return;
    focusedTdRef.current?.classList.remove(GRID_FOCUS_CLASS);
    focusedTdRef.current = td;
    td.classList.add(GRID_FOCUS_CLASS);
    // Keep cell visible when navigating with keyboard
    td.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, []);

  const clearFocus = useCallback(() => {
    focusedTdRef.current?.classList.remove(GRID_FOCUS_CLASS);
    focusedTdRef.current = null;
  }, []);

  const moveToNextCell = useCallback(
    (forward: boolean) => {
      const td = focusedTdRef.current;
      if (!td) return;
      const tr = td.closest("tr") as HTMLTableRowElement | null;
      if (!tr) return;
      const tbody = tr.parentElement as HTMLTableSectionElement | null;
      if (!tbody || tbody.tagName !== "TBODY") return;

      const colIdx = td.cellIndex;
      const rows = Array.from(tbody.rows) as HTMLTableRowElement[];
      const rowIdx = rows.indexOf(tr);

      // First/last data col indices (skip checkbox at 0 and actions at last)
      const firstDataCol = 1;
      const lastDataCol = tr.cells.length - 1;

      if (forward) {
        if (colIdx < lastDataCol) {
          focusCell(tr.cells[colIdx + 1] as HTMLTableCellElement);
        } else if (rowIdx + 1 < rows.length) {
          focusCell(rows[rowIdx + 1].cells[firstDataCol] as HTMLTableCellElement);
        }
      } else {
        if (colIdx > firstDataCol) {
          focusCell(tr.cells[colIdx - 1] as HTMLTableCellElement);
        } else if (rowIdx - 1 >= 0) {
          const prevRow = rows[rowIdx - 1];
          focusCell(prevRow.cells[prevRow.cells.length - 1] as HTMLTableCellElement);
        }
      }
    },
    [focusCell]
  );

  // ── Keyboard navigation (global, captures before React's synthetic events) ─

  useEffect(() => {
    if (isMobile || !isTableVisible) return;

    const onKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when focus is inside an input, textarea, select, or
      // any contenteditable — those belong to the inline edit system.
      const active = document.activeElement;
      if (
        active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.tagName === "SELECT" ||
          (active as HTMLElement).isContentEditable)
      ) {
        return;
      }

      const td = focusedTdRef.current;
      if (!td) return;

      const tr = td.closest("tr") as HTMLTableRowElement | null;
      if (!tr) return;
      const tbody = tr.parentElement as HTMLTableSectionElement | null;
      if (!tbody || tbody.tagName !== "TBODY") return;

      const colIdx = td.cellIndex;
      const rows = Array.from(tbody.rows) as HTMLTableRowElement[];
      const rowIdx = rows.indexOf(tr);

      switch (e.key) {
        case "ArrowRight": {
          e.preventDefault();
          const lastCol = tr.cells.length - 1;
          if (colIdx < lastCol) focusCell(tr.cells[colIdx + 1] as HTMLTableCellElement);
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          // Don't go into the checkbox (index 0)
          if (colIdx > 1) focusCell(tr.cells[colIdx - 1] as HTMLTableCellElement);
          break;
        }
        case "ArrowDown": {
          e.preventDefault();
          if (rowIdx + 1 < rows.length) {
            focusCell(rows[rowIdx + 1].cells[colIdx] as HTMLTableCellElement);
          }
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          if (rowIdx - 1 >= 0) {
            focusCell(rows[rowIdx - 1].cells[colIdx] as HTMLTableCellElement);
          }
          break;
        }
        case "Enter": {
          e.preventDefault();
          // Activate inline edit for this cell
          const gameId = tr.dataset.gameId;
          // colIdx 1 == columnIds[0], colIdx 2 == columnIds[1], …
          const colId = columnIds[colIdx - 1];
          if (gameId && colId) {
            onActivateCell(gameId, colId);
          }
          break;
        }
        case "Tab": {
          e.preventDefault();
          moveToNextCell(!e.shiftKey);
          break;
        }
        case "Escape": {
          e.preventDefault();
          clearFocus();
          break;
        }
      }
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [isMobile, isTableVisible, columnIds, onActivateCell, focusCell, clearFocus, moveToNextCell]);

  // ── grid-nav-tab: fired by the inline-edit layer on Tab keypress ──────────
  // This lets the inline edit save first, then the navigator moves the indicator.

  useEffect(() => {
    if (isMobile || !isTableVisible) return;

    const onNavTab = (e: Event) => {
      const forward = !(e as CustomEvent).detail?.shiftKey;
      moveToNextCell(forward);
    };

    document.addEventListener(GRID_NAV_TAB_EVENT, onNavTab);
    return () => document.removeEventListener(GRID_NAV_TAB_EVENT, onNavTab);
  }, [isMobile, isTableVisible, moveToNextCell]);

  // ── Click outside container → clear focus ──────────────────────────────────

  useEffect(() => {
    if (isMobile || !isTableVisible) return;

    const onDocMouseDown = (e: MouseEvent) => {
      const container = containerRef.current;
      if (container && !container.contains(e.target as Node)) {
        clearFocus();
      }
    };

    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [isMobile, isTableVisible, containerRef, clearFocus]);

  // ── Click on a table body cell ─────────────────────────────────────────────

  const handleBodyClick = useCallback(
    (e: React.MouseEvent) => {
      if (isMobile || !isTableVisible) return;
      const td = (e.target as HTMLElement).closest("td") as HTMLTableCellElement | null;
      if (!td) return;
      // Skip checkbox (cellIndex 0)
      if (td.cellIndex === 0) return;
      focusCell(td);
    },
    [isMobile, isTableVisible, focusCell]
  );

  return { handleBodyClick, clearFocus };
}
