import { create } from "zustand";

interface AppState {
  /** Currently selected category filter on the marketplace */
  categoryFilter: string;
  setCategoryFilter: (c: string) => void;

  /** Minimum rating filter (0 = no filter) */
  ratingFilter: number;
  setRatingFilter: (r: number) => void;

  /** Search query */
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  /** Toast notifications */
  toasts: { id: string; message: string; type: "success" | "error" | "info" }[];
  addToast: (message: string, type?: "success" | "error" | "info") => void;
  removeToast: (id: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  categoryFilter: "all",
  setCategoryFilter: (c) => set({ categoryFilter: c }),

  ratingFilter: 0,
  setRatingFilter: (r) => set({ ratingFilter: r }),

  searchQuery: "",
  setSearchQuery: (q) => set({ searchQuery: q }),

  toasts: [],
  addToast: (message, type = "info") => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 5000);
  },
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
