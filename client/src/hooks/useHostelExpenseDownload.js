import toast from "react-hot-toast";

import { hostelExpenseApi } from "../api/hostelExpenseApi";

export const useHostelExpenseDownload = () => {
  return async (month, params = {}) => {
    try {
      const blob = await hostelExpenseApi.downloadPdf(month, params);
      const url = window.URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `hostel-expense-${month}.pdf`;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to download hostel expense PDF.");
    }
  };
};
