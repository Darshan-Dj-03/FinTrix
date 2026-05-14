import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

import { advanceApi } from "../../api/advanceApi";
import { studentApi } from "../../api/studentApi";
import { DataTable } from "../../components/common/DataTable";
import { ErrorState } from "../../components/common/ErrorState";
import { LoadingState } from "../../components/common/LoadingState";
import { MonthPicker } from "../../components/common/MonthPicker";
import { PageHeader } from "../../components/common/PageHeader";
import { StatCard } from "../../components/common/StatCard";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { useAuthStore } from "../../store/authStore";
import { CURRENT_MONTH } from "../../utils/constants";
import { formatCurrency, formatDate } from "../../utils/formatters";

const defaultValues = {
  prefectStudentId: "",
  takenAmount: "",
  chequeDetails: "",
  billDate: "",
};

const createEmptySettlement = () => ({
  amount: "",
  settlementDate: "",
  paymentMode: "",
  utrNumber: "",
  notes: "",
  isLegacyImported: false,
});

const formatDateInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const normalizeSettlementRowsForForm = (advance) => {
  const settlements = (advance?.settlements || []).map((row) => ({
    amount: row.amount ?? "",
    settlementDate: formatDateInput(row.settlementDate),
    paymentMode: row.paymentMode || "",
    utrNumber: row.utrNumber || "",
    notes: row.notes || "",
    recordedBy: row.recordedBy || null,
    isLegacyImported: false,
  }));

  if (settlements.length) {
    return settlements;
  }

  if (Number(advance?.closedAmount || 0) > 0) {
    return [
      {
        amount: advance.closedAmount ?? "",
        settlementDate: formatDateInput(advance.billDates?.[0]?.billDate || advance.updatedAt || advance.createdAt),
        paymentMode: "",
        utrNumber: "",
        notes: "Existing settled amount from previous record",
        recordedBy: advance.createdBy || null,
        isLegacyImported: true,
      },
    ];
  }

  return [];
};

const resolveSettlementPaymentMode = (row) => {
  const paymentMode = String(row?.paymentMode || "").trim().toLowerCase();
  if (paymentMode) {
    return paymentMode;
  }

  return String(row?.utrNumber || "").trim() ? "upi" : "";
};

