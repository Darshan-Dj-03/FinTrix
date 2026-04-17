import { apiClient } from "./client";

export const reportApi = {
  generate: async (month) => {
    const { data } = await apiClient.post(`/report/generate/${month}`);
    return data;
  },
  submit: async (month) => {
    const { data } = await apiClient.put(`/report/submit/${month}`);
    return data;
  },
  getStatus: async (month, params = {}) => {
    try {
      const { data } = await apiClient.get(`/report/status/${month}`, { params });
      return data;
    } catch (error) {
      if (error?.response?.status === 404) {
        return {
          success: true,
          data: {
            month,
            hostelId: params.hostelId || null,
            status: "draft",
          },
        };
      }
      throw error;
    }
  },
  getFull: async (month, params = {}) => {
    const { data } = await apiClient.get(`/report/full/${month}`, { params });
    return data;
  },
  approveByWarden: async (month, payload) => {
    const { data } = await apiClient.put(`/report/warden-approve/${month}`, payload);
    return data;
  },
  approveByDean: async (month, payload) => {
    const { data } = await apiClient.put(`/report/dean-approve/${month}`, payload);
    return data;
  },
};
