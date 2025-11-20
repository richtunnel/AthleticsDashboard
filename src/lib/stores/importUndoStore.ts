"use client";

import { create } from "zustand";

interface ImportedGame {
  id: string;
  date: Date | string;
  time?: string | null;
  sport?: string | null;
  level?: string | null;
  opponent?: string | null;
  isHome: boolean;
  location?: string | null;
  status: string;
  [key: string]: any;
}

interface ImportUndoState {
  // Store imported game IDs for undo functionality
  importedGameIds: string[];
  importedGames: ImportedGame[];
  importTimestamp: number | null;
  showUndoButton: boolean;
  isUndoing: boolean;

  // Actions
  setImportedGames: (games: ImportedGame[]) => void;
  undoImport: () => void;
  clearUndo: () => void;
  hideUndoButton: () => void;
}

export const useImportUndoStore = create<ImportUndoState>((set) => ({
  importedGameIds: [],
  importedGames: [],
  importTimestamp: null,
  showUndoButton: false,
  isUndoing: false,

  setImportedGames: (games: ImportedGame[]) => {
    const gameIds = games.map((g) => g.id);
    set({
      importedGameIds: gameIds,
      importedGames: games,
      importTimestamp: Date.now(),
      showUndoButton: true,
      isUndoing: false,
    });

    // Auto-hide after 30 seconds
    setTimeout(() => {
      set((state) => {
        // Only clear if the timestamp matches (prevents clearing newer imports)
        const currentTime = Date.now();
        if (state.importTimestamp && currentTime - state.importTimestamp >= 30000) {
          return {
            importedGameIds: [],
            importedGames: [],
            importTimestamp: null,
            showUndoButton: false,
            isUndoing: false,
          };
        }
        return state;
      });
    }, 30000);
  },

  undoImport: () => {
    set({ isUndoing: true });
    // The actual undo logic will be handled in the component
    // by filtering out the imported games from the display
    setTimeout(() => {
      set({
        importedGameIds: [],
        importedGames: [],
        importTimestamp: null,
        showUndoButton: false,
        isUndoing: false,
      });
    }, 500); // Small delay for smooth transition
  },

  clearUndo: () => {
    set({
      importedGameIds: [],
      importedGames: [],
      importTimestamp: null,
      showUndoButton: false,
      isUndoing: false,
    });
  },

  hideUndoButton: () => {
    set({ showUndoButton: false });
  },
}));
