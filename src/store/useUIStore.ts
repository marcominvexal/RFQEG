import { create } from "zustand";

interface UIState {
  selectedRfqId: string | null;
  openRfq: (id: string) => void;
  closeRfq: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedRfqId: null,
  openRfq: (id) => set({ selectedRfqId: id }),
  closeRfq: () => set({ selectedRfqId: null }),
}));
