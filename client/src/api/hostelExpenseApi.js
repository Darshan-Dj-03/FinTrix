import { apiClient } from "./client";

export const hostelExpenseApi = {
  listByMonth: async (month, params = {}) => {
    const { data } = await apiClient.get(`/hostel-expense/${month}`, { params });
    return data;
  },
  create: async (payload) => {
    const { data } = await apiClient.post("/hostel-expense/create", payload);
    return data;
  },
  update: async (id, payload) => {
    const { data } = await apiClient.patch(`/hostel-expense/${id}`, payload);
    return data;
  },
  submit: async (month, payload = {}) => {
    const { data } = await apiClient.put(`/hostel-expense/submit/${month}`, payload);
    return data;
  },
  approveByWarden: async (month, payload = {}) => {
    const { data } = await apiClient.put(`/hostel-expense/warden-approve/${month}`, payload);
    return data;
  },
  approveByDean: async (month, payload = {}) => {
    const { data } = await apiClient.put(`/hostel-expense/dean-approve/${month}`, payload);
    return data;
  },
  downloadPdf: async (month, params = {}) => {
    const { data } = await apiClient.get(`/hostel-expense/pdf/${month}`, {
      params,
      responseType: "blob",
    });
    return data;
  },
};
