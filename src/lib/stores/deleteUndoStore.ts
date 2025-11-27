"use client";

import { create } from "zustand";

type DeleteType = "rows" | "columns";

interface DeletedColumn {
  id: string;
  name: string;
  type: "TEXT" | "TIME" | "DROPDOWN" | "DATETIME";
  organizationId: string;
  createdAt: string;
  // Backup of all game data that had this column
  gameDataBackup: Array<{
    gameId: string;
    data: any;
  }>;
}

interface DeletedRow {
  id: string;
  data: any; // Full game data for restoration
}

interface DeleteUndoState {
  // Column deletion state
  deletedColumns: DeletedColumn[];
  columnDeleteTimestamp: number | null;
  columnAutoHideTimeout: NodeJS.Timeout | null;

  // Row deletion state
  deletedRows: DeletedRow[];
  rowDeleteTimestamp: number | null;
  rowAutoHideTimeout: NodeJS.Timeout | null;

  // Actions for columns
  setDeletedColumns: (columns: DeletedColumn[]) => void;
  undoColumnDelete: () => Promise<void>;
  clearColumnDelete: () => void;

  // Actions for rows
  setDeletedRows: (rows: DeletedRow[]) => void;
  undoRowDelete: () => Promise<void>;
  clearRowDelete: () => void;

  // Check if undo is available
  hasActiveUndo: () => boolean;
}

export const useDeleteUndoStore = create<DeleteUndoState>((set, get) => ({
  // Column state
  deletedColumns: [],
  columnDeleteTimestamp: null,
  columnAutoHideTimeout: null,

  // Row state
  deletedRows: [],
  rowDeleteTimestamp: null,
  rowAutoHideTimeout: null,

  setDeletedColumns: (columns: DeletedColumn[]) => {
    const state = get();

    // Clear any existing timeout
    if (state.columnAutoHideTimeout) {
      clearTimeout(state.columnAutoHideTimeout);
    }

    // Set up auto-hide after 30 seconds
    const timeout = setTimeout(() => {
      const currentState = get();
      if (currentState.deletedColumns.length > 0) {
        currentState.clearColumnDelete();
      }
    }, 30000);

    set({
      deletedColumns: columns,
      columnDeleteTimestamp: Date.now(),
      columnAutoHideTimeout: timeout,
    });
  },

  undoColumnDelete: async () => {
    const state = get();
    const columns = state.deletedColumns;

    if (columns.length === 0) return;

    // Clear timeout
    if (state.columnAutoHideTimeout) {
      clearTimeout(state.columnAutoHideTimeout);
    }

    try {
      // Restore columns by calling the restore API endpoint
      await fetch("/api/organizations/custom-columns/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columns }),
      });
    } catch (error) {
      console.error("Failed to undo column deletion:", error);
      throw error;
    } finally {
      // Clear state
      set({
        deletedColumns: [],
        columnDeleteTimestamp: null,
        columnAutoHideTimeout: null,
      });
    }
  },

  clearColumnDelete: () => {
    const state = get();
    if (state.columnAutoHideTimeout) {
      clearTimeout(state.columnAutoHideTimeout);
    }
    set({
      deletedColumns: [],
      columnDeleteTimestamp: null,
      columnAutoHideTimeout: null,
    });
  },

  setDeletedRows: (rows: DeletedRow[]) => {
    const state = get();

    // Clear any existing timeout
    if (state.rowAutoHideTimeout) {
      clearTimeout(state.rowAutoHideTimeout);
    }

    // Set up auto-hide after 30 seconds
    const timeout = setTimeout(() => {
      const currentState = get();
      if (currentState.deletedRows.length > 0) {
        currentState.clearRowDelete();
      }
    }, 30000);

    set({
      deletedRows: rows,
      rowDeleteTimestamp: Date.now(),
      rowAutoHideTimeout: timeout,
    });
  },

  undoRowDelete: async () => {
    const state = get();
    const rows = state.deletedRows;

    if (rows.length === 0) return;

    // Clear timeout
    if (state.rowAutoHideTimeout) {
      clearTimeout(state.rowAutoHideTimeout);
    }

    try {
      // Restore rows by calling the restore API endpoint
      await fetch("/api/games/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ games: rows }),
      });
    } catch (error) {
      console.error("Failed to undo row deletion:", error);
      throw error;
    } finally {
      // Clear state
      set({
        deletedRows: [],
        rowDeleteTimestamp: null,
        rowAutoHideTimeout: null,
      });
    }
  },

  clearRowDelete: () => {
    const state = get();
    if (state.rowAutoHideTimeout) {
      clearTimeout(state.rowAutoHideTimeout);
    }
    set({
      deletedRows: [],
      rowDeleteTimestamp: null,
      rowAutoHideTimeout: null,
    });
  },

  hasActiveUndo: () => {
    const state = get();
    return state.deletedColumns.length > 0 || state.deletedRows.length > 0;
  },
}));
