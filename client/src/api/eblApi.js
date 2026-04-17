import { apiClient } from "./client";

export const eblApi = {
  request: async (studentId) => {
    const { data } = await apiClient.put(`/ebl/request/${studentId}`);
    return data;
  },
  approve: async (studentId, payload) => {
    const { data } = await apiClient.put(`/ebl/approve/${studentId}`, payload);
    return data;
  },
};
