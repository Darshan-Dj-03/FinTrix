import { apiClient } from "./client";

export const hostelDepositApi = {
  list: async (params = {}) => {
    const { data } = await apiClient.get("/hostel-deposit", { params });
    return data;
  },
  create: async (payload) => {
    const { data } = await apiClient.post("/hostel-deposit", payload);
    return data;
  },
  update: async (id, payload) => {
    const { data } = await apiClient.put(`/hostel-deposit/${id}`, payload);
    return data;
  },
  verify: async (id) => {
    const { data } = await apiClient.put(`/hostel-deposit/${id}/verify`);
    return data;
  },
  yearlyReport: async (academicYear) => {
    const { data } = await apiClient.get("/hostel-deposit/report/yearly", {
      params: { academicYear },
    });
    return data;
  },
  downloadYearlyReportPdf: async (academicYear) => {
    const { data } = await apiClient.get("/hostel-deposit/report/yearly/pdf", {
      params: { academicYear },
      responseType: "blob",
    });
    return data;
  },
};
