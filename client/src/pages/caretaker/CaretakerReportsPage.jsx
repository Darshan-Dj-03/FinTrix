import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useLocation } from "react-router-dom";

import { billApi } from "../../api/billApi";
import { eblApi } from "../../api/eblApi";
import { expenseApi } from "../../api/expenseApi";
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
import { ReportActionPanel } from "../../features/caretaker/ReportActionPanel";
import { useHostelExpenseDownload } from "../../hooks/useHostelExpenseDownload";
import { useMonthlyExpenseReportDownload } from "../../hooks/useMonthlyExpenseReportDownload";
import { useExpenseDownload } from "../../hooks/useExpenseDownload";
import { useBillBreakdownReportDownload } from "../../hooks/useBillBreakdownReportDownload";
import { CURRENT_MONTH } from "../../utils/constants";
import { formatCurrency } from "../../utils/formatters";

const getApprovalStatusMeta = (row) => {
  if (row?.approvedByDean?.name) {
    return `Approved by dean: ${row.approvedByDean.name}`;
  }

  if (row?.approvedByWarden?.name) {
    return `Approved by warden: ${row.approvedByWarden.name}`;
  }

  if (row?.submittedBy?.name) {
    return `Submitted by: ${row.submittedBy.name}`;
  }

  return null;
};

