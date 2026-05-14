import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { hostelDepositApi } from "../../api/hostelDepositApi";
import { DataTable } from "../../components/common/DataTable";
import { ErrorState } from "../../components/common/ErrorState";
import { LoadingState } from "../../components/common/LoadingState";
import { PageHeader } from "../../components/common/PageHeader";
import { StatusBadge } from "../../components/common/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { getAcademicYearOptions, getDefaultAcademicYear } from "../../utils/academicYears";
import { formatCurrency, formatDate } from "../../utils/formatters";

const DEFAULT_FORM = {
  academicYear: getDefaultAcademicYear(),
  amountReceived: "",
  notes: "",
};

export function StudentHostelDepositPage() {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [editingId, setEditingId] = useState("");
  const academicYearOptions = getAcademicYearOptions();

  const query = useQuery({
    queryKey: ["student-hostel-deposits"],
    queryFn: () => hostelDepositApi.list(),
  });

  const rows = query.data?.data || [];
  const editableRows = useMemo(() => rows.filter((row) => row.status === "draft"), [rows]);
  const editingRecord = editableRows.find((row) => row._id === editingId) || null;
  const acceptedRows = useMemo(() => rows.filter((row) => row.status === "accepted"), [rows]);
  const totals = useMemo(
    () => ({
      submitted: rows.reduce((sum, row) => sum + Number(row.amountReceived || 0), 0),
      used: rows.reduce((sum, row) => sum + Number(row.amountUsed || 0), 0),
      available: rows.reduce((sum, row) => sum + Number(row.availableAmount || 0), 0),
    }),
    [rows]
  );

  const resetForm = () => {
    setEditingId("");
    setForm(DEFAULT_FORM);
  };

  useEffect(() => {
    if (editingRecord) {
      setForm({
        academicYear: editingRecord.academicYear || "",
        amountReceived: String(editingRecord.amountReceived || ""),
        notes: editingRecord.notes || "",
      });
      return;
    }

    if (editingId) {
      setEditingId("");
      setForm(DEFAULT_FORM);
    }
  }, [editingId, editingRecord]);

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      editingId ? hostelDepositApi.update(editingId, payload) : hostelDepositApi.create(payload),
    onSuccess: () => {
      toast.success(editingId ? "Hostel deposit updated." : "Hostel deposit submitted.");
      resetForm();
      query.refetch();
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Unable to save hostel deposit.");
    },
  });

  const handleSubmit = () => {
    const academicYear = form.academicYear.trim();
    const amountReceived = Number(form.amountReceived || 0);

    if (!academicYear) {
      toast.error("Academic year is required.");
      return;
    }

    if (amountReceived <= 0) {
      toast.error("Deposit amount must be greater than zero.");
      return;
    }

    saveMutation.mutate({
      academicYear,
      amountReceived,
      notes: form.notes.trim(),
    });
  };

  if (query.isLoading) {
    return <LoadingState label="Loading hostel deposit..." />;
  }

  if (query.isError) {
    return <ErrorState description="Unable to load hostel deposit records." onRetry={() => query.refetch()} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Hostel Deposit"
        title="Submit yearly hostel deposit"
        description="Submit your yearly hostel deposit here, track whether it has been accepted, and see how much remains available for future NOC clearance."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Total Submitted</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(totals.submitted)}</p>
          <p className="mt-2 text-sm text-slate-500">{rows.length} yearly record{rows.length === 1 ? "" : "s"}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Accepted & Available</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(totals.available)}</p>
          <p className="mt-2 text-sm text-slate-500">
            {acceptedRows.length} accepted deposit{acceptedRows.length === 1 ? "" : "s"} ready for NOC use
          </p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Already Used</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(totals.used)}</p>
          <p className="mt-2 text-sm text-slate-500">This amount has already been adjusted in NOC settlement.</p>
        </div>
      </div>

      <div className="panel p-6">
        <h3 className="section-title">{editingId ? "Update hostel deposit" : "Add hostel deposit"}</h3>
        <p className="mt-2 text-sm text-slate-500">
          Draft deposits can still be edited. Once the caretaker accepts a deposit, it becomes locked and can be used for NOC deduction.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <label className="field-label">Academic year</label>
            <select
              className="input"
              value={form.academicYear}
              onChange={(event) => setForm((current) => ({ ...current, academicYear: event.target.value }))}
            >
              {academicYearOptions.map((academicYear) => (
                <option key={academicYear} value={academicYear}>
                  {academicYear}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Deposit amount</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.amountReceived}
              onChange={(event) => setForm((current) => ({ ...current, amountReceived: event.target.value }))}
            />
          </div>
          <div className="md:col-span-2">
            <label className="field-label">Notes</label>
            <Input
              placeholder="Optional note"
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            />
          </div>
        </div>
        <div className="mt-5 flex gap-3">
          <Button
            type="button"
            loading={saveMutation.isPending}
            onClick={handleSubmit}
          >
            {editingId ? "Update Deposit" : "Submit Deposit"}
          </Button>
          {editingId ? (
            <Button
              type="button"
              variant="ghost"
              onClick={resetForm}
            >
              Cancel
            </Button>
          ) : null}
        </div>
      </div>

      <DataTable
        rows={rows}
        columns={[
          { key: "academicYear", label: "Academic Year" },
          { key: "amountReceived", label: "Received", render: (row) => formatCurrency(row.amountReceived || 0) },
          { key: "amountUsed", label: "Used", render: (row) => formatCurrency(row.amountUsed || 0) },
          { key: "availableAmount", label: "Available", render: (row) => formatCurrency(row.availableAmount || 0) },
          { key: "notes", label: "Notes", render: (row) => row.notes || "-" },
          { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
          { key: "reviewedAt", label: "Reviewed", render: (row) => formatDate(row.reviewedAt) },
          {
            key: "actions",
            label: "Actions",
            render: (row) =>
              row.status === "draft" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingId(row._id)}
                >
                  Edit
                </Button>
              ) : (
                "-"
              ),
          },
        ]}
        emptyMessage="No hostel deposit records found."
      />
    </div>
  );
}
