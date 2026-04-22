import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { eblApi } from "../../api/eblApi";
import { billApi } from "../../api/billApi";
import { expenseApi } from "../../api/expenseApi";
import { hostelApi } from "../../api/hostelApi";
import { hostelExpenseApi } from "../../api/hostelExpenseApi";
import { monthlyExpenseReportApi } from "../../api/monthlyExpenseReportApi";
import { reportApi } from "../../api/reportApi";
import { DataTable } from "../../components/common/DataTable";
import { ErrorState } from "../../components/common/ErrorState";
import { LoadingState } from "../../components/common/LoadingState";
import { MonthPicker } from "../../components/common/MonthPicker";
import { PageHeader } from "../../components/common/PageHeader";
import { StatusBadge } from "../../components/common/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Select";
import { useHostelExpenseDownload } from "../../hooks/useHostelExpenseDownload";
import { useMonthlyExpenseReportDownload } from "../../hooks/useMonthlyExpenseReportDownload";
import { useExpenseDownload } from "../../hooks/useExpenseDownload";
import { useAuthStore } from "../../store/authStore";
import { CURRENT_MONTH } from "../../utils/constants";

const normalizeRecord = (record, reportName, reportType) => {
  if (!record) return null;

  return {
    ...record,
    report_name: reportName,
    report_type: reportType,
    status: record.status || "draft",
    hostel_name: record.hostelId?.name || "-",
  };
};

