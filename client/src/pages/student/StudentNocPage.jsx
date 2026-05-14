import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { nocApi } from "../../api/nocApi";
import { DataTable } from "../../components/common/DataTable";
import { ErrorState } from "../../components/common/ErrorState";
import { LoadingState } from "../../components/common/LoadingState";
import { PageHeader } from "../../components/common/PageHeader";
import { StatusBadge } from "../../components/common/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { formatCurrency, formatDate } from "../../utils/formatters";

export function StudentNocPage() {
  const [selectedNocId, setSelectedNocId] = useState("");
  const form = useForm({
    defaultValues: {
      paymentMode: "",
      paymentMadeDate: "",
      utrNumber: "",
    },
  });

  const query = useQuery({
    queryKey: ["student-noc-settlements"],
    queryFn: () => nocApi.list(),
  });

  const rows = query.data?.data || [];
  const totals = useMemo(
    () => ({
      pending: rows.filter((row) => row.status !== "paid").length,
      totalBalance: rows.reduce((sum, row) => sum + Number(row.balanceAmount || 0), 0),
      totalRemaining: rows.reduce((sum, row) => sum + Number(row.remainingAmount || row.balanceAmount || 0), 0),
    }),
    [rows]
  );
  const selectedRecord = useMemo(
    () => rows.find((row) => row._id === selectedNocId) || rows.find((row) => row.status !== "paid") || rows[0] || null,
    [rows, selectedNocId]
  );
  const paymentMode = form.watch("paymentMode");
  const directPaymentRequired = Number(selectedRecord?.remainingAmount || selectedRecord?.balanceAmount || 0) > 0;

  useEffect(() => {
    if (!selectedRecord) {
      return;
    }

    setSelectedNocId(selectedRecord._id);
    form.reset({
      paymentMode: selectedRecord.student_payment_mode || (selectedRecord.remainingAmount > 0 ? "upi" : ""),
      paymentMadeDate: selectedRecord.student_payment_made_date
        ? new Date(selectedRecord.student_payment_made_date).toISOString().slice(0, 10)
        : "",
      utrNumber: selectedRecord.student_utr_number || "",
    });
  }, [selectedRecord, form]);

  useEffect(() => {
    if (paymentMode !== "upi" && form.getValues("utrNumber")) {
      form.setValue("utrNumber", "");
    }
  }, [form, paymentMode]);

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => nocApi.updatePaymentInfo(id, payload),
    onSuccess: () => {
      toast.success("NOC payment details updated.");
      query.refetch();
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Unable to update NOC payment details.");
    },
  });

  if (query.isLoading) {
    return <LoadingState label="Loading NOC settlement..." />;
  }

  if (query.isError) {
    return <ErrorState description="Unable to load NOC settlement." onRetry={() => query.refetch()} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="NOC"
        title="No-objection clearance"
        description="Review your exit-clearance balance, choose whether to use accepted hostel deposit, and share payment details so the caretaker can close your NOC settlement."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Total NOC Records</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{rows.length}</p>
          <p className="mt-2 text-sm text-slate-500">{totals.pending} pending for review</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Total Balance Raised</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(totals.totalBalance)}</p>
          <p className="mt-2 text-sm text-slate-500">Includes main amount, damages, and other charges.</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Still Remaining</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(totals.totalRemaining)}</p>
          <p className="mt-2 text-sm text-slate-500">After hostel deposit deduction, if any.</p>
        </div>
      </div>

      <div className="panel p-6">
        <h3 className="section-title">Update your NOC payment details</h3>
        {selectedRecord ? (
          <form
            className="mt-6"
            onSubmit={form.handleSubmit((values) => {
              updateMutation.mutate({
                id: selectedRecord._id,
                payload: {
                  paymentMode: values.paymentMode,
                  paymentMadeDate: values.paymentMadeDate || null,
                  utrNumber: values.paymentMode === "upi" ? values.utrNumber.trim() : "",
                },
              });
            })}
          >
            <div className="mb-5 grid gap-4 md:grid-cols-2">
              <div>
                <label className="field-label">Select settlement</label>
                <select
                  className="input"
                  value={selectedRecord?._id || ""}
                  onChange={(event) => setSelectedNocId(event.target.value)}
                >
                  {rows.map((row) => (
                    <option key={row._id} value={row._id}>
                      {row.academicYear} - {formatCurrency(row.remainingAmount || row.balanceAmount || 0)} remaining
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Caretaker note</label>
                <Input readOnly value={selectedRecord.notes || "-"} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="field-label">Academic year</label>
                <Input readOnly value={selectedRecord.academicYear || "-"} />
              </div>
              <div>
                <label className="field-label">Balance amount</label>
                <Input readOnly value={formatCurrency(selectedRecord.balanceAmount || 0)} />
              </div>
              <div>
                <label className="field-label">Accepted hostel deposit</label>
                <Input readOnly value={formatCurrency(selectedRecord.availableHostelDepositAmount || 0)} />
              </div>
              <div>
                <label className="field-label">Deposit deduction</label>
                <Input readOnly value={formatCurrency(selectedRecord.hostelDepositAppliedAmount || 0)} />
              </div>
              <div>
                <label className="field-label">Remaining amount to pay</label>
                <Input readOnly value={formatCurrency(selectedRecord.remainingAmount || selectedRecord.balanceAmount || 0)} />
              </div>
              <div>
                <label className="field-label">Main amount</label>
                <Input readOnly value={formatCurrency(selectedRecord.baseAmount || 0)} />
              </div>
              <div>
                <label className="field-label">Damages</label>
                <Input readOnly value={formatCurrency(selectedRecord.damagesAmount || 0)} />
              </div>
              <div>
                <label className="field-label">Others</label>
                <Input readOnly value={formatCurrency(selectedRecord.othersAmount || 0)} />
              </div>
              <div>
                <label className="field-label">Leaving date</label>
                <Input readOnly value={selectedRecord.leavingDate ? formatDate(selectedRecord.leavingDate) : "-"} />
              </div>
              <div>
                <label className="field-label">Status</label>
                <div className="pt-3">
                  <StatusBadge value={selectedRecord.status} />
                </div>
              </div>
              <div>
                <label className="field-label">Accepted hostel deposit record</label>
                <Input
                  readOnly
                  value={
                    selectedRecord.matchedHostelDeposit
                      ? `${selectedRecord.matchedHostelDeposit.academicYear || "-"} (${formatCurrency(selectedRecord.availableHostelDepositAmount || 0)} available)`
                      : "No accepted deposit available"
                  }
                />
              </div>
              <div>
                <label className="field-label">Payment mode</label>
                <select className="input" {...form.register("paymentMode")}>
                  <option value="">No direct payment required</option>
                  <option value="upi">UPI</option>
                  <option value="cash">Cash</option>
                </select>
              </div>
              <div>
                <label className="field-label">Payment made date</label>
                <Input
                  type="date"
                  disabled={!directPaymentRequired && !paymentMode}
                  {...form.register("paymentMadeDate")}
                />
              </div>
              <div className="md:col-span-2">
                <label className="field-label">UTR number</label>
                <Input
                  placeholder={paymentMode === "cash" ? "UTR not required for cash payment" : "Enter your UTR number"}
                  disabled={paymentMode !== "upi"}
                  {...form.register("utrNumber")}
                />
                <p className="mt-2 text-xs text-slate-500">
                  The caretaker will verify the NOC settlement after checking remaining amount and your payment details.
                </p>
              </div>
            </div>
            <div className="mt-5">
              <Button type="submit" loading={updateMutation.isPending} disabled={selectedRecord.status === "paid"}>
                Save NOC Details
              </Button>
            </div>
          </form>
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            No NOC settlement has been created for your account yet.
          </p>
        )}
      </div>

      <DataTable
        rows={rows}
        columns={[
          { key: "academicYear", label: "Academic Year" },
          { key: "baseAmount", label: "Main", render: (row) => formatCurrency(row.baseAmount || 0) },
          { key: "damagesAmount", label: "Damages", render: (row) => formatCurrency(row.damagesAmount || 0) },
          { key: "othersAmount", label: "Others", render: (row) => formatCurrency(row.othersAmount || 0) },
          { key: "hostelDepositAppliedAmount", label: "Deposit Used", render: (row) => formatCurrency(row.hostelDepositAppliedAmount || 0) },
          { key: "remainingAmount", label: "Remaining", render: (row) => formatCurrency(row.remainingAmount || row.balanceAmount || 0) },
          { key: "balanceAmount", label: "Total Balance", render: (row) => formatCurrency(row.balanceAmount || 0) },
          { key: "student_payment_mode", label: "Mode", render: (row) => row.student_payment_mode || "-" },
          { key: "student_payment_made_date", label: "Payment Made", render: (row) => formatDate(row.student_payment_made_date) },
          { key: "student_utr_number", label: "UTR", render: (row) => row.student_utr_number || "-" },
          { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
          { key: "verifiedAt", label: "Verified", render: (row) => formatDate(row.verifiedAt) },
        ]}
        emptyMessage="No NOC settlements found."
      />
    </div>
  );
}
