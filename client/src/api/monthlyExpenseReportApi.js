import { apiClient } from "./client";

export const monthlyExpenseReportApi = {
  list: async (params = {}) => {
    const { data } = await apiClient.get("/monthly-expense-report", { params });
    return data;
  },
  getByMonth: async (month, params = {}) => {
    const { data } = await apiClient.get(`/monthly-expense-report/${month}`, { params });
    return data;
  },
  getSource: async (month, params = {}) => {
    const { data } = await apiClient.get(`/monthly-expense-report/source/${month}`, { params });
    return data;
  },
  generate: async (month, payload) => {
    const { data } = await apiClient.post(`/monthly-expense-report/generate/${month}`, payload);
    return data;
  },
  submit: async (month, payload = {}) => {
    const { data } = await apiClient.put(`/monthly-expense-report/submit/${month}`, payload);
    return data;
  },
  approveByWarden: async (month, payload = {}) => {
    const { data } = await apiClient.put(`/monthly-expense-report/warden-approve/${month}`, payload);
    return data;
  },
  approveByDean: async (month, payload = {}) => {
    const { data } = await apiClient.put(`/monthly-expense-report/dean-approve/${month}`, payload);
    return data;
  },
  downloadPdf: async (month, params = {}) => {
    const { data } = await apiClient.get(`/monthly-expense-report/pdf/${month}`, {
      params,
      responseType: "blob",
    });
    return data;
  },
};
