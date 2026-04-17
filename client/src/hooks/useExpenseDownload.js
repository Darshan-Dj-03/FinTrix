import toast from "react-hot-toast";

import { expenseApi } from "../api/expenseApi";

export const useExpenseDownload = () => {
  return async (month, params = {}) => {
    try {
      const blob = await expenseApi.downloadPdf(month, params);
      const url = window.URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `expense-snapshot-${month}.pdf`;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to download expense snapshot PDF.");
    }
  };
};
