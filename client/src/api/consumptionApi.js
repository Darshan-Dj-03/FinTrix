import { apiClient } from "./client";

export const consumptionApi = {
  listByMonth: async (month) => {
    const { data } = await apiClient.get(`/consumption/month/${month}`);
    return data;
  },
  getStudentConsumption: async (studentId, month) => {
    const { data } = await apiClient.get(`/consumption/${studentId}/${month}`);
    return data;
  },
  create: async (payload) => {
    const { data } = await apiClient.post("/consumption/add", payload);
    return data;
  },
  bulkUpsert: async (payload) => {
    const { data } = await apiClient.post("/consumption/bulk-upsert", payload);
    return data;
  },
  update: async (id, payload) => {
    const { data } = await apiClient.put(`/consumption/update/${id}`, payload);
    return data;
  },
  remove: async (id) => {
    const { data } = await apiClient.delete(`/consumption/${id}`);
    return data;
  },
};
