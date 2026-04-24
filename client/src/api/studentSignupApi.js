import { apiClient } from "./client";

export const studentSignupApi = {
  list: async () => {
    const { data } = await apiClient.get("/student/signup-requests");
    return data;
  },
  caretakerForward: async (id, payload) => {
    const { data } = await apiClient.patch(`/student/signup-requests/${id}/caretaker-forward`, payload);
    return data;
  },
  caretakerReject: async (id, payload = {}) => {
    const { data } = await apiClient.patch(`/student/signup-requests/${id}/caretaker-reject`, payload);
    return data;
  },
  adminApprove: async (id) => {
    const { data } = await apiClient.patch(`/student/signup-requests/${id}/admin-approve`);
    return data;
  },
  adminReject: async (id, payload = {}) => {
    const { data } = await apiClient.patch(`/student/signup-requests/${id}/admin-reject`, payload);
    return data;
  },
};
