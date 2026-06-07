"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type SortItem = { field: string; order: "asc" | "desc" };

interface NewGameData {
  date: string;
  time: string;
  sport: string;
  level: string;
  opponentId: string;
  opponent?: string;
  isHome: boolean;
  busTravel: boolean;
  actualDepartureTime: string;
  actualArrivalTime: string;
  status: string;
  venueId: string;
  notes: string;
  location: string;
  homeTeamId?: string;
  customData?: { [key: string]: string };
  customFields?: { [key: string]: string };
}

interface GamesTableState {
  // Pagination
  page: number;
  rowsPerPage: number;
  setPage: (page: number) => void;
  setRowsPerPage: (rowsPerPage: number) => void;

  isCustomStructureActive: boolean;
  setIsCustomStructureActive: (isActive: boolean) => void;

  // Sorting — ordered list of {field, order}; first entry is primary sort
  sortFields: SortItem[];
  setSortFields: (fields: SortItem[]) => void;

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
  location: "",
  customData: {},
  customFields: {},
});

export const useGamesTableStore = create<GamesTableState>()(
  persist(
    (set) => ({
      isCustomStructureActive: false,
      // Pagination
      page: 0,
      rowsPerPage: 25,
      setPage: (page) => set({ page }),
      setRowsPerPage: (rowsPerPage) => set({ rowsPerPage, page: 0 }),

      setIsCustomStructureActive: (isActive) => set({ isCustomStructureActive: isActive }),

      // Sorting — default primary sort is date asc
      sortFields: [{ field: "date", order: "asc" as const }],
      setSortFields: (fields) => set({ sortFields: fields }),

      // Adding new game
      isAddingNew: false,
      newGameData: getDefaultNewGameData(),
      setIsAddingNew: (isAdding) => set({ isAddingNew: isAdding }),
      setNewGameData: (data) => set({ newGameData: data }),
      updateNewGameData: (partial) =>
        set((state) => ({
          newGameData: {
            ...state.newGameData,
            ...partial,
            // Deep merge for customData and customFields to preserve existing values
            customData: partial.customData
              ? { ...(state.newGameData.customData || {}), ...partial.customData }
              : state.newGameData.customData,
            customFields: partial.customFields
              ? { ...(state.newGameData.customFields || {}), ...partial.customFields }
              : state.newGameData.customFields,
          },
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
          sortFields: [{ field: "date", order: "asc" as const }],
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
      version: 2,
      migrate: (persistedState: any, version) => {
        if (version < 2) {
          // Migrate single sortField/sortOrder → sortFields array
          const field = persistedState.sortField ?? "date";
          const order: "asc" | "desc" = persistedState.sortOrder === "desc" ? "desc" : "asc";
          persistedState.sortFields = field ? [{ field, order }] : [{ field: "date", order: "asc" }];
          delete persistedState.sortField;
          delete persistedState.sortOrder;
        }
        return persistedState as any;
      },
    }
  )
);
