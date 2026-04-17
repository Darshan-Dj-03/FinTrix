import { apiClient } from "./client";

export const paymentApi = {
  list: async (params = {}) => {
    const { data } = await apiClient.get("/payment", { params });
    return data;
  },
  listByBill: async (billId) => {
    const { data } = await apiClient.get(`/payment/bill/${billId}`);
    return data;
  },
  create: async (payload) => {
    const { data } = await apiClient.post("/payment", payload, {
      headers: payload.idempotencyKey
        ? { "X-Idempotency-Key": payload.idempotencyKey }
        : undefined,
    });
    return data;
  },
};
