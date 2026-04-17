import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Coins, FileStack, Wallet } from "lucide-react";
import toast from "react-hot-toast";

import { expenseApi } from "../../api/expenseApi";
import { hostelApi } from "../../api/hostelApi";
import { DataTable } from "../../components/common/DataTable";
import { ErrorState } from "../../components/common/ErrorState";
import { LoadingState } from "../../components/common/LoadingState";
import { MonthPicker } from "../../components/common/MonthPicker";
import { PageHeader } from "../../components/common/PageHeader";
import { StatCard } from "../../components/common/StatCard";
import { Select } from "../../components/ui/Select";
import { ExpenseForm } from "../../features/caretaker/ExpenseForm";
import { useAuthStore } from "../../store/authStore";
import { CURRENT_MONTH } from "../../utils/constants";
import { formatCurrency } from "../../utils/formatters";

const getHostelId = (value) => value?._id || value || "";

export function ExpenseManagementPage({ mode = "caretaker" }) {
  const user = useAuthStore((state) => state.user);
  const isCaretaker = mode === "caretaker";
  const [month, setMonth] = useState(CURRENT_MONTH);
  const [selectedHostelId, setSelectedHostelId] = useState("");
  const [expenseOverride, setExpenseOverride] = useState(null);

  const scopedHostelId = isCaretaker ? getHostelId(user?.hostelId) : selectedHostelId;

  useEffect(() => {
    setExpenseOverride(null);
  }, [month, scopedHostelId]);

  const sourceQuery = useQuery({
    queryKey: ["expense-source", mode, month, scopedHostelId],
    queryFn: () => expenseApi.getSource(month, { hostelId: scopedHostelId || undefined }),
    enabled: Boolean(month && (isCaretaker || scopedHostelId)),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: false,
  });

  const expenseQuery = useQuery({
    queryKey: ["expense-management", mode, month, scopedHostelId],
    queryFn: () => expenseApi.listByMonth(month, { hostelId: scopedHostelId || undefined }),
    enabled: Boolean(month),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const hostelQuery = useQuery({
    queryKey: ["expense-hostels", mode],
    queryFn: hostelApi.list,
    enabled: !isCaretaker,
    refetchOnMount: "always",
  });

  const refetchAll = () => {
    sourceQuery.refetch();
    expenseQuery.refetch();
    hostelQuery.refetch();
  };

  const createMutation = useMutation({
    mutationFn: expenseApi.create,
    onSuccess: (response) => {
      setExpenseOverride(response?.expense || null);
      toast.success("Expense snapshot created.");
      sourceQuery.refetch();
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Unable to create expense snapshot."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => expenseApi.update(id, payload),
    onSuccess: (response) => {
      setExpenseOverride(response?.expense || null);
      toast.success("Expense snapshot updated.");
      sourceQuery.refetch();
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Unable to update expense snapshot."),
  });

  const deleteMutation = useMutation({
    mutationFn: expenseApi.remove,
    onSuccess: () => {
      setExpenseOverride(null);
      toast.success("Expense snapshot deleted.");
      refetchAll();
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Unable to delete expense snapshot."),
  });

  const expenses = useMemo(() => {
    if (expenseOverride?._id) {
      return [expenseOverride];
    }

    return expenseQuery.data?.expenses || [];
  }, [expenseOverride, expenseQuery.data?.expenses]);
  const hostels = hostelQuery.data?.data || [];
  const source = sourceQuery.data?.data || null;
  const currentExpense = useMemo(() => expenses[0] || source?.existingExpense || null, [expenses, source?.existingExpense]);
  const values = source?.values || null;
  const sourceErrorMessage = sourceQuery.error?.response?.data?.message || "";
  const sourceMissing = sourceQuery.isError && sourceQuery.error?.response?.status === 404;

  const summary = useMemo(() => {
    if (!values) {
      return {
        baseExpenses: 0,
        staticCharges: 0,
        effectiveTotal: 0,
      };
    }

    const baseExpenses =
      Number(values.mess_bill_total || 0) +
      Number(values.egg_total || 0) +
      Number(values.banana_bakery_total || 0) +
      Number(values.paneer_total || 0) +
      Number(values.milk_total || 0) +
      Number(values.chicken_total || 0) +
      Number(values.labour_combined_total || 0) +
      Number(values.keb_total || 0);

    return {
      baseExpenses,
      staticCharges: Number(values.dynamic_charge_total || 0),
      effectiveTotal: baseExpenses + Number(values.dynamic_charge_total || 0),
    };
  }, [values]);

  if (expenseQuery.isLoading || hostelQuery.isLoading || sourceQuery.isLoading) {
    return <LoadingState label="Loading expense manager..." />;
  }

  if ((!isCaretaker && expenseQuery.isError) || hostelQuery.isError) {
    return <ErrorState description="Unable to load expense data." onRetry={refetchAll} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Expenses"
        title={isCaretaker ? "Monthly Expenses Overview" : "Expense oversight"}
        // description={
        //   isCaretaker
        //     ? "Review the billing-ready monthly expense snapshot built from hostel expense, monthly expenditure report, static charges, and student consumption."
        //     : "Review the complete monthly hostel billing snapshot without editing the underlying derived values."
        // }
        action={
          <div className="flex w-full max-w-2xl gap-3">
            <div className="flex-1">
              <MonthPicker value={month} onChange={setMonth} />
            </div>
            {!isCaretaker ? (
              <div className="flex-1">
                <label className="field-label">Hostel</label>
                <Select value={selectedHostelId} onChange={(event) => setSelectedHostelId(event.target.value)}>
                  <option value="">Select hostel</option>
                  {hostels.map((hostel) => (
                    <option key={hostel._id} value={hostel._id}>
                      {hostel.name}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <StatCard label="Base expense total" value={summary.baseExpenses} tone="brand" icon={FileStack} />
        <StatCard label="Static charges" value={summary.staticCharges} tone="coral" icon={Coins} />
        <StatCard label="Effective monthly total" value={summary.effectiveTotal} tone="mint" icon={Wallet} />
      </div>

      {isCaretaker && expenseQuery.isError ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          The expense snapshot was saved, but the background reload did not complete. You can continue working on the current sheet and refresh after restarting the backend if needed.
        </div>
      ) : null}

      {isCaretaker ? (
        sourceQuery.isError && !sourceMissing ? (
          <ErrorState description={sourceErrorMessage || "Unable to load monthly expense source."} onRetry={() => sourceQuery.refetch()} />
        ) : (
          <div className="space-y-4">
            {sourceMissing ? (
              <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                {sourceErrorMessage || `No hostel expense sheet exists for ${month} yet. Start from Hostel Expense, save that monthly sheet, generate the total monthly expenditure report, then come back here to create the billing expense snapshot.`}
              </div>
            ) : null}
            <ExpenseForm
              month={month}
              source={source}
              existingExpense={currentExpense}
              loading={createMutation.isPending || updateMutation.isPending}
              onCancel={() => {}}
              onSubmit={() => {
                const hostelId = getHostelId(user?.hostelId);
                if (currentExpense?._id) {
                  updateMutation.mutate({ id: currentExpense._id, payload: { month, hostelId } });
                  return;
                }

                createMutation.mutate({ month, hostelId });
              }}
            />
          </div>
        )
      ) : null}

      <DataTable
        rows={expenses}
        columns={[
          { key: "month", label: "Month" },
          { key: "hostel", label: "Hostel", render: (row) => row.hostelId?.name || "-" },
          { key: "mess_bill_total", label: "Mess Bill", render: (row) => formatCurrency(row.mess_bill_total) },
          { key: "milk_total", label: "Milk", render: (row) => formatCurrency(row.milk_total) },
          { key: "banana_bakery_total", label: "Banana / Bakery", render: (row) => formatCurrency(row.banana_bakery_total) },
          { key: "labour_total", label: "Labour", render: (row) => formatCurrency(Number(row.labour_total || 0) + Number(row.night_watch_total || 0)) },
          { key: "keb_total", label: "Electric", render: (row) => formatCurrency(row.keb_total) },
          { key: "dynamic_charge_total", label: "Static Charges", render: (row) => formatCurrency(row.dynamic_charge_total) },
          {
            key: "actions",
            label: "Actions",
            render: (row) =>
              isCaretaker ? (
                <button
                  type="button"
                  className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                  onClick={() => deleteMutation.mutate(row._id)}
                >
                  Delete
                </button>
              ) : (
                "-"
              ),
          },
        ]}
        emptyMessage="No expense snapshot found for the selected filters."
      />
    </div>
  );
}
