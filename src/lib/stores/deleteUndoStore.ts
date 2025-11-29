"use client";

import { create } from "zustand";
import { GameStatus } from "@prisma/client";

interface DeletedGame {
  date: string;
  time: string | null;
  homeTeamId: string;
  isHome: boolean;
  busTravel: boolean;
  actualDepartureTime: string | null;
  actualArrivalTime: string | null;
  opponentId: string | null;
  venueId: string | null;
  status: GameStatus;
  notes: string | null;
  location: string | null;
  customData: any;
  customFields?: Record<string, any>;
  sortOrder?: number;
}

interface DeleteUndoState {
  deletedGames: DeletedGame[];
  deleteTimestamp: number | null;
  autoHideTimeout: NodeJS.Timeout | null;

  setDeletedGames: (games: DeletedGame[]) => void;
  undoDelete: () => Promise<void>;
  clearDelete: () => void;
}

export const useDeleteUndoStore = create<DeleteUndoState>((set, get) => ({
  deletedGames: [],
  deleteTimestamp: null,
  autoHideTimeout: null,

  setDeletedGames: (games: DeletedGame[]) => {
    const state = get();
    
    // Clear any existing timeout
    if (state.autoHideTimeout) {
      clearTimeout(state.autoHideTimeout);
    }

    // Set up auto-hide (NOT auto-restore) after 30 seconds
    const timeout = setTimeout(() => {
      const currentState = get();
      if (currentState.deletedGames.length > 0) {
        // Just clear the undo button - DO NOT restore games
        currentState.clearDelete();
      }
    }, 30000);

    set({
      deletedGames: games,
      deleteTimestamp: Date.now(),
      autoHideTimeout: timeout,
    });
  },

  undoDelete: async () => {
    const state = get();
    const games = state.deletedGames;

    if (games.length === 0) return;

    // Clear timeout
    if (state.autoHideTimeout) {
      clearTimeout(state.autoHideTimeout);
    }

    try {
      // Restore all deleted games
      const response = await fetch("/api/games/bulk-restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ games }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to restore games");
      }
    } catch (error) {
      console.error("Failed to undo delete:", error);
      throw error; // Re-throw to show error notification
    } finally {
      // Clear state regardless of success/failure
      set({
        deletedGames: [],
        deleteTimestamp: null,
        autoHideTimeout: null,
      });
    }
  },

  clearDelete: () => {
    const state = get();
    if (state.autoHideTimeout) {
      clearTimeout(state.autoHideTimeout);
    }
    set({
      deletedGames: [],
      deleteTimestamp: null,
      autoHideTimeout: null,
    });
  },
}));
