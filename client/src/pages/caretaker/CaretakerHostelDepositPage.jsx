import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

import { hostelDepositApi } from "../../api/hostelDepositApi";
import { DataTable } from "../../components/common/DataTable";
import { ErrorState } from "../../components/common/ErrorState";
import { LoadingState } from "../../components/common/LoadingState";
import { PageHeader } from "../../components/common/PageHeader";
import { StatusBadge } from "../../components/common/StatusBadge";
import { Button } from "../../components/ui/Button";
import { getAcademicYearOptions, getDefaultAcademicYear } from "../../utils/academicYears";
import { formatCurrency, formatDate } from "../../utils/formatters";

export function CaretakerHostelDepositPage() {
  const navigate = useNavigate();
  const [reportYear, setReportYear] = useState(getDefaultAcademicYear());
  const academicYearOptions = getAcademicYearOptions();

  const depositsQuery = useQuery({
    queryKey: ["caretaker-hostel-deposits"],
    queryFn: () => hostelDepositApi.list(),
  });

  const verifyMutation = useMutation({
    mutationFn: hostelDepositApi.verify,
    onSuccess: () => {
      toast.success("Hostel deposit accepted.");
      depositsQuery.refetch();
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Unable to accept hostel deposit.");
    },
  });

  if (depositsQuery.isLoading) {
    return <LoadingState label="Loading hostel deposit workspace..." />;
  }

  if (depositsQuery.isError) {
    return <ErrorState description="Unable to load hostel deposit workspace." onRetry={() => depositsQuery.refetch()} />;
  }

  const rows = depositsQuery.data?.data || [];
  const draftRows = rows.filter((row) => row.status === "draft");
  const acceptedRows = rows.filter((row) => row.status === "accepted");
  const getDisplayStatus = (row) => {
    const availableAmount = Number(row.availableAmount || 0);
    const amountUsed = Number(row.amountUsed || 0);

    if (amountUsed > 0 && availableAmount <= 0) {
      return "used";
    }
    if (amountUsed > 0) {
      return "partially_used";
    }
    return row.status;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Hostel Deposit"
        title="Review student hostel deposits"
        description="Review yearly hostel deposits submitted by students, accept them for future NOC deduction, and generate the yearly deposit report."
      />

      <div className="panel p-6">
        <h3 className="section-title">Submitted deposits</h3>
        <DataTable
          rows={draftRows}
          columns={[
            { key: "student", label: "Student", render: (row) => row.studentId?.studentId || "-" },
            { key: "name", label: "Name", render: (row) => row.userId?.name || "-" },
            { key: "academicYear", label: "Academic Year" },
            { key: "amountReceived", label: "Deposit", render: (row) => formatCurrency(row.amountReceived || 0) },
            { key: "notes", label: "Notes", render: (row) => row.notes || "-" },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <Button type="button" size="sm" loading={verifyMutation.isPending} onClick={() => verifyMutation.mutate(row._id)}>
                  Accept
                </Button>
              ),
            },
          ]}
          emptyMessage="No hostel deposit submissions are waiting for review."
        />
      </div>

      <div className="panel p-6">
        <h3 className="section-title">Yearly report</h3>
        <div className="mt-6 flex gap-3">
          <div className="w-full max-w-sm">
            <label className="field-label">Academic year</label>
            <select className="input" value={reportYear} onChange={(event) => setReportYear(event.target.value)}>
              {academicYearOptions.map((academicYear) => (
                <option key={academicYear} value={academicYear}>
                  {academicYear}
                </option>
              ))}
            </select>
          </div>
          <div className="self-end">
            <Button
              type="button"
              onClick={() => navigate("/caretaker/reports", { state: { section: "hostel-deposit", academicYear: reportYear } })}
            >
              Generate Report
            </Button>
          </div>
        </div>
        <p className="mt-4 text-sm text-slate-500">
          Yearly hostel deposit reports are available from the Reports page.
        </p>
      </div>

      <div className="panel p-6">
        <h3 className="section-title">Accepted deposits</h3>
        <DataTable
          rows={acceptedRows}
          columns={[
            { key: "student", label: "Student", render: (row) => row.studentId?.studentId || "-" },
            { key: "name", label: "Name", render: (row) => row.userId?.name || "-" },
            { key: "academicYear", label: "Academic Year" },
            { key: "amountReceived", label: "Received", render: (row) => formatCurrency(row.amountReceived || 0) },
            { key: "amountUsed", label: "Used", render: (row) => formatCurrency(row.amountUsed || 0) },
            { key: "availableAmount", label: "Available", render: (row) => formatCurrency(row.availableAmount || 0) },
            { key: "status", label: "Status", render: (row) => <StatusBadge value={getDisplayStatus(row)} /> },
          ]}
          emptyMessage="No accepted hostel deposits yet."
        />
      </div>
    </div>
  );
}
