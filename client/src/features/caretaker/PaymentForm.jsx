import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";

import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";

const getStudentSortValue = (row) => {
  const studentCode = row?.studentId?.studentId || "";
  const numericPart = studentCode.match(/\d+$/)?.[0];

  if (numericPart) {
    return Number.parseInt(numericPart, 10);
  }

  return Number.MAX_SAFE_INTEGER;
};

export function PaymentForm({ bills = [], onSubmit, loading }) {
  const sortedBills = useMemo(() => {
    const unpaidBills = bills.filter((row) => row?.payment_status !== "paid");

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
  const selectedBill = sortedBills.find((row) => row._id === selectedBillId);
  const selectedBillUtr = selectedBill?.student_utr_number?.trim() || "";
  const isUpiWithoutUtr = selectedPaymentMethod === "upi" && !selectedBillUtr;

  useEffect(() => {
    if (!selectedBill) {
      setValue("billId", "");
      setValue("amount", "");
      return;
    }

    const payableAmount = Number(selectedBill.total_amount || 0) + Number(selectedBill.fine || 0) - Number(selectedBill.amount_paid || 0);

    setValue("billId", selectedBill._id);
    setValue("amount", payableAmount > 0 ? payableAmount.toFixed(2) : "0.00");
  }, [selectedBillId, setValue, sortedBills]);

  const submit = (values) => {
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

    reset({
      studentSelection: "",
      billId: "",
      amount: "",
      paymentMethod: "upi",
      paymentMadeDate: new Date().toISOString().slice(0, 10),
    });
  };

  return (
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
            value={selectedBill?.student_utr_number?.trim() || ""}
          />
          {isUpiWithoutUtr ? (
            <p className="mt-2 text-sm text-rose-500">
              UPI payment cannot be saved until the student updates the UTR.
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-5">
        <Button loading={loading} type="submit" disabled={isUpiWithoutUtr}>
          Save payment
        </Button>
      </div>
    </form>
  );
}
