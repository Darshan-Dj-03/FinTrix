import { apiClient } from "./client";
import { API_BASE_URL } from "../utils/constants";

export const billApi = {
  getBillsByMonth: async (month, params = {}) => {
    const { data } = await apiClient.get(`/bill/all/${month}`, { params });
    return data;
  },
  getBillConfig: async (month) => {
    const { data } = await apiClient.get(`/bill/config/${month}`);
    return data;
  },
  updateBillConfig: async (month, payload) => {
    const { data } = await apiClient.put(`/bill/config/${month}`, payload);
    return data;
  },
  getBillBreakdownByMonth: async (month, params = {}) => {
    const { data } = await apiClient.get(`/bill/breakdown/${month}`, { params });
    return data;
  },
  getMessBillReportStatus: async (month, params = {}) => {
    const { data } = await apiClient.get(`/bill/report/status/${month}`, { params });
    return data;
  },
  generateMessBillReport: async (month, payload = {}) => {
    const { data } = await apiClient.post(`/bill/report/generate/${month}`, payload);
    return data;
  },
  submitMessBillReport: async (month, payload = {}) => {
    const { data } = await apiClient.put(`/bill/report/submit/${month}`, payload);
    return data;
  },
  approveMessBillReportByWarden: async (month, payload = {}) => {
    const { data } = await apiClient.put(`/bill/report/warden-approve/${month}`, payload);
    return data;
  },
  approveMessBillReportByDean: async (month, payload = {}) => {
    const { data } = await apiClient.put(`/bill/report/dean-approve/${month}`, payload);
    return data;
  },
  getStudentBill: async (studentId, month) => {
    try {
      const { data } = await apiClient.get(`/bill/student/${studentId}/${month}`);
      return data;
    } catch (error) {
      if (error?.response?.status === 404) {
        return { success: true, data: null };
      }
      throw error;
    }
  },
  getStudentBillHistory: async (studentId, params = {}) => {
    const { data } = await apiClient.get(`/bill/history/${studentId}`, { params });
    return data;
  },
  updateStudentPaymentInfo: async (billId, payload) => {
    const { data } = await apiClient.put(`/bill/payment-info/${billId}`, payload);
    return data;
  },
  generateBills: async (month) => {
    const { data } = await apiClient.post(`/bill/generate/${month}`);
    return data;
  },
  getBillPdfUrl: (studentId, month) => `${API_BASE_URL}/bill/pdf/${studentId}/${month}`,
  getBillBreakdownReportPdfUrl: (month) => `${API_BASE_URL}/bill/report/pdf/${month}`,
  downloadBillPdf: async (studentId, month) => {
    const response = await apiClient.get(`/bill/pdf/${studentId}/${month}`, {
      responseType: "blob",
    });
    return response.data;
  },
  downloadBillBreakdownReportPdf: async (month, params = {}) => {
    const response = await apiClient.get(`/bill/report/pdf/${month}`, {
      params,
      responseType: "blob",
    });
    return response.data;
  },
};
