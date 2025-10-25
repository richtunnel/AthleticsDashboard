"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface NavigationState {
  isLeftNavOpen: boolean;
  toggleLeftNav: () => void;
  setLeftNavOpen: (isOpen: boolean) => void;
}

export const useNavigationStore = create<NavigationState>()(
  persist(
    (set) => ({
      isLeftNavOpen: true,
      toggleLeftNav: () => set((state) => ({ isLeftNavOpen: !state.isLeftNavOpen })),
      setLeftNavOpen: (isOpen) => set({ isLeftNavOpen: isOpen }),
    }),
    {
      name: "navigation-storage",
    }
  )
);
