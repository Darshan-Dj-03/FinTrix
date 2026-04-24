import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { billApi } from "../../api/billApi";
import { eblApi } from "../../api/eblApi";
import { paymentApi } from "../../api/paymentApi";
import { DataTable } from "../../components/common/DataTable";
import { ErrorState } from "../../components/common/ErrorState";
import { LoadingState } from "../../components/common/LoadingState";
import { MonthPicker } from "../../components/common/MonthPicker";
import { PageHeader } from "../../components/common/PageHeader";
import { StatusBadge } from "../../components/common/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useAuthStore } from "../../store/authStore";
import { CURRENT_MONTH, parseMonthValue } from "../../utils/constants";
import { formatCurrency, formatDate } from "../../utils/formatters";

const getSortableMonthValue = (month) => {
  const { monthIndex, year } = parseMonthValue(month);
  return year * 12 + monthIndex;
};

const isMonthInsidePeriod = (month, fromMonth, toMonth) => {
  const currentValue = getSortableMonthValue(month);
  const fromValue = getSortableMonthValue(fromMonth);
  const toValue = getSortableMonthValue(toMonth);
  const lowerBound = Math.min(fromValue, toValue);
  const upperBound = Math.max(fromValue, toValue);
  return currentValue >= lowerBound && currentValue <= upperBound;
};

