import { apiClient } from "./client";

export const advanceApi = {
  list: async (month, params = {}) => {
    const { data } = await apiClient.get(`/advances/month/${month}`, { params });
    return data;
  },
  create: async (payload) => {
    const { data } = await apiClient.post("/advances/add", payload);
    return data;
  },
  update: async (advanceId, payload) => {
    const { data } = await apiClient.put(`/advances/update/${advanceId}`, payload);
    return data;
  },
  remove: async (advanceId) => {
    const { data } = await apiClient.delete(`/advances/${advanceId}`);
    return data;
  },
};
