import { apiClient } from "./client";

export const authApi = {
  login: async (payload) => {
    const { data } = await apiClient.post("/auth/login", payload);
    return data;
  },
  getMe: async () => {
    const { data } = await apiClient.get("/auth/me");
    return data;
  },
  changePassword: async (payload) => {
    const { data } = await apiClient.post("/auth/change-password", payload);
    return data;
  },
};