export function AdminApprovalsPage() {
  const user = useAuthStore((state) => state.user);
  const isWarden = user?.role === "warden";
  const isDeanStageUser = user?.role === "dean" || user?.role === "admin";
  const downloadHostelExpense = useHostelExpenseDownload();
  const downloadMonthlyExpenseReport = useMonthlyExpenseReportDownload();
  const downloadExpense = useExpenseDownload();
  const [month, setMonth] = useState(CURRENT_MONTH);
  const [hostelId, setHostelId] = useState("");
  const needsHostelSelection = ["admin", "dean", "warden"].includes(user?.role);
  const effectiveHostelId = hostelId || user?.hostelId?._id || user?.hostelId?.id || "";

  const hostelsQuery = useQuery({
    queryKey: ["approval-hostels"],
    queryFn: hostelApi.list,
    enabled: needsHostelSelection,
  });

  const mainReportQuery = useQuery({
    queryKey: ["approval-main-report", month, effectiveHostelId],
    queryFn: () => reportApi.getStatus(month, { hostelId: effectiveHostelId }),
    enabled: Boolean(month && effectiveHostelId),
  });

  const monthlyExpenseReportQuery = useQuery({
    queryKey: ["approval-monthly-expense-report", month, effectiveHostelId],
    queryFn: async () => {
      try {
        return await monthlyExpenseReportApi.getByMonth(month, { hostelId: effectiveHostelId });
      } catch (error) {
        if (error?.response?.status === 404) {
          return null;
        }
        throw error;
      }
    },
    enabled: Boolean(month && effectiveHostelId),
    retry: false,
  });

  const hostelExpenseDetailsQuery = useQuery({
    queryKey: ["approval-hostel-expense-details", month, effectiveHostelId],
    queryFn: () => hostelExpenseApi.listByMonth(month, { hostelId: effectiveHostelId }),
    enabled: Boolean(month && effectiveHostelId),
  });
  const expenseSnapshotQuery = useQuery({
    queryKey: ["approval-expense-snapshot", month, effectiveHostelId],
    queryFn: () => expenseApi.listByMonth(month, { hostelId: effectiveHostelId }),
    enabled: Boolean(month && effectiveHostelId),
  });
  const messBillReportQuery = useQuery({
    queryKey: ["approval-mess-bill-report", month, effectiveHostelId],
    queryFn: async () => {
      try {
        return await billApi.getMessBillReportStatus(month, { hostelId: effectiveHostelId });
      } catch (error) {
        if (error?.response?.status === 404) {
          return null;
        }
        throw error;
      }
    },
    enabled: Boolean(month && effectiveHostelId),
    retry: false,
  });
  const eblReportsQuery = useQuery({
    queryKey: ["approval-ebl-reports", effectiveHostelId],
    queryFn: () => eblApi.listReports({ hostelId: effectiveHostelId, status: "submitted" }),
    enabled: Boolean(effectiveHostelId && isWarden),
  });

  const approvalMutation = useMutation({
    mutationFn: async ({ reportType, notes }) => {
      const payload = { hostelId: effectiveHostelId, notes };
      if (isDeanStageUser && reportType !== "monthly_expense_report") {
        throw new Error("Dean approval is only required for the Total Monthly Expenditure Report.");
      }
      if (reportType === "main_report") {
        return isWarden
          ? reportApi.approveByWarden(month, payload)
          : reportApi.approveByDean(month, payload);
      }
      if (reportType === "expense_snapshot") {
        return isWarden
          ? expenseApi.approveByWarden(month, payload)
          : expenseApi.approveByDean(month, payload);
      }
      if (reportType === "monthly_expense_report") {
        return isWarden
          ? monthlyExpenseReportApi.approveByWarden(month, payload)
          : monthlyExpenseReportApi.approveByDean(month, payload);
      }
      if (reportType === "mess_bill_per_student") {
        return isWarden
          ? billApi.approveMessBillReportByWarden(month, payload)
          : billApi.approveMessBillReportByDean(month, payload);
      }
      return isWarden
        ? hostelExpenseApi.approveByWarden(month, payload)
        : hostelExpenseApi.approveByDean(month, payload);
    },
    onSuccess: () => {
      toast.success("Report approved.");
      mainReportQuery.refetch();
      monthlyExpenseReportQuery.refetch();
      hostelExpenseDetailsQuery.refetch();
      expenseSnapshotQuery.refetch();
      messBillReportQuery.refetch();
    },
    onError: (error) => toast.error(error?.response?.data?.message || error?.message || "Unable to approve report."),
  });

  const eblMutation = useMutation({
    mutationFn: ({ id }) => eblApi.approveReport(id),
    onSuccess: () => {
      toast.success("EBL report approved.");
      eblReportsQuery.refetch();
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Unable to approve EBL claim."),
  });

  const approvalRows = useMemo(() => {
    const rows = [];

    const mainReport = mainReportQuery.data?.data;
    if (mainReport) {
      rows.push(
        normalizeRecord(
          { ...mainReport, hostelId: mainReport.hostelId },
          "Main Billing Report",
          "main_report"
        )
      );
    }

    const monthlyExpenseReport = monthlyExpenseReportQuery.data?.data;
    if (monthlyExpenseReport) {
      rows.push(
        normalizeRecord(
          monthlyExpenseReport,
          "Total Monthly Expenditure Report",
          "monthly_expense_report"
        )
      );
    }

    const expenseSnapshot = expenseSnapshotQuery.data?.expenses?.[0];
    if (expenseSnapshot) {
      rows.push(
        normalizeRecord(
          expenseSnapshot,
          "Expense Snapshot Report",
          "expense_snapshot"
        )
      );
    }

    const hostelExpenseDetails = hostelExpenseDetailsQuery.data?.data?.[0];
    if (hostelExpenseDetails) {
      rows.push(
        normalizeRecord(
          hostelExpenseDetails,
          "Hostel Expenditure Details Report",
          "hostel_expenditure_details"
        )
      );
    }

    const messBillReport = messBillReportQuery.data?.data;
    if (messBillReport) {
      rows.push(
        normalizeRecord(
          messBillReport,
          "Mess Bill Per Student Report",
          "mess_bill_per_student"
        )
      );
    }

    const normalizedRows = rows.filter(Boolean);
    return isDeanStageUser
      ? normalizedRows.filter((row) => row.report_type === "monthly_expense_report")
      : normalizedRows;
  }, [expenseSnapshotQuery.data?.expenses, hostelExpenseDetailsQuery.data?.data, isDeanStageUser, mainReportQuery.data?.data, messBillReportQuery.data?.data, monthlyExpenseReportQuery.data?.data]);
  const isLoading =
    (needsHostelSelection && hostelsQuery.isLoading) ||
    (Boolean(effectiveHostelId) &&
      (mainReportQuery.isLoading ||
        monthlyExpenseReportQuery.isLoading ||
        hostelExpenseDetailsQuery.isLoading ||
        expenseSnapshotQuery.isLoading ||
        messBillReportQuery.isLoading ||
        eblReportsQuery.isLoading));

  const hasError =
    (needsHostelSelection && hostelsQuery.isError) ||
    (Boolean(effectiveHostelId) &&
      (mainReportQuery.isError ||
        monthlyExpenseReportQuery.isError ||
        hostelExpenseDetailsQuery.isError ||
        expenseSnapshotQuery.isError ||
        messBillReportQuery.isError ||
        eblReportsQuery.isError));

  if (isLoading) {
    return <LoadingState label="Loading approvals..." />;
  }

  if (hasError) {
    return (
      <ErrorState
        description="Unable to load approval queues."
        onRetry={() => {
          if (needsHostelSelection) hostelsQuery.refetch();
          mainReportQuery.refetch();
          monthlyExpenseReportQuery.refetch();
          hostelExpenseDetailsQuery.refetch();
          expenseSnapshotQuery.refetch();
          messBillReportQuery.refetch();
          if (isWarden) eblReportsQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Approvals"
        title={isWarden ? "Warden approval panel" : "Dean/admin approval panel"}
        description={
          isWarden
            ? "Review submitted reports for the selected hostel and month, then approve them."
            : "Dean/admin approval is only required for the Total Monthly Expenditure Report."
        }
        action={
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <MonthPicker value={month} onChange={setMonth} />
            </div>
            {needsHostelSelection ? (
              <div>
                <label className="field-label">Hostel</label>
                <Select value={hostelId} onChange={(event) => setHostelId(event.target.value)}>
                  <option value="">Select hostel</option>
                  {(hostelsQuery.data?.data || []).map((hostel) => (
                    <option key={hostel._id} value={hostel._id}>{hostel.name}</option>
                  ))}
                </Select>
              </div>
            ) : null}
          </div>
        }
      />

      {needsHostelSelection && !effectiveHostelId ? (
        <div className="panel p-6">
          <h2 className="section-title">Choose a hostel</h2>
          <p className="mt-2 text-sm text-slate-500">
            Select a hostel above to load the approval queue for the selected month.
          </p>
        </div>
      ) : null}

      {effectiveHostelId ? (
        <DataTable
          rows={approvalRows}
          columns={[
            { key: "report_name", label: "Report Name" },
            { key: "month", label: "Month" },
            { key: "hostel_name", label: "Hostel" },
            { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
            {
              key: "download",
              label: "Download PDF",
              render: (row) => {
                if (row.report_type === "monthly_expense_report") {
                  return (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => downloadMonthlyExpenseReport(row.month, { hostelId: effectiveHostelId })}
                    >
                      Download PDF
                    </Button>
                  );
                }

                if (row.report_type === "hostel_expenditure_details") {
                  return (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => downloadHostelExpense(row.month, { hostelId: effectiveHostelId })}
                    >
                      Download PDF
                    </Button>
                  );
                }

                if (row.report_type === "expense_snapshot") {
                  return (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => downloadExpense(row.month, { hostelId: effectiveHostelId })}
                    >
                      Download PDF
                    </Button>
                  );
                }

                if (row.report_type === "mess_bill_per_student") {
                  return (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => billApi.downloadBillBreakdownReportPdf(row.month, { hostelId: effectiveHostelId })}
                    >
                      Download PDF
                    </Button>
                  );
                }

                return <span className="text-sm text-slate-400">Not available</span>;
              },
            },
            {
              key: "action",
              label: "Action",
              render: (row) => {
                const canApprove =
                  (isWarden && row.status === "submitted") ||
                  (isDeanStageUser &&
                    row.report_type === "monthly_expense_report" &&
                    row.status === "warden_approved");

                return (
                  <Button
                    type="button"
                    size="sm"
                    disabled={!canApprove || approvalMutation.isPending}
                    onClick={() => approvalMutation.mutate({ reportType: row.report_type, notes: "" })}
                  >
                    {isWarden ? "Approve as warden" : "Approve as dean"}
                  </Button>
                );
              },
            },
          ]}
          emptyMessage={`No reports available for approval for ${month} in the selected hostel.`}
        />
      ) : null}

      {isWarden ? (
        <div className="panel p-6">
          <h2 className="section-title">Submitted EBL reports</h2>
          <div className="mt-5">
            <DataTable
              rows={eblReportsQuery.data?.data || []}
              columns={[
                {
                  key: "report",
                  label: "Report Name",
                  render: (row) =>
                    row.reportType === "pre_receipt"
                      ? "EBL Pre-Receipt Report"
                      : "EBL Month-wise Calculation Report",
                },
                { key: "period", label: "Period", render: (row) => `${row.fromMonth} to ${row.toMonth}` },
                { key: "students", label: "Students Covered", render: (row) => row.totalStudents || 0 },
                { key: "messBill", label: "Mess Bill Total", render: (row) => `Rs. ${Number(row.totalMessBill || 0).toFixed(2)}` },
                {
                  key: "differenceTotal",
                  label: "Difference Total",
                  render: (row) => `Rs. ${Number(row.totalDifference || 0).toFixed(2)}`,
                },
                { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
                {
                  key: "download",
                  label: "Report PDF",
                  render: (row) => (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        eblApi.downloadReportPdf(row._id).then((blob) => {
                          const url = window.URL.createObjectURL(blob);
                          const link = document.createElement("a");
                          link.href = url;
                          link.download = `${row.reportType}-${row.fromMonth}-to-${row.toMonth}.pdf`;
                          link.click();
                          window.URL.revokeObjectURL(url);
                        })
                      }
                    >
                      Download PDF
                    </Button>
                  ),
                },
                {
                  key: "action",
                  label: "Action",
                  render: (row) => (
                    <Button
                      type="button"
                      size="sm"
                      disabled={eblMutation.isPending}
                      onClick={() => eblMutation.mutate({ id: row._id })}
                    >
                      Approve claim
                    </Button>
                  ),
                },
              ]}
              emptyMessage="No submitted EBL reports are waiting for warden approval."
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
