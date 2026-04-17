import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { billApi } from "../../api/billApi";
import { DataTable } from "../../components/common/DataTable";
import { ErrorState } from "../../components/common/ErrorState";
import { LoadingState } from "../../components/common/LoadingState";
import { MonthPicker } from "../../components/common/MonthPicker";
import { PageHeader } from "../../components/common/PageHeader";
import { Pagination } from "../../components/common/Pagination";
import { StatusBadge } from "../../components/common/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { CURRENT_MONTH } from "../../utils/constants";
import { formatCurrency, formatDate } from "../../utils/formatters";

const toDateInputValue = (value) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 10);
};

export function CaretakerBillsPage() {
  const [month, setMonth] = useState(CURRENT_MONTH);
  const [page, setPage] = useState(1);
  const [dueDate, setDueDate] = useState("");
  const [announcementDate, setAnnouncementDate] = useState("");

  useEffect(() => {
    setPage(1);
  }, [month]);

  const query = useQuery({
    queryKey: ["caretaker-bills-page", month, page],
    queryFn: () => billApi.getBillsByMonth(month, { page, limit: 25 }),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const billConfigQuery = useQuery({
    queryKey: ["caretaker-bill-config", month],
    queryFn: () => billApi.getBillConfig(month),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const mutation = useMutation({
    mutationFn: () => billApi.generateBills(month),
    onSuccess: () => {
      toast.success("Bills generated.");
      query.refetch();
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Unable to generate bills."),
  });
  const saveConfigMutation = useMutation({
    mutationFn: () =>
      billApi.updateBillConfig(month, {
        dueDate: dueDate || null,
        announcementDate: announcementDate || null,
      }),
    onSuccess: () => {
      toast.success("Billing dates saved.");
      billConfigQuery.refetch();
      query.refetch();
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Unable to save billing dates."),
  });

  useEffect(() => {
    setDueDate(toDateInputValue(billConfigQuery.data?.data?.dueDate));
    setAnnouncementDate(toDateInputValue(billConfigQuery.data?.data?.announcementDate));
  }, [billConfigQuery.data?.data?.announcementDate, billConfigQuery.data?.data?.dueDate]);

  const sortedBills = useMemo(() => {
    const rows = [...(query.data?.data || [])];

    const getStudentSortValue = (row) => {
      const studentCode = row?.studentId?.studentId || "";
      const numericPart = studentCode.match(/\d+$/)?.[0];

      if (numericPart) {
        return Number.parseInt(numericPart, 10);
      }

      return Number.MAX_SAFE_INTEGER;
    };

    return rows.sort((a, b) => {
      const byNumericId = getStudentSortValue(a) - getStudentSortValue(b);
      if (byNumericId !== 0) {
        return byNumericId;
      }

      return (a?.studentId?.studentId || "").localeCompare(b?.studentId?.studentId || "");
    });
  }, [query.data?.data]);

  const billPagination = query.data?.pagination;
  const visibleBillStart =
    sortedBills.length > 0 && billPagination
      ? (billPagination.page - 1) * billPagination.limit + 1
      : 0;
  const visibleBillEnd =
    sortedBills.length > 0 && billPagination
      ? Math.min((billPagination.page - 1) * billPagination.limit + sortedBills.length, billPagination.total)
      : 0;

  if (query.isLoading || billConfigQuery.isLoading) return <LoadingState label="Loading bills..." />;
  if (query.isError || billConfigQuery.isError) {
    return <ErrorState description="Unable to load monthly bills." onRetry={() => {
      query.refetch();
      billConfigQuery.refetch();
    }} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Bills"
        title="Bills management"
        description="Set the bill announcement and due date here, then review the live fine and payment status for the month."
        action={
          <div className="flex w-full max-w-md gap-3">
            <div className="flex-1">
              <MonthPicker value={month} onChange={setMonth} />
            </div>
            <div className="self-end">
              <Button onClick={() => mutation.mutate()} loading={mutation.isPending}>
                Generate bills
              </Button>
            </div>
          </div>
        }
      />

      <div className="panel p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="flex-1">
            <label className="field-label">Mess Bill Announcement Date</label>
            <Input type="date" value={announcementDate} onChange={(event) => setAnnouncementDate(event.target.value)} />
          </div>
          <div className="flex-1">
            <label className="field-label">Bill Due Date</label>
            <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </div>
          <div>
            <Button type="button" onClick={() => saveConfigMutation.mutate()} loading={saveConfigMutation.isPending}>
              Save dates
            </Button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="panel-soft p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Current announcement</p>
            <p className="mt-2 text-lg font-semibold text-slate-800">{formatDate(billConfigQuery.data?.data?.announcementDate)}</p>
          </div>
          <div className="panel-soft p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Current due date</p>
            <p className="mt-2 text-lg font-semibold text-slate-800">{formatDate(billConfigQuery.data?.data?.dueDate)}</p>
          </div>
        </div>
      </div>

      {billPagination?.total ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            Showing <span className="font-semibold text-slate-800">{visibleBillStart}</span>
            {" - "}
            <span className="font-semibold text-slate-800">{visibleBillEnd}</span>
            {" of "}
            <span className="font-semibold text-slate-800">{billPagination.total}</span> bills
          </p>
          <Pagination
            page={billPagination?.page}
            totalPages={billPagination?.totalPages}
            onPageChange={setPage}
          />
        </div>
      ) : null}

      <DataTable
        rows={sortedBills}
        columns={[
          { key: "month", label: "Month" },
          { key: "student", label: "Student", render: (row) => row.studentId?.studentId || "-" },
          { key: "name", label: "Name", render: (row) => row.userId?.name || "-" },
          { key: "total_amount", label: "Amount", render: (row) => formatCurrency(row.total_amount) },
          { key: "fine", label: "Fine", render: (row) => formatCurrency(row.fine || 0) },
          { key: "announcement_date", label: "Announcement", render: (row) => formatDate(row.announcement_date) },
          { key: "due_date", label: "Due Date", render: (row) => formatDate(row.due_date) },
          { key: "payment_status", label: "Status", render: (row) => <StatusBadge value={row.payment_status} /> },
        ]}
        emptyMessage={`No bills found for ${month}.`}
      />
    </div>
  );
}
