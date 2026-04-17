import { useCallback } from "react";

import { authApi } from "../api/authApi";
import { useAuthStore } from "../store/authStore";

export const useAuthBootstrap = () => {
  const token = useAuthStore((state) => state.token);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const logout = useAuthStore((state) => state.logout);
  const setHydrated = useAuthStore((state) => state.setHydrated);

  return useCallback(async () => {
    if (!token) {
      setHydrated();
      return;
    }

    try {
      const response = await authApi.getMe();
      updateProfile({
        user: response.data.user,
        studentProfile: response.data.studentProfile,
      });
    } catch {
      logout();
    }
  }, [logout, setHydrated, token, updateProfile]);
};
