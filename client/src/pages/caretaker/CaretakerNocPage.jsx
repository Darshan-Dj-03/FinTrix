import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { hostelDepositApi } from "../../api/hostelDepositApi";
import { nocApi } from "../../api/nocApi";
import { studentApi } from "../../api/studentApi";
import { DataTable } from "../../components/common/DataTable";
import { ErrorState } from "../../components/common/ErrorState";
import { LoadingState } from "../../components/common/LoadingState";
import { PageHeader } from "../../components/common/PageHeader";
import { SearchField } from "../../components/common/SearchField";
import { StatusBadge } from "../../components/common/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { getAcademicYearOptions, getDefaultAcademicYear } from "../../utils/academicYears";
import { formatCurrency, formatDate } from "../../utils/formatters";

const DEFAULT_CREATE_FORM = {
  studentId: "",
  academicYear: getDefaultAcademicYear(),
  leavingDate: "",
  baseAmount: "",
  damagesAmount: "",
  othersAmount: "",
  useHostelDeposit: false,
  notes: "",
};

export function CaretakerNocPage() {
  const [search, setSearch] = useState("");
  const [createForm, setCreateForm] = useState(DEFAULT_CREATE_FORM);
  const [selectedNocId, setSelectedNocId] = useState("");
  const [paymentForm, setPaymentForm] = useState({
    paymentMethod: "upi",
    paymentMadeDate: new Date().toISOString().slice(0, 10),
  });
  const academicYearOptions = getAcademicYearOptions();

  const studentsQuery = useQuery({
    queryKey: ["caretaker-noc-students"],
    queryFn: studentApi.list,
  });
  const nocQuery = useQuery({
    queryKey: ["caretaker-noc-settlements"],
    queryFn: () => nocApi.list(),
  });
  const students = studentsQuery.data?.students || [];
  const rows = nocQuery.data?.data || [];
  const filteredRows = useMemo(() => {
    if (!search.trim()) {
      return rows;
    }

    const normalizedSearch = search.toLowerCase();
    return rows.filter((row) =>
      `${row.studentId?.studentId || ""} ${row.userId?.name || ""} ${row.academicYear || ""}`
        .toLowerCase()
        .includes(normalizedSearch)
    );
  }, [rows, search]);
  const normalizedAcademicYear = createForm.academicYear.trim();
  const shouldLookupDeposit = Boolean(createForm.studentId && normalizedAcademicYear);
  const depositLookupQuery = useQuery({
    queryKey: ["caretaker-hostel-deposit-lookup", createForm.studentId, normalizedAcademicYear],
    queryFn: () =>
      hostelDepositApi.list({
        studentId: createForm.studentId,
        academicYear: normalizedAcademicYear,
      }),
    enabled: shouldLookupDeposit,
  });
  const createFormTotal = Number(createForm.baseAmount || 0) + Number(createForm.damagesAmount || 0) + Number(createForm.othersAmount || 0);
  const matchingDeposit = useMemo(() => {
    if (!shouldLookupDeposit) {
      return null;
    }

    const lookupRows = depositLookupQuery.data?.data || [];
    return lookupRows.find((row) => row.status === "accepted") || lookupRows[0] || null;
  }, [depositLookupQuery.data, shouldLookupDeposit]);
  const availableDepositAmount = matchingDeposit?.status === "accepted" ? Number(matchingDeposit.availableAmount || 0) : 0;
  const depositAppliedPreview = createForm.useHostelDeposit ? Math.min(createFormTotal, availableDepositAmount) : 0;
  const createFormRemainingAfterDeposit = Math.max(createFormTotal - depositAppliedPreview, 0);
  const depositStatusMessage = useMemo(() => {
    if (!shouldLookupDeposit) {
      return "Select student and academic year to check hostel deposit.";
    }
    if (depositLookupQuery.isFetching) {
      return "Checking hostel deposit for this student and academic year...";
    }
    if (!matchingDeposit) {
      return "Hostel deposit not updated yet for this student and academic year.";
    }
    if (matchingDeposit.status !== "accepted") {
      return "Hostel deposit is submitted but not accepted yet, so it cannot be deducted now.";
    }
    return `Accepted hostel deposit available: ${formatCurrency(availableDepositAmount)}.`;
  }, [shouldLookupDeposit, depositLookupQuery.isFetching, matchingDeposit, availableDepositAmount]);

  useEffect(() => {
    if (createForm.useHostelDeposit && (matchingDeposit?.status !== "accepted" || availableDepositAmount <= 0)) {
      setCreateForm((current) => ({ ...current, useHostelDeposit: false }));
    }
  }, [createForm.useHostelDeposit, matchingDeposit, availableDepositAmount]);

  const selectedRecord = filteredRows.find((row) => row._id === selectedNocId) || filteredRows.find((row) => row.status !== "paid") || filteredRows[0] || null;

  useEffect(() => {
    if (!selectedRecord) {
      return;
    }

    setPaymentForm({
      paymentMethod: selectedRecord.student_payment_mode || "upi",
      paymentMadeDate: selectedRecord.student_payment_made_date
        ? new Date(selectedRecord.student_payment_made_date).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
    });
  }, [selectedRecord]);

  const refreshAll = () => {
    studentsQuery.refetch();
    nocQuery.refetch();
    if (shouldLookupDeposit) {
      depositLookupQuery.refetch();
    }
  };

  const createMutation = useMutation({
    mutationFn: nocApi.create,
    onSuccess: () => {
      toast.success("NOC settlement created.");
      setCreateForm(DEFAULT_CREATE_FORM);
      nocQuery.refetch();
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Unable to create NOC settlement.");
    },
  });

  const recordPaymentMutation = useMutation({
    mutationFn: ({ id, payload }) => nocApi.recordPayment(id, payload),
    onSuccess: () => {
      toast.success("NOC payment recorded.");
      nocQuery.refetch();
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Unable to record NOC payment.");
    },
  });

  if (studentsQuery.isLoading || nocQuery.isLoading) {
    return <LoadingState label="Loading NOC workspace..." />;
  }

  if (studentsQuery.isError || nocQuery.isError || depositLookupQuery.isError) {
    return <ErrorState description="Unable to load NOC workspace." onRetry={refreshAll} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="NOC"
        title="Exit clearance settlements"
        description="Create year-wise NOC balance records for students leaving the hostel, wait for the student to update UTR details, and then mark the settlement as paid."
      />

      <div className="panel p-6">
        <h3 className="section-title">Create NOC settlement</h3>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <label className="field-label">Student</label>
            <select
              className="input"
              value={createForm.studentId}
              onChange={(event) => setCreateForm((current) => ({ ...current, studentId: event.target.value }))}
            >
              <option value="">Select student</option>
              {students.map((student) => (
                <option key={student._id} value={student._id}>
                  {student.studentId} - {student.userId?.name || "Student"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Academic year</label>
            <select
              className="input"
              value={createForm.academicYear}
              onChange={(event) => setCreateForm((current) => ({ ...current, academicYear: event.target.value }))}
            >
              {academicYearOptions.map((academicYear) => (
                <option key={academicYear} value={academicYear}>
                  {academicYear}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Leaving date</label>
            <Input
              type="date"
              value={createForm.leavingDate}
              onChange={(event) => setCreateForm((current) => ({ ...current, leavingDate: event.target.value }))}
            />
          </div>
          <div>
            <label className="field-label">Main amount</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={createForm.baseAmount}
              onChange={(event) => setCreateForm((current) => ({ ...current, baseAmount: event.target.value }))}
            />
          </div>
          <div>
            <label className="field-label">Damages</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={createForm.damagesAmount}
              onChange={(event) => setCreateForm((current) => ({ ...current, damagesAmount: event.target.value }))}
            />
          </div>
          <div>
            <label className="field-label">Others</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={createForm.othersAmount}
              onChange={(event) => setCreateForm((current) => ({ ...current, othersAmount: event.target.value }))}
            />
          </div>
          <div>
            <label className="field-label">Total balance amount</label>
            <Input readOnly value={formatCurrency(createFormTotal)} />
          </div>
          <div>
            <label className="field-label">Hostel deposit status</label>
            <Input
              readOnly
              value={
                !shouldLookupDeposit
                  ? "Select student and academic year"
                  : depositLookupQuery.isFetching
                    ? "Checking..."
                  : matchingDeposit
                    ? matchingDeposit.status === "accepted"
                      ? "Accepted"
                      : "Submitted, waiting for acceptance"
                    : "Not updated yet"
              }
            />
          </div>
          <div>
            <label className="field-label">Available hostel deposit</label>
            <Input readOnly value={formatCurrency(availableDepositAmount)} />
          </div>
          <div>
            <label className="field-label">Deposit deduction preview</label>
            <Input readOnly value={formatCurrency(depositAppliedPreview)} />
          </div>
          <div>
            <label className="field-label">Remaining after deposit</label>
            <Input readOnly value={formatCurrency(createFormRemainingAfterDeposit)} />
          </div>
          <div className="md:col-span-2">
            <label className="field-label">Use hostel deposit now</label>
            <label className="mt-2 flex items-center gap-3 text-sm text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={createForm.useHostelDeposit}
                onChange={(event) => setCreateForm((current) => ({ ...current, useHostelDeposit: event.target.checked }))}
                disabled={matchingDeposit?.status !== "accepted" || availableDepositAmount <= 0}
              />
              Deduct accepted hostel deposit from this NOC settlement while creating it.
            </label>
            <p className="mt-2 text-xs text-slate-500">{depositStatusMessage}</p>
          </div>
          <div className="md:col-span-2">
            <label className="field-label">Notes</label>
            <Input
              placeholder="Optional exit clearance note"
              value={createForm.notes}
              onChange={(event) => setCreateForm((current) => ({ ...current, notes: event.target.value }))}
            />
          </div>
        </div>
        <div className="mt-5">
          <Button
            type="button"
            loading={createMutation.isPending}
            onClick={() =>
              createMutation.mutate({
                studentId: createForm.studentId,
                academicYear: normalizedAcademicYear,
                leavingDate: createForm.leavingDate || null,
                baseAmount: Number(createForm.baseAmount || 0),
                damagesAmount: Number(createForm.damagesAmount || 0),
                othersAmount: Number(createForm.othersAmount || 0),
                useHostelDeposit: Boolean(createForm.useHostelDeposit),
                notes: createForm.notes,
              })
            }
          >
            Create NOC
          </Button>
        </div>
      </div>

      <div className="panel p-6">
        <h3 className="section-title">Mark NOC payment</h3>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <label className="field-label">Find settlement</label>
            <SearchField value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search student or academic year" />
          </div>
          <div>
            <label className="field-label">Select NOC</label>
            <select
              className="input"
              value={selectedRecord?._id || ""}
              onChange={(event) => setSelectedNocId(event.target.value)}
            >
              <option value="">Select settlement</option>
              {filteredRows.map((row) => (
                <option key={row._id} value={row._id}>
                  {row.studentId?.studentId || "-"} - {row.academicYear}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedRecord ? (
          <>
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600">
              <p>
                Student: <span className="font-semibold text-slate-800">{selectedRecord.userId?.name || "-"} ({selectedRecord.studentId?.studentId || "-"})</span>
              </p>
              <p className="mt-2">
                Main amount: <span className="font-semibold text-slate-800">{formatCurrency(selectedRecord.baseAmount || 0)}</span>
              </p>
              <p className="mt-2">
                Damages: <span className="font-semibold text-slate-800">{formatCurrency(selectedRecord.damagesAmount || 0)}</span>
              </p>
              <p className="mt-2">
                Others: <span className="font-semibold text-slate-800">{formatCurrency(selectedRecord.othersAmount || 0)}</span>
              </p>
              <p className="mt-2">
                Total balance: <span className="font-semibold text-slate-800">{formatCurrency(selectedRecord.balanceAmount || 0)}</span>
              </p>
              <p className="mt-2">
                Accepted hostel deposit: <span className="font-semibold text-slate-800">{formatCurrency(selectedRecord.availableHostelDepositAmount || 0)}</span>
              </p>
              <p className="mt-2">
                Deposit deduction: <span className="font-semibold text-slate-800">{formatCurrency(selectedRecord.hostelDepositAppliedAmount || 0)}</span>
              </p>
              <p className="mt-2">
                Remaining amount: <span className="font-semibold text-slate-800">{formatCurrency(selectedRecord.remainingAmount || selectedRecord.balanceAmount || 0)}</span>
              </p>
              <p className="mt-2">
                Student UTR: <span className="font-semibold text-slate-800">{selectedRecord.student_utr_number || "UTR not updated by student"}</span>
              </p>
              <p className="mt-2">
                Student payment date: <span className="font-semibold text-slate-800">{formatDate(selectedRecord.student_payment_made_date)}</span>
              </p>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <label className="field-label">Payment method</label>
                <select
                  className="input"
                  value={paymentForm.paymentMethod}
                  onChange={(event) => setPaymentForm((current) => ({ ...current, paymentMethod: event.target.value }))}
                >
                  <option value="upi">UPI</option>
                  <option value="cash">Cash</option>
                </select>
              </div>
              <div>
                <label className="field-label">Payment made date</label>
                <Input
                  type="date"
                  value={paymentForm.paymentMadeDate}
                  onChange={(event) => setPaymentForm((current) => ({ ...current, paymentMadeDate: event.target.value }))}
                />
              </div>
            </div>
            <div className="mt-5">
              <Button
                type="button"
                loading={recordPaymentMutation.isPending}
                disabled={selectedRecord.status === "paid"}
                onClick={() =>
                  recordPaymentMutation.mutate({
                    id: selectedRecord._id,
                    payload: {
                      paymentMethod: paymentForm.paymentMethod,
                      paymentMadeDate: paymentForm.paymentMadeDate,
                    },
                  })
                }
              >
                Mark NOC payment
              </Button>
            </div>
          </>
        ) : (
          <p className="mt-4 text-sm text-slate-500">No NOC settlements available.</p>
        )}
      </div>

      <DataTable
        rows={filteredRows}
        columns={[
          { key: "student", label: "Student", render: (row) => row.studentId?.studentId || "-" },
          { key: "name", label: "Name", render: (row) => row.userId?.name || "-" },
          { key: "academicYear", label: "Academic Year" },
          { key: "baseAmount", label: "Main", render: (row) => formatCurrency(row.baseAmount || 0) },
          { key: "damagesAmount", label: "Damages", render: (row) => formatCurrency(row.damagesAmount || 0) },
          { key: "othersAmount", label: "Others", render: (row) => formatCurrency(row.othersAmount || 0) },
          { key: "hostelDepositAppliedAmount", label: "Deposit Used", render: (row) => formatCurrency(row.hostelDepositAppliedAmount || 0) },
          { key: "remainingAmount", label: "Remaining", render: (row) => formatCurrency(row.remainingAmount || row.balanceAmount || 0) },
          { key: "balanceAmount", label: "Total Balance", render: (row) => formatCurrency(row.balanceAmount || 0) },
          { key: "student_payment_mode", label: "Mode", render: (row) => row.student_payment_mode || "-" },
          { key: "student_payment_made_date", label: "Student Date", render: (row) => formatDate(row.student_payment_made_date) },
          { key: "student_utr_number", label: "Student UTR", render: (row) => row.student_utr_number || "-" },
          { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
          { key: "verifiedAt", label: "Verified", render: (row) => formatDate(row.verifiedAt) },
        ]}
        emptyMessage="No NOC settlements found."
      />
    </div>
  );
}
