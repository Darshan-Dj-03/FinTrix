import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";

import { eblApi } from "../../api/eblApi";
import { DataTable } from "../../components/common/DataTable";
import { ErrorState } from "../../components/common/ErrorState";
import { LoadingState } from "../../components/common/LoadingState";
import { PageHeader } from "../../components/common/PageHeader";
import { StatusBadge } from "../../components/common/StatusBadge";
import { useAuthStore } from "../../store/authStore";
import { formatCurrency } from "../../utils/formatters";

const getDifferenceTotal = (totals = {}) => Number(totals?.totalDifference || 0);

export function StudentEblPage() {
  const studentProfile = useAuthStore((state) => state.studentProfile);

  const statusQuery = useQuery({
    queryKey: ["student-ebl-status-page"],
    queryFn: eblApi.getStudentStatus,
    enabled: Boolean(studentProfile?._id),
  });

  const periods = statusQuery.data?.data?.periods || [];
  const student = statusQuery.data?.data?.student;
  const totals = useMemo(
    () => ({
      totalMessBill: periods.reduce((sum, period) => sum + Number(period.totals?.totalMessBill || 0), 0),
      totalScholarship: periods.reduce((sum, period) => sum + Number(period.totals?.totalScholarship || 0), 0),
      totalDifference: periods.reduce((sum, period) => sum + getDifferenceTotal(period.totals), 0),
    }),
    [periods]
  );

  if (statusQuery.isLoading) {
    return <LoadingState label="Loading EBL details..." />;
  }

  if (statusQuery.isError) {
    return <ErrorState description="Unable to load EBL details." onRetry={() => statusQuery.refetch()} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="EBL"
        title="EBL applicability"
        description="Check whether your account is EBL-applicable and review the reimbursement periods recorded by the caretaker."
      />

      <div className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
        <div className="panel p-6">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-400">EBL applicability</p>
          <div className="mt-4 flex items-center justify-between">
            <StatusBadge value={student?.isEBL ? "available" : "not_applicable"} />
            <div className="rounded-2xl bg-orange-100 p-3 text-orange-600">
              <ShieldCheck size={20} />
            </div>
          </div>
          <div className="mt-5 space-y-2 text-sm text-slate-500">
            <p>
              Periods: <span className="font-semibold text-slate-700">{periods.length}</span>
            </p>
          </div>
        </div>

        <div className="panel p-6">
          <h2 className="section-title">Recorded totals</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="panel-soft p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Total mess bill</p>
              <p className="mt-2 text-lg font-semibold text-slate-800">{formatCurrency(totals.totalMessBill)}</p>
            </div>
            <div className="panel-soft p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Total GOI amount</p>
              <p className="mt-2 text-lg font-semibold text-slate-800">{formatCurrency(totals.totalScholarship)}</p>
            </div>
            <div className="panel-soft p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Total difference</p>
              <p className="mt-2 text-lg font-semibold text-slate-800">{formatCurrency(totals.totalDifference)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="panel p-6">
        <h2 className="section-title">EBL periods</h2>
        <div className="mt-5">
          <DataTable
            rows={periods}
            columns={[
              { key: "period", label: "Period", render: (row) => `${row.fromMonth} to ${row.toMonth}` },
              { key: "messBill", label: "Mess Bill Total", render: (row) => formatCurrency(row.totals?.totalMessBill) },
              { key: "goi", label: "GOI Amount", render: (row) => formatCurrency(row.monthlyGoiAmount) },
              { key: "utr", label: "Period UTR", render: (row) => row.periodUtr || "-" },
              { key: "difference", label: "Difference Total", render: (row) => formatCurrency(getDifferenceTotal(row.totals)) },
            ]}
            emptyMessage="No EBL periods have been recorded for this student yet."
          />
        </div>
      </div>
    </div>
  );
}
