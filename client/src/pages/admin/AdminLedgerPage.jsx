import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { hostelApi } from "../../api/hostelApi";
import { ledgerApi } from "../../api/ledgerApi";
import { DataTable } from "../../components/common/DataTable";
import { ErrorState } from "../../components/common/ErrorState";
import { LoadingState } from "../../components/common/LoadingState";
import { MonthPicker } from "../../components/common/MonthPicker";
import { PageHeader } from "../../components/common/PageHeader";
import { Pagination } from "../../components/common/Pagination";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Select";
import { useAuthStore } from "../../store/authStore";
import { CURRENT_MONTH } from "../../utils/constants";
import { formatCurrency } from "../../utils/formatters";

export function AdminLedgerPage() {
  const user = useAuthStore((state) => state.user);
  const [month, setMonth] = useState(CURRENT_MONTH);
  const [hostelId, setHostelId] = useState("");
  const [page, setPage] = useState(1);
  const effectiveHostelId = hostelId || user?.hostelId?._id || user?.hostelId?.id || "";

  const hostelsQuery = useQuery({
    queryKey: ["ledger-hostels-page"],
    queryFn: hostelApi.list,
    enabled: user?.role === "admin",
  });
  const ledgerQuery = useQuery({
    queryKey: ["ledger-page", month, effectiveHostelId, page],
    queryFn: () => ledgerApi.list(month, { ...(effectiveHostelId ? { hostelId: effectiveHostelId } : {}), page, limit: 8 }),
  });

  const mutation = useMutation({
    mutationFn: () => ledgerApi.create(month, { hostelId: effectiveHostelId }),
    onSuccess: () => {
      toast.success("Ledger created.");
      ledgerQuery.refetch();
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Unable to create ledger."),
  });

  if ((user?.role === "admin" && hostelsQuery.isLoading) || ledgerQuery.isLoading) return <LoadingState label="Loading ledgers..." />;
  if ((user?.role === "admin" && hostelsQuery.isError) || ledgerQuery.isError) return <ErrorState description="Unable to load ledgers." onRetry={() => {
    if (user?.role === "admin") hostelsQuery.refetch();
    ledgerQuery.refetch();
  }} />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Ledger"
        title="Ledger insights"
        description="Review opening, closing, outstanding, and collection balances across hostels."
        action={
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <MonthPicker value={month} onChange={setMonth} />
            </div>
            {user?.role === "admin" ? (
              <div>
                <label className="field-label">Hostel</label>
                <Select value={hostelId} onChange={(event) => setHostelId(event.target.value)}>
                  <option value="">All hostels</option>
                  {(hostelsQuery.data?.data || []).map((hostel) => (
                    <option key={hostel._id} value={hostel._id}>
                      {hostel.name}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
            {user?.role === "admin" ? (
              <div className="self-end">
                <Button onClick={() => mutation.mutate()} loading={mutation.isPending} disabled={!effectiveHostelId}>
                  Create ledger
                </Button>
              </div>
            ) : null}
          </div>
        }
      />

      <DataTable
        rows={ledgerQuery.data?.data || []}
        columns={[
          { key: "month", label: "Month" },
          { key: "hostel", label: "Hostel", render: (row) => row.hostelId?.name || "-" },
          { key: "openingBalance", label: "Opening", render: (row) => formatCurrency(row.openingBalance) },
          { key: "totalExpenses", label: "Expenses", render: (row) => formatCurrency(row.totalExpenses) },
          { key: "totalCollected", label: "Collected", render: (row) => formatCurrency(row.totalCollected) },
          { key: "closingBalance", label: "Closing", render: (row) => formatCurrency(row.closingBalance) },
          { key: "outstanding", label: "Outstanding", render: (row) => formatCurrency(row.outstanding) },
        ]}
      />
      <Pagination
        page={ledgerQuery.data?.pagination?.page}
        totalPages={ledgerQuery.data?.pagination?.totalPages}
        onPageChange={setPage}
      />
    </div>
  );
}
