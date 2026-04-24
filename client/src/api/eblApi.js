import { apiClient } from "./client";

export const eblApi = {
  getStudentStatus: async () => {
    const { data } = await apiClient.get("/ebl/student");
    return data;
  },
  listPeriods: async (params = {}) => {
    const { data } = await apiClient.get("/ebl/periods", { params });
    return data;
  },
  listReports: async (params = {}) => {
    const { data } = await apiClient.get("/ebl/reports", { params });
    return data;
  },
  createPeriod: async (payload) => {
    const { data } = await apiClient.post("/ebl/periods", payload);
    return data;
  },
  updatePeriod: async (id, payload) => {
    const { data } = await apiClient.put(`/ebl/periods/${id}`, payload);
    return data;
  },
  verifyPeriod: async (id) => {
    const { data } = await apiClient.put(`/ebl/periods/${id}/verify`);
    return data;
  },
  generateReport: async (payload) => {
    const { data } = await apiClient.post("/ebl/reports", payload);
    return data;
  },
  submitReport: async (id) => {
    const { data } = await apiClient.put(`/ebl/reports/${id}/submit`);
    return data;
  },
  approveReport: async (id) => {
    const { data } = await apiClient.put(`/ebl/reports/${id}/approve`);
    return data;
  },
  downloadReportPdf: async (id) => {
    const response = await apiClient.get(`/ebl/reports/${id}/pdf`, { responseType: "blob" });
    return response.data;
  },
};
