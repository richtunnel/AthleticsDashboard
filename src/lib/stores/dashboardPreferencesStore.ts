"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type CalendarWidgetState = "full" | "minimized" | "hidden";

interface DashboardPreferencesState {
  calendarWidgetState: CalendarWidgetState;
  setCalendarWidgetState: (state: CalendarWidgetState) => void;
  gamesViewMode: "table" | "schedule";
  setGamesViewMode: (mode: "table" | "schedule") => void;
}

export const useDashboardPreferencesStore = create<DashboardPreferencesState>()(
  persist(
    (set) => ({
      calendarWidgetState: "full",
      setCalendarWidgetState: (state) => set({ calendarWidgetState: state }),
      gamesViewMode: "table",
      setGamesViewMode: (mode) => set({ gamesViewMode: mode }),
    }),
    {
      name: "dashboard-preferences-storage",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
