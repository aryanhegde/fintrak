import { create } from "zustand";

type QuickAddState = {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
};

export const useQuickAdd = create<QuickAddState>((set) => ({
  isOpen: false,
  onOpen: () => set({ isOpen: true }),
  onClose: () => set({ isOpen: false }),
}));
