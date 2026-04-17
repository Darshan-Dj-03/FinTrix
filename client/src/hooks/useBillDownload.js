import toast from "react-hot-toast";

import { billApi } from "../api/billApi";

export const useBillDownload = () => {
  return async (studentId, month) => {
    try {
      const blob = await billApi.downloadBillPdf(studentId, month);
      const url = window.URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `bill-${month}.pdf`;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to download bill PDF.");
    }
  };
};
