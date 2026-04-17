import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { billApi } from "../../api/billApi";
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
import { CURRENT_MONTH } from "../../utils/constants";
import { formatCurrency, formatDate } from "../../utils/formatters";

export function StudentPaymentsPage() {
  const studentProfile = useAuthStore((state) => state.studentProfile);
  const [month, setMonth] = useState(CURRENT_MONTH);
  const form = useForm({ defaultValues: { utrNumber: "" } });

  const billQuery = useQuery({
    queryKey: ["student-payment-bill", studentProfile?._id, month],
    queryFn: () => billApi.getStudentBill(studentProfile._id, month),
    enabled: Boolean(studentProfile?._id),
  });
  const query = useQuery({
    queryKey: ["student-payments-page", month],
    queryFn: () => paymentApi.list({ month }),
  });

  useEffect(() => {
    form.reset({
      utrNumber: billQuery.data?.data?.student_utr_number || "",
    });
  }, [billQuery.data?.data?.student_utr_number, form]);

  const updateStudentPaymentInfoMutation = useMutation({
    mutationFn: ({ billId, payload }) => billApi.updateStudentPaymentInfo(billId, payload),
    onSuccess: () => {
      toast.success("UTR details updated.");
      billQuery.refetch();
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Unable to update UTR details.");
    },
  });

  if (query.isLoading || billQuery.isLoading) return <LoadingState label="Loading payment history..." />;
  if (query.isError || billQuery.isError) return <ErrorState description="Unable to load payment history." onRetry={() => {
    query.refetch();
    billQuery.refetch();
  }} />;

  const bill = billQuery.data?.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Payments"
        title="Payment history"
        description="Keep your payment UTR updated here so the caretaker can verify it against the bill."
        action={
          <div className="w-full max-w-sm">
            <MonthPicker value={month} onChange={setMonth} />
          </div>
        }
      />

      <form
        className="panel p-6"
        onSubmit={form.handleSubmit((values) => {
          if (!bill?._id) {
            toast.error("No active bill found for the selected month.");
            return;
          }

          updateStudentPaymentInfoMutation.mutate({
            billId: bill._id,
            payload: { utrNumber: values.utrNumber.trim() },
          });
        })}
      >
        <h3 className="section-title">Update your UTR</h3>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <label className="field-label">Bill Month</label>
            <Input readOnly value={bill?.month || month} />
          </div>
          <div>
            <label className="field-label">Current Payable</label>
            <Input readOnly value={formatCurrency((bill?.total_amount || 0) + (bill?.fine || 0))} />
          </div>
          <div className="md:col-span-2">
            <label className="field-label">UTR Number</label>
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

      <DataTable
        rows={query.data?.data || []}
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
