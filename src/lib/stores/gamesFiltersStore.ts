"use client";

import { create } from "zustand";
import { ColumnFilterValue, ColumnFilters } from "../../../types/filters";

interface GamesFiltersState {
  columnFilters: ColumnFilters;
  setColumnFilters: (filters: ColumnFilters) => void;
  updateFilter: (columnId: string, filter: ColumnFilterValue | null) => void;
  clearFilters: () => void;
}

export const useGamesFiltersStore = create<GamesFiltersState>((set) => ({
  columnFilters: {},
  setColumnFilters: (filters) => set({ columnFilters: filters }),
  updateFilter: (columnId, filter) =>
    set((state) => {
      const newFilters = { ...state.columnFilters };
      if (filter === null) {
        delete newFilters[columnId];
      } else {
        newFilters[columnId] = filter;
      }
      return { columnFilters: newFilters };
    }),
  clearFilters: () => set({ columnFilters: {} }),
}));
