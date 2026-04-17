import { apiClient } from "./client";

export const analyticsApi = {
  getSummary: async (month, params = {}) => {
    const { data } = await apiClient.get(`/analytics/summary/${month}`, { params });
    return data;
  },
  getHostels: async (month, params = {}) => {
    const { data } = await apiClient.get(`/analytics/hostel/${month}`, { params });
    return data;
  },
  getConsumption: async (month, params = {}) => {
    const { data } = await apiClient.get(`/analytics/consumption/${month}`, { params });
    return data;
  },
  getStudents: async (month, params = {}) => {
    const { data } = await apiClient.get(`/analytics/students/${month}`, { params });
    return data;
  },
  getFinance: async (month, params = {}) => {
    const { data } = await apiClient.get(`/analytics/finance/${month}`, { params });
    return data;
  },
};
