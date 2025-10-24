// src/stores/opponentsStore.ts
import { create } from "zustand";

interface Opponent {
  id: string;
  name: string;
  mascot?: string;
  colors?: string;
  contact?: string;
  phone?: string;
  email?: string;
  notes?: string;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

interface OpponentsStore {
  opponents: Opponent[];
  isLoading: boolean;
  isDragging: boolean;
  isCreating: boolean;

  // Actions
  setOpponents: (opponents: Opponent[]) => void;
  setLoading: (loading: boolean) => void;
  setDragging: (dragging: boolean) => void;
  setCreating: (creating: boolean) => void;
  addOpponent: (opponent: Opponent) => void;
  updateOpponent: (id: string, updates: Partial<Opponent>) => void;
  deleteOpponent: (id: string) => void;
  reorderOpponents: (newOrder: Opponent[]) => void;
}

export const useOpponentsStore = create<OpponentsStore>((set) => ({
  opponents: [],
  isLoading: false,
  isDragging: false,
  isCreating: false,

  setOpponents: (opponents) => set({ opponents }),
  setLoading: (loading) => set({ isLoading: loading }),
  setDragging: (dragging) => set({ isDragging: dragging }),
  setCreating: (creating) => set({ isCreating: creating }),

  addOpponent: (opponent) =>
    set((state) => ({
      opponents: [opponent, ...state.opponents],
    })),

  updateOpponent: (id, updates) =>
    set((state) => ({
      opponents: state.opponents.map((opp) => (opp.id === id ? { ...opp, ...updates } : opp)),
    })),

  deleteOpponent: (id) =>
    set((state) => ({
      opponents: state.opponents.filter((opp) => opp.id !== id),
    })),

  reorderOpponents: (newOrder) =>
    set(() => ({
      opponents: newOrder.map((opp, index) => ({
        ...opp,
        sortOrder: index + 1,
      })),
    })),
}));
