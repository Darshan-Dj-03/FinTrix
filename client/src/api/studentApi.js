import { apiClient } from "./client";

export const studentApi = {
  list: async () => {
    const { data } = await apiClient.get("/student/all");
    return data;
  },
  update: async (id, payload) => {
    const { data } = await apiClient.patch(`/student/update/${id}`, payload);
    return data;
  },
};
