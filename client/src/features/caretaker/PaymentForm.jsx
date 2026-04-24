import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";

import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { formatCurrency, formatDate } from "../../utils/formatters";

const getStudentSortValue = (row) => {
  const studentCode = row?.studentId?.studentId || "";
  const numericPart = studentCode.match(/\d+$/)?.[0];

  if (numericPart) {
    return Number.parseInt(numericPart, 10);
  }

  return Number.MAX_SAFE_INTEGER;
};

const getDelayDays = (dueDate, paymentMadeDate) => {
  if (!dueDate || !paymentMadeDate) {
    return 0;
  }

  const due = new Date(dueDate);
  const paid = new Date(paymentMadeDate);
  due.setHours(0, 0, 0, 0);
  paid.setHours(0, 0, 0, 0);

  const diffMs = paid.getTime() - due.getTime();
  return diffMs > 0 ? Math.floor(diffMs / (24 * 60 * 60 * 1000)) : 0;
};

export function PaymentForm({ bills = [], onSubmit, loading }) {
  const [finePrompt, setFinePrompt] = useState(null);

  const sortedBills = useMemo(() => {
    const unpaidBills = bills.filter((row) => {
      const hasOutstanding = Number(row?.outstanding_amount ?? row?.ebl_remaining_balance ?? 0) > 0;
      const hasEblClaim = Number(row?.ebl_claimed_amount || 0) > 0 || Boolean(row?.student_utr_number?.trim());

      if (!hasOutstanding || row?.payment_status === "paid") {
        return false;
      }

      if (row?.is_ebl_student) {
        return hasEblClaim;
      }

      return true;
    });

    return unpaidBills.sort((a, b) => {
      const byNumericId = getStudentSortValue(a) - getStudentSortValue(b);
      if (byNumericId !== 0) {
        return byNumericId;
      }

      return (a?.studentId?.studentId || "").localeCompare(b?.studentId?.studentId || "");
    });
  }, [bills]);

  const { register, watch, handleSubmit, setValue, reset } = useForm({
    defaultValues: {
      studentSelection: "",
      billId: "",
      amount: "",
      paymentMethod: "upi",
      paymentMadeDate: new Date().toISOString().slice(0, 10),
    },
  });

  const selectedBillId = watch("studentSelection");
  const selectedPaymentMethod = watch("paymentMethod");
  const selectedPaymentMadeDate = watch("paymentMadeDate");
  const selectedBill = sortedBills.find((row) => row._id === selectedBillId);
  const selectedBillUtr = selectedBill?.student_utr_number?.trim() || "";
  const isUpiWithoutUtr = selectedPaymentMethod === "upi" && !selectedBillUtr;
  const selectedBillOutstanding = Number(selectedBill?.outstanding_amount ?? selectedBill?.ebl_remaining_balance ?? 0);
  const selectedBillFine = Number(selectedBill?.fine || 0);
  const selectedBillDelayDays = getDelayDays(selectedBill?.due_date, selectedPaymentMadeDate);

  useEffect(() => {
    if (!selectedBill) {
      setValue("billId", "");
      setValue("amount", "");
      setValue("paymentMadeDate", new Date().toISOString().slice(0, 10));
      return;
    }

    setValue("billId", selectedBill._id);
    setValue("amount", selectedBillOutstanding > 0 ? selectedBillOutstanding.toFixed(2) : "0.00");
    setValue(
      "paymentMadeDate",
      selectedBill?.student_payment_made_date
        ? new Date(selectedBill.student_payment_made_date).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10)
    );
  }, [selectedBill, selectedBillOutstanding, setValue]);

  const finalizeSubmit = (values) => {
    if (values.paymentMethod === "upi" && !selectedBillUtr) {
      toast.error("Student UTR is required before saving a UPI payment.");
      return;
    }

    onSubmit({
      billId: values.billId,
      amount: Number(values.amount || 0),
      paymentMethod: values.paymentMethod,
      paymentMadeDate: values.paymentMadeDate,
      idempotencyKey: `${values.billId}-${values.paymentMethod}-${values.paymentMadeDate}`,
    });

    setFinePrompt(null);
    reset({
      studentSelection: "",
      billId: "",
      amount: "",
      paymentMethod: "upi",
      paymentMadeDate: new Date().toISOString().slice(0, 10),
    });
  };

  const submit = (values) => {
    if (selectedBillFine > 0 && selectedBillDelayDays > 0) {
      setFinePrompt(values);
      return;
    }

    finalizeSubmit(values);
  };

  return (
    <>
      <form className="panel p-6" onSubmit={handleSubmit(submit)}>
        <h3 className="section-title">Mark Payment</h3>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <label className="field-label">Student ID</label>
            <Select {...register("studentSelection", { required: true })}>
              <option value="">Select bill</option>
              {sortedBills.map((bill) => (
                <option key={bill._id} value={bill._id}>
                  {bill.studentId?.studentId || "-"}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="field-label">Payment Method</label>
            <Select {...register("paymentMethod", { required: true })}>
              <option value="upi">UPI</option>
              <option value="cash">Cash</option>
            </Select>
          </div>
          <div>
            <label className="field-label">Bill ID</label>
            <Input readOnly {...register("billId", { required: true })} />
          </div>
          <div>
            <label className="field-label">Amount</label>
            <Input type="number" readOnly {...register("amount", { required: true })} />
          </div>
          <div className="md:col-span-2">
            <label className="field-label">Payment Made Date</label>
            <Input type="date" {...register("paymentMadeDate", { required: true })} />
          </div>
          <div className="md:col-span-2">
            <label className="field-label">Student UTR</label>
            <Input
              readOnly
              placeholder="Student UTR"
              value={selectedBill?.student_utr_number?.trim() || ""}
            />
            {isUpiWithoutUtr ? (
              <p className="mt-2 text-sm text-rose-500">
                UPI payment cannot be saved until the student updates the UTR.
              </p>
            ) : null}
          </div>
        </div>

        {selectedBill ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600">
            <p>
              Student-entered payment date:{" "}
              <span className="font-semibold text-slate-800">
                {selectedBill?.student_payment_made_date ? formatDate(selectedBill.student_payment_made_date) : "Not entered by student"}
              </span>
            </p>
            {selectedBillFine > 0 ? (
              <p className="mt-2 text-amber-700">
                Fine present: {selectedBillDelayDays} delay day{selectedBillDelayDays === 1 ? "" : "s"} and fine amount {formatCurrency(selectedBillFine)}.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-5">
          <Button loading={loading} type="submit" disabled={isUpiWithoutUtr}>
            Save payment
          </Button>
        </div>
      </form>

      {finePrompt && selectedBill ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-white/70 bg-white p-6 shadow-panel">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-600">Fine alert</p>
            <h3 className="mt-3 font-display text-2xl font-bold text-ink">Student has an outstanding fine</h3>
            <div className="mt-5 space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p>
                <span className="font-semibold">Student:</span> {selectedBill.userId?.name || "-"} ({selectedBill.studentId?.studentId || "-"})
              </p>
              <p>
                <span className="font-semibold">Delay days:</span> {selectedBillDelayDays}
              </p>
              <p>
                <span className="font-semibold">Fine amount:</span> {formatCurrency(selectedBillFine)}
              </p>
            </div>
            <p className="mt-4 text-sm text-slate-500">
              Continue only if you want to process the payment with this fine applied.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setFinePrompt(null)}>
                Cancel
              </Button>
              <Button type="button" onClick={() => finalizeSubmit(finePrompt)} loading={loading}>
                Continue payment
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
