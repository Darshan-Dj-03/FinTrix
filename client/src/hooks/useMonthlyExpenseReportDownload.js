import toast from "react-hot-toast";

import { monthlyExpenseReportApi } from "../api/monthlyExpenseReportApi";

export const useMonthlyExpenseReportDownload = () => {
  return async (month, params = {}) => {
    try {
      const blob = await monthlyExpenseReportApi.downloadPdf(month, params);
      const url = window.URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `monthly-expense-report-${month}.pdf`;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to download monthly expense report PDF.");
    }
  };
};
