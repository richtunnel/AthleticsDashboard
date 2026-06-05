import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ScheduleColumnType = "time" | "location";

interface ScheduleColumnState {
  overrides: Record<string, Record<ScheduleColumnType, string>>;
  setOverride: (workbookId: string, type: ScheduleColumnType, columnKey: string) => void;
  clearOverride: (workbookId: string, type: ScheduleColumnType) => void;
}

export const useScheduleColumnStore = create<ScheduleColumnState>()(
  persist(
    (set) => ({
      overrides: {},
      setOverride: (workbookId, type, columnKey) =>
        set((s) => ({
          overrides: {
            ...s.overrides,
            [workbookId]: { ...(s.overrides[workbookId] ?? {}), [type]: columnKey },
          },
        })),
      clearOverride: (workbookId, type) =>
        set((s) => {
          const wb = { ...(s.overrides[workbookId] ?? {}) };
          delete wb[type];
          return { overrides: { ...s.overrides, [workbookId]: wb } };
        }),
    }),
    { name: "schedule-column-overrides" }
  )
);
