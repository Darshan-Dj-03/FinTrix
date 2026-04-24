import { apiClient } from "./client";

export const authApi = {
  login: async (payload) => {
    const { data } = await apiClient.post("/auth/login", payload);
    return data;
  },
  signupStudent: async (payload) => {
    const { data } = await apiClient.post("/auth/signup/student", payload);
    return data;
  },
  requestPasswordResetOtp: async (payload) => {
    const { data } = await apiClient.post("/auth/forgot-password/request", payload);
    return data;
  },
  resetPasswordWithOtp: async (payload) => {
    const { data } = await apiClient.post("/auth/forgot-password/reset", payload);
    return data;
  },
  refresh: async (payload) => {
    const { data } = await apiClient.post("/auth/refresh", payload);
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
  requestProfilePasswordOtp: async () => {
    const { data } = await apiClient.post("/auth/profile/change-password/request-otp");
    return data;
  },
  changePasswordWithOtp: async (payload) => {
    const { data } = await apiClient.post("/auth/profile/change-password/verify-otp", payload);
    return data;
  },
  updateProfile: async (payload) => {
    const { data } = await apiClient.put("/auth/profile", payload);
    return data;
  },
};
