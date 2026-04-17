import { apiClient } from "./client";

export const guestChargeApi = {
  list: async (month, params = {}) => {
    const { data } = await apiClient.get(`/guest-charge/month/${month}`, { params });
    return data;
  },
  create: async (payload) => {
    const { data } = await apiClient.post("/guest-charge/add", payload);
    return data;
  },
  update: async (guestChargeId, payload) => {
    const { data } = await apiClient.put(`/guest-charge/update/${guestChargeId}`, payload);
    return data;
  },
  remove: async (guestChargeId) => {
    const { data } = await apiClient.delete(`/guest-charge/${guestChargeId}`);
    return data;
  },
};
