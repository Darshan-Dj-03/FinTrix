import { create } from "zustand";

export const useUiStore = create((set) => ({
  sidebarOpen: true,
  search: "",
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSearch: (search) => set({ search }),
}));
