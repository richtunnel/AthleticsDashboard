"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface NewGameData {
  date: string;
  time: string;
  sport: string;
  level: string;
  opponentId: string;
  isHome: boolean;
  busTravel: boolean;
  actualDepartureTime: string;
  actualArrivalTime: string;
  status: string;
  venueId: string;
  notes: string;
  homeTeamId?: string;
  customData?: { [key: string]: string };
}

interface GamesTableState {
  // Pagination
  page: number;
  rowsPerPage: number;
  setPage: (page: number) => void;
  setRowsPerPage: (rowsPerPage: number) => void;

  // Sorting
  sortField: string;
  sortOrder: "asc" | "desc";
  setSortField: (field: string) => void;
  setSortOrder: (order: "asc" | "desc") => void;

  // Adding new game
  isAddingNew: boolean;
  newGameData: NewGameData;
  setIsAddingNew: (isAdding: boolean) => void;
  setNewGameData: (data: NewGameData) => void;
  updateNewGameData: (partial: Partial<NewGameData>) => void;
  resetNewGameData: () => void;

  // Editing game
  editingGameId: string | null;
  editingCustomData: { [key: string]: string };
  setEditingGameId: (id: string | null) => void;
  setEditingCustomData: (data: { [key: string]: string }) => void;
  updateEditingCustomData: (columnId: string, value: string) => void;
  resetEditingState: () => void;

  // Selected games (stored as array for persistence, converted to Set in component)
  selectedGameIds: string[];
  setSelectedGameIds: (ids: string[]) => void;
  clearSelectedGameIds: () => void;

  // Reset all to defaults
  resetAll: () => void;
}

const getDefaultNewGameData = (): NewGameData => ({
  date: new Date().toISOString().split("T")[0],
  time: "",
  sport: "",
  level: "",
  opponentId: "",
  isHome: true,
  busTravel: false,
  actualDepartureTime: "",
  actualArrivalTime: "",
  status: "SCHEDULED",
  venueId: "",
  notes: "",
  customData: {},
});

export const useGamesTableStore = create<GamesTableState>()(
  persist(
    (set) => ({
      // Pagination
      page: 0,
      rowsPerPage: 25,
      setPage: (page) => set({ page }),
      setRowsPerPage: (rowsPerPage) => set({ rowsPerPage, page: 0 }),

      // Sorting
      sortField: "date",
      sortOrder: "asc",
      setSortField: (field) => set({ sortField: field }),
      setSortOrder: (order) => set({ sortOrder: order }),

      // Adding new game
      isAddingNew: false,
      newGameData: getDefaultNewGameData(),
      setIsAddingNew: (isAdding) => set({ isAddingNew: isAdding }),
      setNewGameData: (data) => set({ newGameData: data }),
      updateNewGameData: (partial) =>
        set((state) => ({
          newGameData: { ...state.newGameData, ...partial },
        })),
      resetNewGameData: () =>
        set({
          newGameData: getDefaultNewGameData(),
          isAddingNew: false,
        }),

      // Editing game
      editingGameId: null,
      editingCustomData: {},
      setEditingGameId: (id) => set({ editingGameId: id }),
      setEditingCustomData: (data) => set({ editingCustomData: data }),
      updateEditingCustomData: (columnId, value) =>
        set((state) => ({
          editingCustomData: { ...state.editingCustomData, [columnId]: value },
        })),
      resetEditingState: () =>
        set({
          editingGameId: null,
          editingCustomData: {},
        }),

      // Selected games
      selectedGameIds: [],
      setSelectedGameIds: (ids) => set({ selectedGameIds: ids }),
      clearSelectedGameIds: () => set({ selectedGameIds: [] }),

      // Reset all
      resetAll: () =>
        set({
          page: 0,
          rowsPerPage: 25,
          sortField: "date",
          sortOrder: "asc",
          isAddingNew: false,
          newGameData: getDefaultNewGameData(),
          editingGameId: null,
          editingCustomData: {},
          selectedGameIds: [],
        }),
    }),
    {
      name: "games-table-storage",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
