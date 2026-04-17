import toast from "react-hot-toast";

import { billApi } from "../api/billApi";

export const useBillBreakdownReportDownload = () => {
  return async (month, params = {}) => {
    try {
      const blob = await billApi.downloadBillBreakdownReportPdf(month, params);
      const url = window.URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `mess-bill-per-student-${month}.pdf`;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to download mess bill per student PDF.");
    }
  };
};
