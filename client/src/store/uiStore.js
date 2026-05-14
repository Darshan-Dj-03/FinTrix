import { create } from "zustand";

export const useUiStore = create((set) => ({
  mobileSidebarOpen: false,
  desktopSidebarExpanded: true,
  search: "",
  setMobileSidebarOpen: (mobileSidebarOpen) => set({ mobileSidebarOpen }),
  toggleMobileSidebar: () => set((state) => ({ mobileSidebarOpen: !state.mobileSidebarOpen })),
  closeMobileSidebar: () => set({ mobileSidebarOpen: false }),
  setDesktopSidebarExpanded: (desktopSidebarExpanded) => set({ desktopSidebarExpanded }),
  toggleDesktopSidebar: () =>
    set((state) => ({ desktopSidebarExpanded: !state.desktopSidebarExpanded })),
  setSearch: (search) => set({ search }),
}));
