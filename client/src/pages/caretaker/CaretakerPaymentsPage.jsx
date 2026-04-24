import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { billApi } from "../../api/billApi";
import { paymentApi } from "../../api/paymentApi";
import { DataTable } from "../../components/common/DataTable";
import { ErrorState } from "../../components/common/ErrorState";
import { LoadingState } from "../../components/common/LoadingState";
import { MonthPicker } from "../../components/common/MonthPicker";
import { PageHeader } from "../../components/common/PageHeader";
import { SearchField } from "../../components/common/SearchField";
import { StatusBadge } from "../../components/common/StatusBadge";
import { Pagination } from "../../components/common/Pagination";
import { PaymentForm } from "../../features/caretaker/PaymentForm";
import { useDebounce } from "../../hooks/useDebounce";
import { CURRENT_MONTH } from "../../utils/constants";
import { formatCurrency, formatDate } from "../../utils/formatters";

export function CaretakerPaymentsPage() {
  const [month, setMonth] = useState(CURRENT_MONTH);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [billPage, setBillPage] = useState(1);
  const debouncedSearch = useDebounce(search);

  useEffect(() => {
    setBillPage(1);
  }, [month, debouncedSearch]);

  const billsQuery = useQuery({
    queryKey: ["caretaker-payment-bills-page", month],
    queryFn: () => billApi.getBillsByMonth(month, { page: 1, limit: 500 }),
  });
  const paymentsQuery = useQuery({
    queryKey: ["caretaker-payment-history-page", month, page],
    queryFn: () => paymentApi.list({ month, page, limit: 8 }),
  });

  const mutation = useMutation({
    mutationFn: paymentApi.create,
    onSuccess: () => {
      toast.success("Payment recorded.");
      billsQuery.refetch();
      paymentsQuery.refetch();
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Unable to record payment."),
  });

  const filteredBills = useMemo(() => {
    const rows = [...(billsQuery.data?.data || [])];

    const getStudentSortValue = (row) => {
      const studentCode = row?.studentId?.studentId || "";
      const numericPart = studentCode.match(/\d+$/)?.[0];

      if (numericPart) {
        return Number.parseInt(numericPart, 10);
      }

      return Number.MAX_SAFE_INTEGER;
    };

    const sortedRows = rows.sort((a, b) => {
      const byNumericId = getStudentSortValue(a) - getStudentSortValue(b);
      if (byNumericId !== 0) {
        return byNumericId;
      }

      return (a?.studentId?.studentId || "").localeCompare(b?.studentId?.studentId || "");
    });

    if (!debouncedSearch) return sortedRows;
    return sortedRows.filter((row) =>
      `${row.studentId?.studentId || ""} ${row.userId?.name || ""}`.toLowerCase().includes(debouncedSearch.toLowerCase())
    );
  }, [billsQuery.data?.data, debouncedSearch]);

  const pagedBills = useMemo(() => {
    const startIndex = (billPage - 1) * 25;
    return filteredBills.slice(startIndex, startIndex + 25);
  }, [billPage, filteredBills]);

  const billTotalPages = Math.ceil(filteredBills.length / 25);
  const visibleBillStart = pagedBills.length > 0 ? (billPage - 1) * 25 + 1 : 0;
  const visibleBillEnd = pagedBills.length > 0 ? (billPage - 1) * 25 + pagedBills.length : 0;
  const paymentPagination = paymentsQuery.data?.pagination;
  const visiblePaymentStart =
    (paymentsQuery.data?.data || []).length > 0 && paymentPagination
      ? (paymentPagination.page - 1) * paymentPagination.limit + 1
      : 0;
  const visiblePaymentEnd =
    (paymentsQuery.data?.data || []).length > 0 && paymentPagination
      ? Math.min(
          (paymentPagination.page - 1) * paymentPagination.limit + (paymentsQuery.data?.data || []).length,
          paymentPagination.total
        )
      : 0;

  if (billsQuery.isLoading || paymentsQuery.isLoading) return <LoadingState label="Loading payment workspace..." />;
  if (billsQuery.isError || paymentsQuery.isError) return <ErrorState description="Unable to load payment workspace." onRetry={() => {
    billsQuery.refetch();
    paymentsQuery.refetch();
  }} />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Payments"
        title="Collection panel"
        // description="Select a student, verify the full bill amount, and record UPI collections for the current hostel."
        action={
          <div className="grid w-full max-w-3xl gap-4 md:grid-cols-[0.3fr_0.7fr]">
            <div>
            <MonthPicker value={month} onChange={setMonth} />
            </div>
            <div>
              <label className="field-label">Search bill list</label>
              <SearchField value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search student id or name" />
            </div>
          </div>
        }
      />

      <PaymentForm bills={filteredBills} onSubmit={(payload) => mutation.mutate(payload)} loading={mutation.isPending} />

      {filteredBills.length ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            Showing <span className="font-semibold text-slate-800">{visibleBillStart}</span>
            {" - "}
            <span className="font-semibold text-slate-800">{visibleBillEnd}</span>
            {" of "}
            <span className="font-semibold text-slate-800">{filteredBills.length}</span> bills
          </p>
          <Pagination
            page={billPage}
            totalPages={billTotalPages}
            onPageChange={setBillPage}
          />
        </div>
      ) : null}

      <DataTable
        rows={pagedBills}
        columns={[
          { key: "student", label: "Student", render: (row) => row.studentId?.studentId || "-" },
          { key: "name", label: "Name", render: (row) => row.userId?.name || "-" },
          { key: "payable", label: "Payable", render: (row) => formatCurrency((row.total_amount || 0) + (row.fine || 0)) },
          { key: "amount_paid", label: "Paid", render: (row) => formatCurrency(row.amount_paid || 0) },
          { key: "due_date", label: "Due Date", render: (row) => formatDate(row.due_date) },
          { key: "student_payment_made_date", label: "Student Date", render: (row) => formatDate(row.student_payment_made_date) },
          {
            key: "student_utr_number",
            label: "Student UTR",
            render: (row) => row.student_utr_number?.trim() || "UTR not updated by student",
          },
          { key: "payment_status", label: "Status", render: (row) => <StatusBadge value={row.payment_status} /> },
          { key: "_id", label: "Bill ID", render: (row) => <span className="font-mono text-xs">{row._id}</span> },
        ]}
        emptyMessage={`No bills found for ${month}.`}
      />

      <DataTable
        rows={paymentsQuery.data?.data || []}
        columns={[
          { key: "month", label: "Month" },
          { key: "student", label: "Student", render: (row) => row.studentId?.studentId || "-" },
          { key: "amount", label: "Amount", render: (row) => formatCurrency(row.amount) },
          { key: "paymentMethod", label: "Method" },
          { key: "paymentMadeDate", label: "Payment Made", render: (row) => formatDate(row.paymentMadeDate) },
          { key: "utrNumber", label: "UTR", render: (row) => row.utrNumber || "UTR not updated by student" },
          { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
          { key: "verifiedAt", label: "Verified", render: (row) => formatDate(row.verifiedAt) },
        ]}
      />
      {paymentPagination?.total ? (
        <p className="text-sm text-slate-500">
          Showing <span className="font-semibold text-slate-800">{visiblePaymentStart}</span>
          {" - "}
          <span className="font-semibold text-slate-800">{visiblePaymentEnd}</span>
          {" of "}
          <span className="font-semibold text-slate-800">{paymentPagination.total}</span> payments
        </p>
      ) : null}
      <Pagination
        page={paymentPagination?.page}
        totalPages={paymentPagination?.totalPages}
        onPageChange={setPage}
      />
    </div>
  );
}
