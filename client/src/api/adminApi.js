import { apiClient } from "./client";

export const adminApi = {
  listUsers: async () => {
    const { data } = await apiClient.get("/admin/users");
    return data;
  },
  createUser: async (payload) => {
    const { data } = await apiClient.post("/admin/users", payload);
    return data;
  },
  updateUser: async (id, payload) => {
    const { data } = await apiClient.patch(`/admin/users/${id}`, payload);
    return data;
  },
};
