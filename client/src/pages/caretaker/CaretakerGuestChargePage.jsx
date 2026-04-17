import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { guestChargeApi } from "../../api/guestChargeApi";
import { DataTable } from "../../components/common/DataTable";
import { ErrorState } from "../../components/common/ErrorState";
import { LoadingState } from "../../components/common/LoadingState";
import { MonthPicker } from "../../components/common/MonthPicker";
import { PageHeader } from "../../components/common/PageHeader";
import { StatCard } from "../../components/common/StatCard";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { CURRENT_MONTH } from "../../utils/constants";
import { formatCurrency } from "../../utils/formatters";

const defaultValues = (month) => ({
  month,
  event_name: "",
  event_start_date: "",
  event_end_date: "",
  guest_count: "",
  amount: "",
});

const formatDateInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

export function CaretakerGuestChargePage() {
  const [month, setMonth] = useState(CURRENT_MONTH);
  const [editingCharge, setEditingCharge] = useState(null);
  const { register, handleSubmit, reset } = useForm({ defaultValues: defaultValues(month) });

  const query = useQuery({
    queryKey: ["caretaker-guest-charges", month],
    queryFn: () => guestChargeApi.list(month),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const rows = query.data?.data || [];
  const totalAmount = query.data?.totalAmount || 0;
  const totalGuests = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.guest_count || 0), 0),
    [rows]
  );

  const createMutation = useMutation({
    mutationFn: guestChargeApi.create,
    onSuccess: () => {
      toast.success("Guest charge added.");
      reset(defaultValues(month));
      query.refetch();
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Unable to add guest charge."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ guestChargeId, payload }) => guestChargeApi.update(guestChargeId, payload),
    onSuccess: () => {
      toast.success("Guest charge updated.");
      setEditingCharge(null);
      reset(defaultValues(month));
      query.refetch();
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Unable to update guest charge."),
  });

  const deleteMutation = useMutation({
    mutationFn: guestChargeApi.remove,
    onSuccess: () => {
      toast.success("Guest charge deleted.");
      setEditingCharge(null);
      reset(defaultValues(month));
      query.refetch();
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Unable to delete guest charge."),
  });

  if (query.isLoading) return <LoadingState label="Loading guest charge manager..." />;
  if (query.isError) return <ErrorState description="Unable to load guest charges." onRetry={query.refetch} />;

  const onSubmit = (values) => {
    const payload = {
      month,
      event_name: values.event_name,
      event_start_date: values.event_start_date,
      event_end_date: values.event_end_date,
      guest_count: Number(values.guest_count || 0),
      amount: Number(values.amount || 0),
    };

    if (editingCharge?._id) {
      updateMutation.mutate({ guestChargeId: editingCharge._id, payload });
      return;
    }

    createMutation.mutate(payload);
  };

  const startEdit = (row) => {
    setEditingCharge(row);
    reset({
      month,
      event_name: row.event_name || "",
      event_start_date: formatDateInput(row.event_start_date),
      event_end_date: formatDateInput(row.event_end_date),
      guest_count: row.guest_count ?? "",
      amount: row.amount ?? "",
    });
  };

  const cancelEdit = () => {
    setEditingCharge(null);
    reset(defaultValues(month));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Guest Charge"
        title="Monthly guest charge tracker"
        // description="Add each guest event for the month, keep a running monthly total, and feed that total directly into the expenditure report."
        action={
          <div className="w-full max-w-sm">
            <MonthPicker value={month} onChange={(nextMonth) => {
              setMonth(nextMonth);
              setEditingCharge(null);
              reset(defaultValues(nextMonth));
            }} />
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Events This Month" value={rows.length} type="number" />
        <StatCard label="Guests Counted" value={totalGuests} type="number" tone="mint" />
        <StatCard label="Guest Charge Total" value={totalAmount} tone="coral" />
      </div>

      <div className="panel space-y-5 p-6">
        <div>
          <h3 className="section-title">{editingCharge ? "Edit guest charge" : "Add guest charge"}</h3>
          {/* <p className="mt-2 text-sm text-slate-500">
            Add as many guest events as needed in a month. The monthly expenditure report will use the summed total automatically.
          </p> */}
        </div>

        <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-5" onSubmit={handleSubmit(onSubmit)}>
          <div className="xl:col-span-2">
            <label className="field-label">Event Name</label>
            <Input placeholder="College event / function name" {...register("event_name")} />
          </div>
          <div>
            <label className="field-label">Start Date</label>
            <Input type="date" {...register("event_start_date")} />
          </div>
          <div>
            <label className="field-label">End Date</label>
            <Input type="date" {...register("event_end_date")} />
          </div>
          <div>
            <label className="field-label">No. of Guests</label>
            <Input type="number" min="0" step="1" {...register("guest_count")} />
          </div>
          <div>
            <label className="field-label">Amount</label>
            <Input type="number" min="0" step="0.01" {...register("amount")} />
          </div>
          <div className="flex items-end gap-3 md:col-span-2 xl:col-span-2">
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
              {editingCharge ? "Update guest charge" : "Add guest charge"}
            </Button>
            {editingCharge ? (
              <Button type="button" variant="ghost" onClick={cancelEdit}>
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
      </div>

      <DataTable
        rows={rows}
        columns={[
          { key: "event_name", label: "Event Name" },
          {
            key: "duration",
            label: "Event Duration",
            render: (row) => `${formatDateInput(row.event_start_date)} to ${formatDateInput(row.event_end_date)}`,
          },
          { key: "guest_count", label: "Guests", render: (row) => row.guest_count || 0 },
          { key: "amount", label: "Amount", render: (row) => formatCurrency(row.amount || 0) },
          {
            key: "actions",
            label: "Actions",
            render: (row) => (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => startEdit(row)}>
                  Edit
                </Button>
                <Button variant="danger" size="sm" onClick={() => deleteMutation.mutate(row._id)}>
                  Delete
                </Button>
              </div>
            ),
          },
        ]}
        emptyMessage="No guest charges added for this month yet."
      />
    </div>
  );
}