export function CaretakerReportsPage() {
  const location = useLocation();
  const [month, setMonth] = useState(location.state?.month || CURRENT_MONTH);
  const downloadReport = useMonthlyExpenseReportDownload();
  const downloadHostelExpense = useHostelExpenseDownload();
  const downloadExpense = useExpenseDownload();
  const downloadMessBillPerStudent = useBillBreakdownReportDownload();
  const monthlyExpenseReportsQuery = useQuery({
    queryKey: ["caretaker-monthly-expense-reports"],
    queryFn: () => monthlyExpenseReportApi.list(),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const hostelExpenseQuery = useQuery({
    queryKey: ["caretaker-hostel-expense-report-list", month],
    queryFn: () => hostelExpenseApi.listByMonth(month),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const expenseSnapshotQuery = useQuery({
    queryKey: ["caretaker-expense-report-list", month],
    queryFn: () => expenseApi.listByMonth(month),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const messBillPerStudentQuery = useQuery({
    queryKey: ["caretaker-mess-bill-report-list", month],
    queryFn: async () => {
      try {
        return await billApi.getMessBillReportStatus(month);
      } catch (error) {
        if (error?.response?.status === 404) {
          const breakdown = await billApi.getBillBreakdownByMonth(month, { page: 1, limit: 1 });
          if ((breakdown?.pagination?.total || 0) === 0) {
            return null;
          }
          return { data: null, draftSource: breakdown };
        }
        throw error;
      }
    },
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const eblReportsQuery = useQuery({
    queryKey: ["caretaker-ebl-report-list"],
    queryFn: () => eblApi.listReports(),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const reportQuery = useQuery({
    queryKey: ["caretaker-report-full-page", month],
    queryFn: () => reportApi.getFull(month),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const statusQuery = useQuery({
    queryKey: ["caretaker-report-status-page-2", month],
    queryFn: () => reportApi.getStatus(month),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const generateMutation = useMutation({
    mutationFn: () => reportApi.generate(month),
    onSuccess: () => {
      toast.success("Report generated.");
      reportQuery.refetch();
      statusQuery.refetch();
      monthlyExpenseReportsQuery.refetch();
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Unable to generate report."),
  });

  const submitMutation = useMutation({
    mutationFn: () => reportApi.submit(month),
    onSuccess: () => {
      toast.success("Report submitted.");
      statusQuery.refetch();
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Unable to submit report."),
  });
  const getEblReportLabel = (row) =>
    row.reportType === "pre_receipt" ? "EBL Pre-Receipt Report" : "EBL Month-wise Calculation Report";

  const submitNamedReportMutation = useMutation({
    mutationFn: async ({ reportType, month: targetMonth }) => {
      if (reportType === "ebl_report") {
        return eblApi.submitReport(targetMonth);
      }
      if (reportType === "monthly_total_expenditure") {
        return monthlyExpenseReportApi.submit(targetMonth);
      }

      if (reportType === "expense_snapshot") {
        return expenseApi.submit(targetMonth);
      }
      if (reportType === "mess_bill_per_student") {
        if (!messBillPerStudentQuery.data?.data) {
          await billApi.generateMessBillReport(targetMonth);
        }
        return billApi.submitMessBillReport(targetMonth);
      }

      return hostelExpenseApi.submit(targetMonth);
    },
    onSuccess: (_, variables) => {
      toast.success(
        variables.reportType === "monthly_total_expenditure"
          ? "Total monthly expenditure report submitted."
          : variables.reportType === "ebl_report"
            ? "EBL report submitted."
          : variables.reportType === "expense_snapshot"
            ? "Expense snapshot report submitted."
            : variables.reportType === "mess_bill_per_student"
              ? "Mess bill per student report submitted."
          : "Hostel expenditure details report submitted."
      );
      monthlyExpenseReportsQuery.refetch();
      hostelExpenseQuery.refetch();
      expenseSnapshotQuery.refetch();
      messBillPerStudentQuery.refetch();
      eblReportsQuery.refetch();
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Unable to submit selected report."),
  });

  const filteredMonthlyExpenseReports = (monthlyExpenseReportsQuery.data?.data || []).filter((row) => row.month === month);
  const hostelExpenseReportRows = (hostelExpenseQuery.data?.data || []).map((row) => ({
    ...row,
    report_name: "Hostel Expenditure Details Report",
    report_type: "hostel_expenditure_details",
    status: row.status || "draft",
    total_value: null,
    per_day: null,
  }));
  const expenseSnapshotRows = (expenseSnapshotQuery.data?.expenses || []).map((row) => ({
    ...row,
    report_name: "Expense Snapshot Report",
    report_type: "expense_snapshot",
    status: row.status || "draft",
  }));
  const monthlyTotalExpenseRows = filteredMonthlyExpenseReports.map((row) => ({
    ...row,
    report_name: "Total Monthly Expenditure Report",
    report_type: "monthly_total_expenditure",
    status: row.status || "draft",
    total_value: row.total_expenditure,
    per_day: row.mess_bill_per_day,
  }));
  const messBillPerStudentRows =
    messBillPerStudentQuery.data?.data || messBillPerStudentQuery.data?.draftSource
      ? [
          {
            _id: `mess-bill-per-student-${month}`,
            month,
            report_name: "Mess Bill Per Student Report",
            report_type: "mess_bill_per_student",
            status: messBillPerStudentQuery.data?.data?.status || "draft",
            total_students:
              messBillPerStudentQuery.data?.data?.billCount ||
              messBillPerStudentQuery.data?.draftSource?.pagination?.total ||
              0,
          },
        ]
      : [];
  const eblReportRows = (eblReportsQuery.data?.data || []).map((row) => ({
    ...row,
    month: `${row.fromMonth} to ${row.toMonth}`,
    report_name: getEblReportLabel(row),
    report_type: "ebl_report",
    hostelId: row.hostelId,
    status: row.status || "draft",
  }));
  const combinedReportRows = [
    ...monthlyTotalExpenseRows,
    ...expenseSnapshotRows,
    ...hostelExpenseReportRows,
    ...messBillPerStudentRows,
    ...eblReportRows,
  ];

  if (reportQuery.isLoading || statusQuery.isLoading || monthlyExpenseReportsQuery.isLoading || hostelExpenseQuery.isLoading || expenseSnapshotQuery.isLoading || messBillPerStudentQuery.isLoading || eblReportsQuery.isLoading) {
    return <LoadingState label="Loading report center..." />;
  }
  if (reportQuery.isError || statusQuery.isError || monthlyExpenseReportsQuery.isError || hostelExpenseQuery.isError || expenseSnapshotQuery.isError || messBillPerStudentQuery.isError || eblReportsQuery.isError) {
    return (
      <ErrorState
        description="Unable to load report center."
        onRetry={() => {
          reportQuery.refetch();
          statusQuery.refetch();
          monthlyExpenseReportsQuery.refetch();
          hostelExpenseQuery.refetch();
          expenseSnapshotQuery.refetch();
          messBillPerStudentQuery.refetch();
          eblReportsQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reports"
        title="Submission workflow"
        // description="Generate report snapshots, inspect student-level summaries, and submit the report for approvals."
        action={
          <div className="w-full max-w-sm">
            <MonthPicker value={month} onChange={setMonth} />
          </div>
        }
      />

      <DataTable
        rows={combinedReportRows}
        columns={[
          { key: "report_name", label: "Report Name" },
          { key: "month", label: "Month" },
          { key: "hostel", label: "Hostel", render: (row) => row.hostelId?.name || "-" },
          {
            key: "status",
            label: "Status",
            render: (row) => {
              const approvalMeta = getApprovalStatusMeta(row);

              return (
                <div className="space-y-1">
                  <StatusBadge value={row.status || "draft"} />
                  {approvalMeta ? <p className="text-xs text-slate-500">{approvalMeta}</p> : null}
                </div>
              );
            },
          },
          {
            key: "details",
            label: "Details",
            render: (row) =>
              row.report_type === "ebl_report"
                ? `${row.totalStudents || 0} students | Difference: ${formatCurrency(row.totalDifference)}`
              :
              row.report_type === "monthly_total_expenditure"
                ? `Total: ${formatCurrency(row.total_expenditure)} | Per Day: ${formatCurrency(row.mess_bill_per_day)}`
                : row.report_type === "expense_snapshot"
                  ? `Mess Bill: ${formatCurrency(row.mess_bill_total)} | Static: ${formatCurrency(row.dynamic_charge_total)}`
                : row.report_type === "mess_bill_per_student"
                  ? `${row.total_students} saved student bill rows`
                  : `Updated: ${new Date(row.updatedAt || row.createdAt).toLocaleDateString()}`,
          },
          {
            key: "submit",
            label: "Submit",
            render: (row) => (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={row.status !== "draft" || submitNamedReportMutation.isPending}
                onClick={() =>
                  submitNamedReportMutation.mutate({
                    reportType: row.report_type,
                    month: row.report_type === "ebl_report" ? row._id : row.month,
                  })
                }
                >
                  {row.status === "draft" ? "Submit" : row.status.replaceAll("_", " ")}
                </Button>
            ),
          },
          {
            key: "actions",
            label: "Download PDF",
            render: (row) => (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  row.report_type === "monthly_total_expenditure"
                    ? downloadReport(row.month)
                    : row.report_type === "ebl_report"
                      ? eblApi.downloadReportPdf(row._id).then((blob) => {
                          const url = window.URL.createObjectURL(blob);
                          const link = document.createElement("a");
                          link.href = url;
                          link.download = `${row.reportType}-${row.fromMonth}-to-${row.toMonth}.pdf`;
                          link.click();
                          window.URL.revokeObjectURL(url);
                        })
                    : row.report_type === "expense_snapshot"
                      ? downloadExpense(row.month)
                      : row.report_type === "mess_bill_per_student"
                        ? downloadMessBillPerStudent(row.month)
                      : downloadHostelExpense(row.month)
                }
              >
                Download PDF
              </Button>
            ),
          },
        ]}
        emptyMessage={`No reports available yet for ${month}.`}
      />

      <ReportActionPanel
        status={statusQuery.data?.data?.status || "draft"}
        onGenerate={() => generateMutation.mutate()}
        onSubmit={() => submitMutation.mutate()}
        generating={generateMutation.isPending}
        submitting={submitMutation.isPending}
      />

      <DataTable
        rows={reportQuery.data?.data?.studentWiseSummary || []}
        columns={[
          { key: "studentCode", label: "Student" },
          { key: "name", label: "Name" },
          { key: "billAmount", label: "Bill", render: (row) => formatCurrency(row.billAmount) },
          { key: "paymentStatus", label: "Payment status" },
        ]}
      />
    </div>
  );
}
