"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type CalendarWidgetState = "full" | "minimized" | "hidden";

interface DashboardPreferencesState {
  calendarWidgetState: CalendarWidgetState;
  setCalendarWidgetState: (state: CalendarWidgetState) => void;
}

export const useDashboardPreferencesStore = create<DashboardPreferencesState>()(
  persist(
    (set) => ({
      calendarWidgetState: "full",
      setCalendarWidgetState: (state) => set({ calendarWidgetState: state }),
    }),
    {
      name: "dashboard-preferences-storage",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
