import { apiClient } from "./client";

export const hostelApi = {
  list: async () => {
    const { data } = await apiClient.get("/hostel/all");
    return {
      ...data,
      data: data.hostels || [],
    };
  },
  create: async (payload) => {
    const { data } = await apiClient.post("/hostel/create", payload);
    return data;
  },
};
