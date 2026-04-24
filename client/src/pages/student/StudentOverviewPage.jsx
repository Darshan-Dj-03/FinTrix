import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, Download, Receipt, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";

import { authApi } from "../../api/authApi";
import { billApi } from "../../api/billApi";
import { eblApi } from "../../api/eblApi";
import { paymentApi } from "../../api/paymentApi";
import { LoadingState } from "../../components/common/LoadingState";
import { ErrorState } from "../../components/common/ErrorState";
import { MonthPicker } from "../../components/common/MonthPicker";
import { PageHeader } from "../../components/common/PageHeader";
import { StatCard } from "../../components/common/StatCard";
import { StatusBadge } from "../../components/common/StatusBadge";
import { useAuthStore } from "../../store/authStore";
import { useBillDownload } from "../../hooks/useBillDownload";
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

export function StudentOverviewPage() {
  const studentProfile = useAuthStore((state) => state.studentProfile);
  const user = useAuthStore((state) => state.user);
  const [month, setMonth] = useState(CURRENT_MONTH);
  const downloadBill = useBillDownload();

  useQuery({
    queryKey: ["auth", "me", "student-overview"],
    queryFn: authApi.getMe,
    enabled: Boolean(user?.id),
    refetchOnWindowFocus: true,
    onSuccess: (response) => {
      useAuthStore.getState().updateProfile({
        user: response.data.user,
        studentProfile: response.data.studentProfile,
      });
    },
  });

  const billQuery = useQuery({
    queryKey: ["student-bill-overview", studentProfile?._id, month],
    queryFn: () => billApi.getStudentBill(studentProfile._id, month),
    enabled: Boolean(studentProfile?._id),
  });
  const paymentsQuery = useQuery({
    queryKey: ["student-payment-overview", month],
    queryFn: () => paymentApi.list({ month }),
  });
  const eblStatusQuery = useQuery({
    queryKey: ["student-ebl-overview"],
    queryFn: eblApi.getStudentStatus,
    enabled: Boolean(studentProfile?._id && studentProfile?.isEBL),
  });

  const matchingEblPeriod = (eblStatusQuery.data?.data?.periods || []).find((period) =>
    isMonthInsidePeriod(month, period.fromMonth, period.toMonth)
  );
  const bill = billQuery.data?.data;
  const isEblMonth = Boolean(
    bill?.is_ebl_student ||
      matchingEblPeriod ||
      (studentProfile?.isEBL &&
        (bill?.student_utr_number || Number(bill?.amount_paid || 0) > 0 || bill?.payment_status === "paid"))
  );

  const totals = useMemo(() => {
    const payments = paymentsQuery.data?.data || [];
    if (isEblMonth && Number(bill?.amount_paid || 0) > 0) {
      return {
        count: 1,
        collected: Number(bill.amount_paid || 0),
      };
    }

    return {
      count: payments.length,
      collected: payments.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    };
  }, [bill?.amount_paid, isEblMonth, paymentsQuery.data?.data]);

  if (billQuery.isLoading || paymentsQuery.isLoading || eblStatusQuery.isLoading) {
    return <LoadingState label="Loading your student overview..." />;
  }

  if (billQuery.isError || paymentsQuery.isError || eblStatusQuery.isError) {
    return (
      <ErrorState
        description="Could not load your billing overview."
        onRetry={() => {
          billQuery.refetch();
          paymentsQuery.refetch();
          eblStatusQuery.refetch();
        }}
      />
    );
  }

  const currentPayable = isEblMonth
    ? Math.max(0, Number(bill?.ebl_remaining_balance || bill?.outstanding_amount || 0))
    : Math.max(0, Number(bill?.total_amount || 0) + Number(bill?.fine || 0) - Number(bill?.amount_paid || 0));
  const currentFine = isEblMonth ? 0 : bill?.fine || 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Student workspace"
        title={`Hello, ${user?.name?.split(" ")[0] || "Student"}`}
        action={
          <div className="w-full max-w-sm">
            <MonthPicker label="Bill month" value={month} onChange={setMonth} />
          </div>
        }
      />

      <div className="grid gap-5 md:grid-cols-3">
        <StatCard label="Current payable" value={currentPayable} icon={Receipt} />
        <StatCard label="Current fine" value={currentFine} tone="mint" icon={CreditCard} />
        <div className="panel p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">EBL applicability</p>
              <div className="mt-4">
                <StatusBadge value={studentProfile?.isEBL ? "available" : "not_applicable"} />
              </div>
            </div>
            <div className="rounded-2xl bg-orange-100 p-3 text-orange-600">
              <ShieldCheck size={20} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="panel p-6">
          <h2 className="section-title">Current bill snapshot</h2>
          {bill ? (
            <div className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="panel-soft p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Base mess</p>
                  <p className="mt-2 text-lg font-semibold text-slate-800">{formatCurrency(bill.base_mess)}</p>
                </div>
                <div className="panel-soft p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Absent days</p>
                  <p className="mt-2 text-lg font-semibold text-slate-800">{Number(bill.absent_days || 0)}</p>
                </div>
                <div className="panel-soft p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Absence deduction</p>
                  <p className="mt-2 text-lg font-semibold text-slate-800">{formatCurrency(bill.absence_deduction || 0)}</p>
                </div>
                <div className="panel-soft p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Utilities + labour</p>
                  <p className="mt-2 text-lg font-semibold text-slate-800">
                    {formatCurrency((bill.keb_charge || 0) + (bill.labour_charge || 0))}
                  </p>
                </div>
                <div className="panel-soft p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Announcement date</p>
                  <p className="mt-2 text-lg font-semibold text-slate-800">{formatDate(bill.announcement_date)}</p>
                </div>
                <div className="panel-soft p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Due date</p>
                  <p className="mt-2 text-lg font-semibold text-slate-800">{formatDate(bill.due_date)}</p>
                </div>
              </div>
              <div className="rounded-3xl bg-ink px-6 py-5 text-white">
                <p className="text-xs uppercase tracking-[0.28em] text-white/60">Amount paid</p>
                <p className="mt-3 font-display text-4xl font-bold">{formatCurrency(bill.amount_paid || 0)}</p>
              </div>
              {isEblMonth ? (
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="panel-soft p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Claimed amount</p>
                    <p className="mt-2 text-lg font-semibold text-slate-800">{formatCurrency(bill.ebl_claimed_amount || 0)}</p>
                  </div>
                  <div className="panel-soft p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Difference amount</p>
                    <p className="mt-2 text-lg font-semibold text-slate-800">{formatCurrency(bill.ebl_difference_amount || 0)}</p>
                  </div>
                  <div className="panel-soft p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Remaining balance</p>
                    <p className="mt-2 text-lg font-semibold text-slate-800">{formatCurrency(bill.ebl_remaining_balance || 0)}</p>
                  </div>
                </div>
              ) : null}
              <p className="text-sm text-slate-500">
                {isEblMonth
                  ? "This month is tracked through the EBL workflow. The claimed amount, difference amount, and remaining balance are shown here, and the caretaker updates the balance after collection."
                  : "Late fine is updated daily after the due date: Rs.2 per day for the first 30 days, then Rs.5 per day."}
              </p>
            </div>
          ) : (
            <div className="panel-soft mt-5 p-6 text-sm text-slate-500">No bill available for this month.</div>
          )}
        </div>

        <div className="panel p-6">
          <h2 className="section-title">Quick actions</h2>
          <div className="mt-5 space-y-3">
            <button
              type="button"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white shadow-md transition duration-200 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
              onClick={() => {
                if (!studentProfile?._id || !bill?.month) {
                  toast.error("Bill PDF is not available yet.");
                  return;
                }
                downloadBill(studentProfile._id, bill.month);
              }}
            >
              <Download size={16} />
              Download bill PDF
            </button>
            <div className="panel-soft p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Payments made</p>
              <p className="mt-2 text-2xl font-bold text-slate-800">{totals.count}</p>
            </div>
            <div className="panel-soft p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Collected payments</p>
              <p className="mt-2 text-2xl font-bold text-slate-800">{formatCurrency(totals.collected)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
