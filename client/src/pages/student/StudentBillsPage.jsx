import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { billApi } from "../../api/billApi";
import { DataTable } from "../../components/common/DataTable";
import { ErrorState } from "../../components/common/ErrorState";
import { LoadingState } from "../../components/common/LoadingState";
import { MonthPicker } from "../../components/common/MonthPicker";
import { PageHeader } from "../../components/common/PageHeader";
import { Pagination } from "../../components/common/Pagination";
import { StatusBadge } from "../../components/common/StatusBadge";
import { BillCard } from "../../features/student/BillCard";
import { useBillDownload } from "../../hooks/useBillDownload";
import { useAuthStore } from "../../store/authStore";
import { CURRENT_MONTH } from "../../utils/constants";
import { formatCurrency } from "../../utils/formatters";

export function StudentBillsPage() {
  const studentProfile = useAuthStore((state) => state.studentProfile);
  const [month, setMonth] = useState(CURRENT_MONTH);
  const [page, setPage] = useState(1);
  const downloadBill = useBillDownload();

  const detailQuery = useQuery({
    queryKey: ["student-bill-page", studentProfile?._id, month],
    queryFn: () => billApi.getStudentBill(studentProfile._id, month),
    enabled: Boolean(studentProfile?._id),
  });
  const historyQuery = useQuery({
    queryKey: ["student-bill-history", studentProfile?._id, page],
    queryFn: () => billApi.getStudentBillHistory(studentProfile._id, { page, limit: 6 }),
    enabled: Boolean(studentProfile?._id),
  });
  const rows = historyQuery.data?.data || [];

  if (detailQuery.isLoading || historyQuery.isLoading) return <LoadingState label="Loading bill history..." />;
  if (detailQuery.isError || historyQuery.isError) {
    return (
      <ErrorState
        description="Unable to load your bill history."
        onRetry={() => {
          detailQuery.refetch();
          historyQuery.refetch();
        }}
      />
    );
  }

  const bill = detailQuery.data?.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Bills"
        title="Monthly bill detail"
        description="Review a selected month with full charge and status detail."
        action={
          <div className="w-full max-w-sm">
            <MonthPicker value={month} onChange={setMonth} />
          </div>
        }
      />

      {bill ? (
        <BillCard bill={bill} onDownload={() => downloadBill(studentProfile._id, month)} />
      ) : (
        <div className="panel p-6 text-sm text-slate-500">No bill was found for the selected month.</div>
      )}

      <DataTable
        rows={rows}
        columns={[
          { key: "month", label: "Month" },
          { key: "total_amount", label: "Bill", render: (row) => formatCurrency(row.total_amount) },
          { key: "absent_days", label: "Absent Days", render: (row) => Number(row.absent_days || 0) },
          { key: "absence_deduction", label: "Absent Reduction", render: (row) => formatCurrency(row.absence_deduction || 0) },
          { key: "fine", label: "Fine", render: (row) => formatCurrency(row.fine || 0) },
          { key: "amount_paid", label: "Paid", render: (row) => formatCurrency(row.amount_paid || 0) },
          { key: "payment_status", label: "Status", render: (row) => <StatusBadge value={row.payment_status} /> },
        ]}
        emptyMessage="No historical bills available yet."
      />
      <Pagination
        page={historyQuery.data?.pagination?.page}
        totalPages={historyQuery.data?.pagination?.totalPages}
        onPageChange={setPage}
      />
    </div>
  );
}
