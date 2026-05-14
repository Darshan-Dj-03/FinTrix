import toast from "react-hot-toast";

import { hostelDepositApi } from "../api/hostelDepositApi";

export const useHostelDepositReportDownload = () => {
  return async (academicYear) => {
    try {
      const blob = await hostelDepositApi.downloadYearlyReportPdf(academicYear);
      const url = window.URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `hostel-deposit-yearly-report-${academicYear}.pdf`;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to download hostel deposit yearly report PDF.");
    }
  };
};
