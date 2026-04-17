import { apiClient } from "./client";

export const ledgerApi = {
  list: async (month, params = {}) => {
    const { data } = await apiClient.get(`/ledger/${month}`, { params });
    return data;
  },
  create: async (month, payload) => {
    const { data } = await apiClient.post(`/ledger/create/${month}`, payload);
    return data;
  },
};
