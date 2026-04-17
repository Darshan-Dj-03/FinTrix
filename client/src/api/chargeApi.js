import { apiClient } from "./client";

export const chargeApi = {
  list: async (month, params = {}) => {
    const { data } = await apiClient.get(`/charges/${month}`, { params });
    return data;
  },
  create: async (payload) => {
    const { data } = await apiClient.post("/charges/add", payload);
    return data;
  },
  update: async (chargeId, payload) => {
    const { data } = await apiClient.patch(`/charges/${chargeId}`, payload);
    return data;
  },
  remove: async (chargeId) => {
    const { data } = await apiClient.delete(`/charges/${chargeId}`);
    return data;
  },
};
