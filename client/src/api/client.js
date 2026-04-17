import axios from "axios";

import { API_BASE_URL } from "../utils/constants";
import { useAuthStore } from "../store/authStore";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const requestUrl = error?.config?.url || "";
    const token = useAuthStore.getState().token;
    const isLoginRequest = requestUrl.includes("/auth/login");

    if (status === 401 && token && !isLoginRequest) {
      useAuthStore.getState().logout();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);