export function CaretakerAdvancesPage() {
  const user = useAuthStore((state) => state.user);
  const [month, setMonth] = useState(CURRENT_MONTH);
  const [editingAdvance, setEditingAdvance] = useState(null);
  const [settlementRows, setSettlementRows] = useState([]);
  const form = useForm({ defaultValues });

  const advancesQuery = useQuery({
    queryKey: ["caretaker-advances", month],
    queryFn: () => advanceApi.list(month),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const studentsQuery = useQuery({
    queryKey: ["caretaker-advance-students"],
    queryFn: studentApi.list,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const studentOptions = useMemo(() => {
    const hostelId = user?.hostelId?._id || user?.hostelId;
    const rows = studentsQuery.data?.students || [];

    return rows
      .filter((student) => {
        const studentHostelId = student.userId?.hostelId?._id || student.userId?.hostelId;
        return !hostelId || String(studentHostelId) === String(hostelId);
      })
      .sort((a, b) =>
        String(a.studentId || "").localeCompare(String(b.studentId || ""), undefined, { numeric: true })
      );
  }, [studentsQuery.data?.students, user?.hostelId]);

  useEffect(() => {
    if (!editingAdvance) {
      form.reset(defaultValues);
      setSettlementRows([]);
      return;
    }

    form.reset({
      prefectStudentId: editingAdvance.prefectStudentId?._id || "",
      takenAmount: editingAdvance.takenAmount ?? "",
      chequeDetails: editingAdvance.chequeDetails || "",
      billDate: formatDateInput(editingAdvance.billDates?.[0]?.billDate),
    });
    setSettlementRows(normalizeSettlementRowsForForm(editingAdvance));
  }, [editingAdvance, form]);

  const createMutation = useMutation({
    mutationFn: advanceApi.create,
    onSuccess: () => {
      toast.success("Advance saved.");
      setEditingAdvance(null);
      form.reset(defaultValues);
      setSettlementRows([]);
      advancesQuery.refetch();
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Unable to save advance."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ advanceId, payload }) => advanceApi.update(advanceId, payload),
    onSuccess: () => {
      toast.success("Advance updated.");
      setEditingAdvance(null);
      form.reset(defaultValues);
      setSettlementRows([]);
      advancesQuery.refetch();
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Unable to update advance."),
  });

  const deleteMutation = useMutation({
    mutationFn: advanceApi.remove,
    onSuccess: () => {
      toast.success("Advance deleted.");
      setEditingAdvance(null);
      form.reset(defaultValues);
      setSettlementRows([]);
      advancesQuery.refetch();
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Unable to delete advance."),
  });

  const updateSettlementRow = (index, field, value) => {
    setSettlementRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row))
    );
  };

  const removeSettlementRow = (index) => {
    setSettlementRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  };

  const resetAdvanceForm = () => {
    setEditingAdvance(null);
    form.reset(defaultValues);
    setSettlementRows([]);
  };

  if (advancesQuery.isLoading || studentsQuery.isLoading) {
    return <LoadingState label="Loading advances..." />;
  }

  if (advancesQuery.isError || studentsQuery.isError) {
    return (
      <ErrorState
        description="Unable to load advances."
        onRetry={() => {
          advancesQuery.refetch();
          studentsQuery.refetch();
        }}
      />
    );
  }

  const rows = advancesQuery.data?.data || [];
  const totalTaken = rows.reduce((sum, row) => sum + Number(row.takenAmount || 0), 0);
  const totalSettled = rows.reduce((sum, row) => sum + Number(row.closedAmount || 0), 0);
  const currentSettlementTotal = settlementRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const currentTakenAmount = Number(form.watch("takenAmount") || 0);
  const remainingBalance = Math.max(currentTakenAmount - currentSettlementTotal, 0);
  const settlementHistoryRows = settlementRows.filter(
    (row) => Number(row.amount || 0) > 0 || row.settlementDate || String(row.notes || "").trim()
  );

  const onSubmit = (values) => {
    const billDates = values.billDate ? [{ billDate: values.billDate }] : [];
    const activeSettlements = settlementRows.filter(
      (row) => row.amount || row.settlementDate || String(row.notes || "").trim()
    );

    if (
      activeSettlements.some(
        (row) => Number(row.amount || 0) <= 0 || !row.settlementDate
      )
    ) {
      toast.error("Each settlement entry needs both a positive amount and a settlement date.");
      return;
    }

    if (
      activeSettlements.some(
        (row) => {
          const paymentMode = resolveSettlementPaymentMode(row);
          return paymentMode && !["cash", "upi"].includes(paymentMode);
        }
      )
    ) {
      toast.error("Settlement payment mode must be either cash or upi.");
      return;
    }

    if (
      activeSettlements.some(
        (row) => resolveSettlementPaymentMode(row) === "upi" && !String(row.utrNumber || "").trim()
      )
    ) {
      toast.error("UTR is required for UPI settlement entries.");
      return;
    }

    const settledAmount = activeSettlements.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const takenAmount = Number(values.takenAmount || 0);
    if (settledAmount > takenAmount) {
      toast.error("Settled amount cannot exceed the taken amount.");
      return;
    }

    const payload = {
      month,
      prefectStudentId: values.prefectStudentId,
      takenAmount,
      chequeDetails: values.chequeDetails.trim(),
      billDates,
      settlements: activeSettlements.map((row) => ({
        paymentMode: resolveSettlementPaymentMode(row),
        amount: Number(row.amount || 0),
        settlementDate: row.settlementDate,
        utrNumber: resolveSettlementPaymentMode(row) === "upi" ? String(row.utrNumber || "").trim() : "",
        notes: String(row.notes || "").trim(),
        isLegacyImported: Boolean(row.isLegacyImported),
      })),
    };

    if (editingAdvance?._id) {
      updateMutation.mutate({ advanceId: editingAdvance._id, payload });
      return;
    }

    createMutation.mutate(payload);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Advances"
        title="Prefect advance tracker"
        action={
          <div className="w-full max-w-sm">
            <MonthPicker
              value={month}
              onChange={(nextMonth) => {
                setMonth(nextMonth);
                resetAdvanceForm();
              }}
            />
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Advance Entries" value={rows.length} type="number" />
        <StatCard label="Taken Amount" value={totalTaken} tone="coral" />
        <StatCard label="Settled Amount" value={totalSettled} tone="mint" />
        <StatCard label="Open Balance" value={Math.max(totalTaken - totalSettled, 0)} />
      </div>

      <form className="panel space-y-6 p-6" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="section-title">{editingAdvance ? "Edit advance" : "Add advance"}</h3>
            <p className="mt-2 text-sm text-slate-500">
              Record the advance amount first, then add each repayment under Advance Settlement.
            </p>
          </div>
          {editingAdvance ? (
            <Button type="button" variant="ghost" onClick={resetAdvanceForm}>
              Cancel
            </Button>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="xl:col-span-2">
            <label className="field-label">Prefect Student</label>
            <Select {...form.register("prefectStudentId", { required: true })}>
              <option value="">Select prefect</option>
              {studentOptions.map((student) => (
                <option key={student._id} value={student._id}>
                  {student.studentId} - {student.userId?.name || "Student"}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="field-label">Taken Amount</label>
            <Input type="number" min="0" step="0.01" {...form.register("takenAmount", { required: true })} />
          </div>
          <div>
            <label className="field-label">Cheque Details</label>
            <Input placeholder="Optional cheque reference" {...form.register("chequeDetails")} />
          </div>
          <div>
            <label className="field-label">Bill Date</label>
            <Input type="date" {...form.register("billDate")} />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h4 className="text-lg font-semibold text-ink">Advance Settlement</h4>
              <p className="mt-1 text-sm text-slate-500">
                Add every repayment made against this advance so the full settlement trail stays visible.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setSettlementRows((current) => [...current, createEmptySettlement()])}
              disabled={currentTakenAmount > 0 && remainingBalance <= 0}
            >
              <Plus size={16} />
              Add settlement
            </Button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Taken amount</p>
              <p className="mt-2 text-lg font-semibold text-ink">{formatCurrency(currentTakenAmount)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Settled amount</p>
              <p className="mt-2 text-lg font-semibold text-ink">{formatCurrency(currentSettlementTotal)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Remaining balance</p>
              <p className="mt-2 text-lg font-semibold text-ink">
                {formatCurrency(remainingBalance)}
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {settlementRows.length ? (
              settlementRows.map((row, index) => (
                <div
                  key={`settlement-${index}`}
                  className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-[0.85fr_0.85fr_0.95fr_1.1fr_1.4fr_auto]"
                >
                  <div>
                    <label className="field-label">Settlement Amount</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.amount}
                      onChange={(event) => updateSettlementRow(index, "amount", event.target.value)}
                    />
                  </div>
                  <div>
                    <label className="field-label">Settlement Date</label>
                    <Input
                      type="date"
                      value={row.settlementDate}
                      onChange={(event) => updateSettlementRow(index, "settlementDate", event.target.value)}
                    />
                  </div>
                  <div>
                    <label className="field-label">Mode of Payment</label>
                    <Select
                      value={row.paymentMode}
                      onChange={(event) => {
                        const nextMode = event.target.value;
                        updateSettlementRow(index, "paymentMode", nextMode);
                        if (nextMode !== "upi") {
                          updateSettlementRow(index, "utrNumber", "");
                        }
                      }}
                    >
                      <option value="">Select mode</option>
                      <option value="cash">Cash</option>
                      <option value="upi">UPI</option>
                    </Select>
                  </div>
                  <div>
                    <label className="field-label">UTR</label>
                    <Input
                      placeholder="UPI reference number"
                      value={row.utrNumber}
                      onChange={(event) => updateSettlementRow(index, "utrNumber", event.target.value)}
                    />
                  </div>
                  <div>
                    <label className="field-label">Notes</label>
                    <Input
                      placeholder="Receipt / note / reference"
                      value={row.notes}
                      onChange={(event) => updateSettlementRow(index, "notes", event.target.value)}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button type="button" variant="ghost" onClick={() => removeSettlementRow(index)}>
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-500">
                No settlement repayments added yet.
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
            {editingAdvance ? "Update advance" : "Save advance"}
          </Button>
          <Button type="button" variant="ghost" onClick={resetAdvanceForm}>
            Reset
          </Button>
        </div>
      </form>

      <DataTable
        rows={rows}
        columns={[
          {
            key: "prefect",
            label: "Prefect",
            render: (row) =>
              `${row.prefectStudentId?.studentId || "-"} - ${row.prefectStudentId?.userId?.name || "Student"}`,
          },
          { key: "takenAmount", label: "Taken", render: (row) => formatCurrency(row.takenAmount || 0) },
          { key: "closedAmount", label: "Settled", render: (row) => formatCurrency(row.closedAmount || 0) },
          {
            key: "balance",
            label: "Balance",
            render: (row) => formatCurrency(Math.max(Number(row.takenAmount || 0) - Number(row.closedAmount || 0), 0)),
          },
          {
            key: "settlementCount",
            label: "Settlements",
            render: (row) => row.settlements?.length || (Number(row.closedAmount || 0) > 0 ? 1 : 0),
          },
          {
            key: "latestSettlement",
            label: "Latest Settlement",
            render: (row) =>
              row.settlements?.[row.settlements.length - 1]?.settlementDate
                ? formatDate(row.settlements[row.settlements.length - 1].settlementDate)
                : "-",
          },
          {
            key: "billDate",
            label: "Bill Date",
            render: (row) => (row.billDates?.[0]?.billDate ? formatDate(row.billDates[0].billDate) : "-"),
          },
          { key: "chequeDetails", label: "Cheque Details", render: (row) => row.chequeDetails || "-" },
          {
            key: "actions",
            label: "Actions",
            render: (row) => (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditingAdvance(row)}>
                  Edit
                </Button>
                <Button variant="danger" size="sm" onClick={() => deleteMutation.mutate(row._id)}>
                  Delete
                </Button>
              </div>
            ),
          },
        ]}
        emptyMessage="No advances recorded for this month yet."
      />

      {editingAdvance ? (
        <div className="panel p-6">
          <h3 className="section-title">Settlement history</h3>
          <p className="mt-2 text-sm text-slate-500">
            {editingAdvance.prefectStudentId?.studentId || "-"} - {editingAdvance.prefectStudentId?.userId?.name || "Student"}
          </p>
          <div className="mt-5">
            <DataTable
              rows={settlementHistoryRows}
              columns={[
                {
                  key: "settlementDate",
                  label: "Settlement Date",
                  render: (row) => (row.settlementDate ? formatDate(row.settlementDate) : "-"),
                },
                {
                  key: "amount",
                  label: "Amount",
                  render: (row) => formatCurrency(row.amount || 0),
                },
                {
                  key: "notes",
                  label: "Notes",
                  render: (row) => row.notes || "-",
                },
                {
                  key: "paymentMode",
                  label: "Mode",
                  render: (row) => (row.paymentMode ? String(row.paymentMode).toUpperCase() : "-"),
                },
                {
                  key: "utrNumber",
                  label: "UTR",
                  render: (row) => row.utrNumber || "-",
                },
                {
                  key: "student",
                  label: "Student",
                  render: () =>
                    `${editingAdvance.prefectStudentId?.studentId || "-"} - ${editingAdvance.prefectStudentId?.userId?.name || "Student"}`,
                },
                {
                  key: "recordedBy",
                  label: "Recorded By",
                  render: (row) => row.recordedBy?.name || editingAdvance.createdBy?.name || "-",
                },
              ]}
              emptyMessage="No settlement history recorded yet."
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
