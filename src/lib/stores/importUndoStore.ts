"use client";

import { create } from "zustand";

interface ImportUndoState {
  importedGameIds: string[];
  importTimestamp: number | null;
  autoHideTimeout: NodeJS.Timeout | null;

  setImportedGames: (gameIds: string[]) => void;
  undoImport: () => Promise<void>;
  clearImport: () => void;
}

export const useImportUndoStore = create<ImportUndoState>((set, get) => ({
  importedGameIds: [],
  importTimestamp: null,
  autoHideTimeout: null,

  setImportedGames: (gameIds: string[]) => {
    const state = get();
    
    // Clear any existing timeout
    if (state.autoHideTimeout) {
      clearTimeout(state.autoHideTimeout);
    }

    // Set up new auto-delete after 30 seconds
    const timeout = setTimeout(async () => {
      const currentState = get();
      if (currentState.importedGameIds.length > 0) {
        // Auto-delete games after 30 seconds
        await currentState.undoImport();
      }
    }, 30000);

    set({
      importedGameIds: gameIds,
      importTimestamp: Date.now(),
      autoHideTimeout: timeout,
    });
  },

  undoImport: async () => {
    const state = get();
    const gameIds = state.importedGameIds;

    if (gameIds.length === 0) return;

    // Clear timeout
    if (state.autoHideTimeout) {
      clearTimeout(state.autoHideTimeout);
    }

    try {
      // Delete all imported games
      await Promise.all(
        gameIds.map((id) =>
          fetch(`/api/games/${id}`, {
            method: "DELETE",
          })
        )
      );
    } catch (error) {
      console.error("Failed to undo import:", error);
    } finally {
      // Clear state regardless of success/failure
      set({
        importedGameIds: [],
        importTimestamp: null,
        autoHideTimeout: null,
      });
    }
  },

  clearImport: () => {
    const state = get();
    if (state.autoHideTimeout) {
      clearTimeout(state.autoHideTimeout);
    }
    set({
      importedGameIds: [],
      importTimestamp: null,
      autoHideTimeout: null,
    });
  },
}));
