import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { chargeApi } from "../../api/chargeApi";
import { DataTable } from "../../components/common/DataTable";
import { ErrorState } from "../../components/common/ErrorState";
import { LoadingState } from "../../components/common/LoadingState";
import { MonthPicker } from "../../components/common/MonthPicker";
import { PageHeader } from "../../components/common/PageHeader";
import { ChargeForm } from "../../features/caretaker/ChargeForm";
import { CURRENT_MONTH } from "../../utils/constants";
import { formatCurrency } from "../../utils/formatters";
import { Button } from "../../components/ui/Button";

export function CaretakerChargesPage() {
  const [month, setMonth] = useState(CURRENT_MONTH);
  const [editingCharge, setEditingCharge] = useState(null);
  const query = useQuery({
    queryKey: ["caretaker-charges-page", month],
    queryFn: () => chargeApi.list(month),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const createMutation = useMutation({
    mutationFn: chargeApi.create,
    onSuccess: () => {
      toast.success("Charge added.");
      query.refetch();
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Unable to add charge."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ chargeId, payload }) => chargeApi.update(chargeId, payload),
    onSuccess: () => {
      toast.success("Charge updated.");
      setEditingCharge(null);
      query.refetch();
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Unable to update charge."),
  });

  const deleteMutation = useMutation({
    mutationFn: chargeApi.remove,
    onSuccess: () => {
      toast.success("Charge deleted.");
      setEditingCharge(null);
      query.refetch();
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Unable to delete charge."),
  });

  if (query.isLoading) return <LoadingState label="Loading charge manager..." />;
  if (query.isError) return <ErrorState description="Unable to load charges." onRetry={query.refetch} />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Charges"
        title="Static charges"
        // description="Create and remove monthly hostel charges that feed directly into billing."
        action={
          <div className="w-full max-w-sm">
            <MonthPicker value={month} onChange={setMonth} />
          </div>
        }
      />

      <ChargeForm
        initialValues={editingCharge}
        onCancel={() => setEditingCharge(null)}
        onSubmit={(payload) => {
          if (editingCharge?._id) {
            updateMutation.mutate({ chargeId: editingCharge._id, payload });
            return;
          }

          createMutation.mutate(payload);
        }}
        loading={createMutation.isPending || updateMutation.isPending}
        defaultMonth={month}
      />

      <DataTable
        rows={query.data?.data || []}
        columns={[
          { key: "title", label: "Static Charge" },
          { key: "month", label: "Month" },
          { key: "amount", label: "Amount", render: (row) => formatCurrency(row.amount) },
          { key: "hostel", label: "Hostel", render: (row) => row.hostelId?.name || "-" },
          {
            key: "actions",
            label: "Actions",
            render: (row) => (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditingCharge(row)}>
                  Edit
                </Button>
                <Button variant="danger" size="sm" onClick={() => deleteMutation.mutate(row._id)}>
                  Delete
                </Button>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
