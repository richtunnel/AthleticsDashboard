import { create } from "zustand";
import { persist } from "zustand/middleware";

interface GamesWorkbook {
  id: string;
  name: string;
  sortOrder: number;
  _count?: {
    games: number;
  };
}

interface GamesWorkbookState {
  workbooks: GamesWorkbook[];
  selectedWorkbookId: string | null;
  showWorkbookSelector: boolean;
  setWorkbooks: (workbooks: GamesWorkbook[]) => void;
  addWorkbook: (workbook: GamesWorkbook) => void;
  updateWorkbook: (id: string, name: string) => void;
  deleteWorkbook: (id: string) => void;
  setSelectedWorkbookId: (id: string | null) => void;
  setShowWorkbookSelector: (show: boolean) => void;
  getSelectedWorkbook: () => GamesWorkbook | null;
}

export const useGamesWorkbookStore = create<GamesWorkbookState>()(
  persist(
    (set, get) => ({
      workbooks: [],
      selectedWorkbookId: null,
      showWorkbookSelector: false,
      setWorkbooks: (workbooks) => set({ workbooks }),
      addWorkbook: (workbook) =>
        set((state) => ({
          workbooks: [...state.workbooks, workbook],
          selectedWorkbookId: workbook.id,
          showWorkbookSelector: false,
        })),
      updateWorkbook: (id, name) =>
        set((state) => ({
          workbooks: state.workbooks.map((wb) => (wb.id === id ? { ...wb, name } : wb)),
        })),
      deleteWorkbook: (id) =>
        set((state) => ({
          workbooks: state.workbooks.filter((wb) => wb.id !== id),
          selectedWorkbookId: state.selectedWorkbookId === id ? null : state.selectedWorkbookId,
        })),
      setSelectedWorkbookId: (id) => set({ selectedWorkbookId: id, showWorkbookSelector: false }),
      setShowWorkbookSelector: (show) => set({ showWorkbookSelector: show }),
      getSelectedWorkbook: () => {
        const state = get();
        return state.workbooks.find((wb) => wb.id === state.selectedWorkbookId) || null;
      },
    }),
    {
      name: "games-workbook-storage",
    }
  )
);
