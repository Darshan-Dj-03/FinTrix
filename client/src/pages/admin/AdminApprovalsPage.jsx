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
import { studentApi } from "../../api/studentApi";
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

  const studentsQuery = useQuery({
    queryKey: ["approval-students"],
    queryFn: studentApi.list,
    enabled: user?.role === "admin",
  });

  const approvalMutation = useMutation({
    mutationFn: async ({ reportType, notes }) => {
      const payload = { hostelId: effectiveHostelId, notes };
      if (reportType === "main_report") {
        return user?.role === "warden"
          ? reportApi.approveByWarden(month, payload)
          : reportApi.approveByDean(month, payload);
      }
      if (reportType === "expense_snapshot") {
        return user?.role === "warden"
          ? expenseApi.approveByWarden(month, payload)
          : expenseApi.approveByDean(month, payload);
      }
      if (reportType === "monthly_expense_report") {
        return user?.role === "warden"
          ? monthlyExpenseReportApi.approveByWarden(month, payload)
          : monthlyExpenseReportApi.approveByDean(month, payload);
      }
      if (reportType === "mess_bill_per_student") {
        return user?.role === "warden"
          ? billApi.approveMessBillReportByWarden(month, payload)
          : billApi.approveMessBillReportByDean(month, payload);
      }
      return user?.role === "warden"
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
    onError: (error) => toast.error(error?.response?.data?.message || "Unable to approve report."),
  });

  const eblMutation = useMutation({
    mutationFn: ({ id, approve }) => eblApi.approve(id, { approve }),
    onSuccess: () => {
      toast.success("EBL status updated.");
      studentsQuery.refetch();
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Unable to update EBL."),
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

    return rows.filter(Boolean);
  }, [expenseSnapshotQuery.data?.expenses, hostelExpenseDetailsQuery.data?.data, mainReportQuery.data?.data, messBillReportQuery.data?.data, monthlyExpenseReportQuery.data?.data]);

  const pendingStudents = (studentsQuery.data?.students || []).filter((student) => student.userId?.eblRequestPending);

  const isLoading =
    (needsHostelSelection && hostelsQuery.isLoading) ||
    (Boolean(effectiveHostelId) && (mainReportQuery.isLoading || monthlyExpenseReportQuery.isLoading || hostelExpenseDetailsQuery.isLoading || expenseSnapshotQuery.isLoading || messBillReportQuery.isLoading)) ||
    (user?.role === "admin" && studentsQuery.isLoading);

  const hasError =
    (needsHostelSelection && hostelsQuery.isError) ||
    (Boolean(effectiveHostelId) && (mainReportQuery.isError || monthlyExpenseReportQuery.isError || hostelExpenseDetailsQuery.isError || expenseSnapshotQuery.isError || messBillReportQuery.isError)) ||
    (user?.role === "admin" && studentsQuery.isError);

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
          if (user?.role === "admin") studentsQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Approvals"
        title={user?.role === "warden" ? "Warden approval panel" : "Dean/admin approval panel"}
        description="Review submitted reports for the selected hostel and month, then approve them in sequence."
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
                  (user?.role === "warden" && row.status === "submitted") ||
                  ((user?.role === "dean" || user?.role === "admin") && row.status === "warden_approved");

                return (
                  <Button
                    type="button"
                    size="sm"
                    disabled={!canApprove || approvalMutation.isPending}
                    onClick={() => approvalMutation.mutate({ reportType: row.report_type, notes: "" })}
                  >
                    {user?.role === "warden" ? "Approve as warden" : "Approve as dean"}
                  </Button>
                );
              },
            },
          ]}
          emptyMessage={`No reports available for approval for ${month} in the selected hostel.`}
        />
      ) : null}

      <div className="panel p-6">
        <h2 className="section-title">Pending EBL requests</h2>
        {user?.role !== "admin" ? (
          <p className="mt-4 text-sm text-slate-500">Only admin users can approve or reject EBL requests.</p>
        ) : (
          <div className="mt-5">
            <DataTable
              rows={pendingStudents}
              columns={[
                { key: "studentId", label: "Student ID" },
                { key: "name", label: "Name", render: (row) => row.userId?.name || "-" },
                { key: "hostel", label: "Hostel", render: (row) => row.userId?.hostelId?.name || "-" },
                { key: "state", label: "Status", render: () => <StatusBadge value="submitted" /> },
                {
                  key: "actions",
                  label: "Actions",
                  render: (row) => (
                    <div className="flex gap-2">
                      <button
                        className="rounded-xl bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-700"
                        onClick={() => eblMutation.mutate({ id: row._id, approve: true })}
                      >
                        Approve
                      </button>
                      <button
                        className="rounded-xl bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-700"
                        onClick={() => eblMutation.mutate({ id: row._id, approve: false })}
                      >
                        Reject
                      </button>
                    </div>
                  ),
                },
              ]}
            />
          </div>
        )}
      </div>
    </div>
  );
}
