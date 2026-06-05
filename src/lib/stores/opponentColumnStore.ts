import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Stores a per-workbook mapping of which customFields key should be used as
 * the opponent / away-team display value when game.opponent is null.
 * Persisted to localStorage so the choice survives page refreshes.
 */

interface OpponentColumnState {
  /** workbookId → customFields key name */
  overrides: Record<string, string>;
  setOverride: (workbookId: string, columnKey: string) => void;
  clearOverride: (workbookId: string) => void;

  /** per-workbook list of discovered custom column names */
  columnRegistry: Record<string, string[]>;
  setColumnRegistry: (workbookId: string, columns: string[]) => void;
}

export const useOpponentColumnStore = create<OpponentColumnState>()(
  persist(
    (set) => ({
      overrides: {},
      setOverride: (workbookId, columnKey) =>
        set((s) => ({ overrides: { ...s.overrides, [workbookId]: columnKey } })),
      clearOverride: (workbookId) =>
        set((s) => {
          const { [workbookId]: _, ...rest } = s.overrides;
          return { overrides: rest };
        }),
      columnRegistry: {},
      setColumnRegistry: (workbookId, columns) =>
        set((s) => ({ columnRegistry: { ...s.columnRegistry, [workbookId]: columns } })),
    }),
    { name: "opponent-column-overrides" }
  )
);