export function StudentPaymentsPage() {
  const studentProfile = useAuthStore((state) => state.studentProfile);
  const [month, setMonth] = useState(CURRENT_MONTH);
  const form = useForm({ defaultValues: { utrNumber: "", paymentMadeDate: "" } });

  const billQuery = useQuery({
    queryKey: ["student-payment-bill", studentProfile?._id, month],
    queryFn: () => billApi.getStudentBill(studentProfile._id, month),
    enabled: Boolean(studentProfile?._id),
  });
  const query = useQuery({
    queryKey: ["student-payments-page", month],
    queryFn: () => paymentApi.list({ month }),
  });
  const eblStatusQuery = useQuery({
    queryKey: ["student-payment-ebl-status", studentProfile?._id],
    queryFn: eblApi.getStudentStatus,
    enabled: Boolean(studentProfile?._id && studentProfile?.isEBL),
  });

  useEffect(() => {
    form.reset({
      utrNumber: billQuery.data?.data?.student_utr_number || "",
      paymentMadeDate: billQuery.data?.data?.student_payment_made_date
        ? new Date(billQuery.data.data.student_payment_made_date).toISOString().slice(0, 10)
        : "",
    });
  }, [billQuery.data?.data?.student_utr_number, billQuery.data?.data?.student_payment_made_date, form]);

  const updateStudentPaymentInfoMutation = useMutation({
    mutationFn: ({ billId, payload }) => billApi.updateStudentPaymentInfo(billId, payload),
    onSuccess: () => {
      toast.success("Payment details updated.");
      billQuery.refetch();
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Unable to update payment details.");
    },
  });

  if (query.isLoading || billQuery.isLoading || eblStatusQuery.isLoading) {
    return <LoadingState label="Loading payment history..." />;
  }

  if (query.isError || billQuery.isError || eblStatusQuery.isError) {
    return (
      <ErrorState
        description="Unable to load payment history."
        onRetry={() => {
          query.refetch();
          billQuery.refetch();
          eblStatusQuery.refetch();
        }}
      />
    );
  }

  const bill = billQuery.data?.data;
  const matchingEblPeriod = (eblStatusQuery.data?.data?.periods || []).find((period) =>
    isMonthInsidePeriod(month, period.fromMonth, period.toMonth)
  );
  const isEblBill = Boolean(
    bill?.is_ebl_student ||
      matchingEblPeriod ||
      (studentProfile?.isEBL &&
        (bill?.student_utr_number || Number(bill?.amount_paid || 0) > 0 || bill?.payment_status === "paid"))
  );
  const paymentRows =
    isEblBill && Number(bill?.amount_paid || 0) > 0
      ? [
          {
            _id: `ebl-${bill?._id || month}`,
            month: bill?.month || month,
            amount: Number(bill?.amount_paid || 0),
            paymentMethod: "ebl",
            paymentMadeDate: bill?.student_payment_made_date || bill?.updatedAt || null,
            utrNumber: matchingEblPeriod?.periodUtr || bill?.student_utr_number || "-",
            status: bill?.payment_status || "paid",
            verifiedAt: bill?.updatedAt || null,
          },
        ]
      : query.data?.data || [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Payments"
        title="Payment history"
        description={
          isEblBill
            ? "This month is settled through the EBL workflow. Submit GOI amount, duration, and scholarship UTR in the EBL section, while the caretaker verifies any remaining balance payment."
            : "Keep your payment UTR and payment date updated here so the caretaker can verify it against the bill."
        }
        action={
          <div className="w-full max-w-sm">
            <MonthPicker value={month} onChange={setMonth} />
          </div>
        }
      />

      <div className="panel p-6">
        {isEblBill ? (
          <>
            <h3 className="section-title">EBL payment details are managed in the EBL section</h3>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <label className="field-label">Bill month</label>
                <Input readOnly value={bill?.month || month} />
              </div>
              <div>
                <label className="field-label">Current payable</label>
                <Input readOnly value={formatCurrency(bill?.ebl_remaining_balance || 0)} />
              </div>
              <div>
                <label className="field-label">Claimed amount</label>
                <Input readOnly value={formatCurrency(bill?.ebl_claimed_amount || 0)} />
              </div>
              <div>
                <label className="field-label">Difference amount</label>
                <Input readOnly value={formatCurrency(bill?.ebl_difference_amount || 0)} />
              </div>
              <div className="md:col-span-2">
                <label className="field-label">EBL period UTR</label>
                <Input
                  readOnly
                  disabled
                  value={matchingEblPeriod?.periodUtr || bill?.student_utr_number || "Submit scholarship UTR from the EBL section"}
                />
              </div>
            </div>
            <p className="mt-4 text-sm font-medium text-slate-500">
              Use the EBL page to submit scholarship details. The caretaker processes the remaining balance after reviewing the submitted claim details.
            </p>
          </>
        ) : (
          <form
            onSubmit={form.handleSubmit((values) => {
              if (!bill?._id) {
                toast.error("No active bill found for the selected month.");
                return;
              }

              updateStudentPaymentInfoMutation.mutate({
                billId: bill._id,
                payload: {
                  utrNumber: values.utrNumber.trim(),
                  paymentMadeDate: values.paymentMadeDate || null,
                },
              });
            })}
          >
            <h3 className="section-title">Update your payment details</h3>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <label className="field-label">Bill month</label>
                <Input readOnly value={bill?.month || month} />
              </div>
              <div>
                <label className="field-label">Current payable</label>
                <Input readOnly value={formatCurrency((bill?.total_amount || 0) + (bill?.fine || 0))} />
              </div>
              <div className="md:col-span-2">
                <label className="field-label">Payment made date</label>
                <Input type="date" {...form.register("paymentMadeDate")} />
              </div>
              <div className="md:col-span-2">
                <label className="field-label">UTR number</label>
                <Input placeholder="Enter your UTR number" {...form.register("utrNumber")} />
                <p className="mt-2 text-xs text-slate-500">
                  Leave this blank if you have not paid by UPI yet. The caretaker will see "UTR not updated by student".
                </p>
              </div>
            </div>
            <div className="mt-5">
              <Button type="submit" loading={updateStudentPaymentInfoMutation.isPending}>
                Save UTR
              </Button>
            </div>
          </form>
        )}
      </div>

      <DataTable
        rows={paymentRows}
        columns={[
          { key: "month", label: "Month" },
          { key: "amount", label: "Amount", render: (row) => formatCurrency(row.amount) },
          { key: "paymentMethod", label: "Method" },
          { key: "paymentMadeDate", label: "Payment Made", render: (row) => formatDate(row.paymentMadeDate) },
          { key: "utrNumber", label: "UTR", render: (row) => row.utrNumber || "-" },
          { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
          { key: "verifiedAt", label: "Verified", render: (row) => formatDate(row.verifiedAt) },
        ]}
      />
    </div>
  );
}
