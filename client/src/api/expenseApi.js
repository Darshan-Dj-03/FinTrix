import { apiClient } from "./client";

export const expenseApi = {
  getSource: async (month, params = {}) => {
    const { data } = await apiClient.get(`/expense/source/${month}`, { params });
    return data;
  },
  listByMonth: async (month, params = {}) => {
    const { data } = await apiClient.get(`/expense/${month}`, { params });
    return data;
  },
  create: async (payload) => {
    const { data } = await apiClient.post("/expense/create", payload);
    return data;
  },
  update: async (id, payload) => {
    const { data } = await apiClient.patch(`/expense/${id}`, payload);
    return data;
  },
  submit: async (month, payload = {}) => {
    const { data } = await apiClient.put(`/expense/submit/${month}`, payload);
    return data;
  },
  approveByWarden: async (month, payload = {}) => {
    const { data } = await apiClient.put(`/expense/warden-approve/${month}`, payload);
    return data;
  },
  approveByDean: async (month, payload = {}) => {
    const { data } = await apiClient.put(`/expense/dean-approve/${month}`, payload);
    return data;
  },
  downloadPdf: async (month, params = {}) => {
    const { data } = await apiClient.get(`/expense/pdf/${month}`, {
      params,
      responseType: "blob",
    });
    return data;
  },
  remove: async (id) => {
    const { data } = await apiClient.delete(`/expense/${id}`);
    return data;
  },
};
