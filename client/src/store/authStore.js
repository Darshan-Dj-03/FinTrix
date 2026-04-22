import { create } from "zustand";

const AUTH_STORAGE_KEY = "fintrix-auth";

const readStoredAuth = () => {
  try {
    const value = localStorage.getItem(AUTH_STORAGE_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

const persistAuth = (state) => {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state));
};

const clearAuth = () => {
  localStorage.removeItem(AUTH_STORAGE_KEY);
};

export const useAuthStore = create((set, get) => ({
  token: readStoredAuth()?.token || null,
  refreshToken: readStoredAuth()?.refreshToken || null,
  user: readStoredAuth()?.user || null,
  studentProfile: readStoredAuth()?.studentProfile || null,
  hydrated: false,
  setSession: ({ token, refreshToken = null, user, studentProfile = null }) => {
    const payload = { token, refreshToken, user, studentProfile };
    persistAuth(payload);
    set({ ...payload, hydrated: true });
  },
  updateProfile: ({ user, studentProfile }) => {
    const nextState = {
      token: get().token,
      refreshToken: get().refreshToken,
      user: user ?? get().user,
      studentProfile: studentProfile ?? get().studentProfile,
    };
    persistAuth(nextState);
    set({ ...nextState, hydrated: true });
  },
  logout: () => {
    clearAuth();
    set({ token: null, refreshToken: null, user: null, studentProfile: null, hydrated: true });
  },
  setHydrated: () => set({ hydrated: true }),
}));
