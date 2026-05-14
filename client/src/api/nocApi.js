import { apiClient } from "./client";

export const nocApi = {
  list: async (params = {}) => {
    const { data } = await apiClient.get("/noc", { params });
    return data;
  },
  create: async (payload) => {
    const { data } = await apiClient.post("/noc", payload);
    return data;
  },
  update: async (id, payload) => {
    const { data } = await apiClient.put(`/noc/${id}`, payload);
    return data;
  },
  updatePaymentInfo: async (id, payload) => {
    const { data } = await apiClient.put(`/noc/${id}/payment-info`, payload);
    return data;
  },
  recordPayment: async (id, payload) => {
    const { data } = await apiClient.post(`/noc/${id}/record-payment`, payload);
    return data;
  },
};
