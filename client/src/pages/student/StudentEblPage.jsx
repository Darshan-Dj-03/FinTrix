import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";

import { billApi } from "../../api/billApi";
import { eblApi } from "../../api/eblApi";
import { DataTable } from "../../components/common/DataTable";
import { ErrorState } from "../../components/common/ErrorState";
import { LoadingState } from "../../components/common/LoadingState";
import { MonthPicker } from "../../components/common/MonthPicker";
import { PageHeader } from "../../components/common/PageHeader";
import { StatusBadge } from "../../components/common/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useAuthStore } from "../../store/authStore";
import { CURRENT_MONTH, MONTH_OPTIONS, parseMonthValue } from "../../utils/constants";
import { formatCurrency } from "../../utils/formatters";

const getDifferenceTotal = (totals = {}) => Number(totals?.totalDifference || 0);
const getClaimedTotal = (totals = {}) => Number(totals?.totalClaimedAmount || totals?.totalScholarship || 0);
const getRemainingTotal = (totals = {}) => Number(totals?.totalRemainingBalance || 0);
const getMonthOffset = (value, offset) => {
  const index = MONTH_OPTIONS.indexOf(value);
  if (index === -1) return value;
  return MONTH_OPTIONS[Math.max(0, Math.min(MONTH_OPTIONS.length - 1, index - offset))];
};

const getSortableMonthValue = (month) => {
  const { monthIndex, year } = parseMonthValue(month);
  return year * 12 + monthIndex;
};

const DEFAULT_FORM = {
  fromMonth: getMonthOffset(CURRENT_MONTH, 3),
  toMonth: CURRENT_MONTH,
  monthlyGoiAmount: "",
  periodUtr: "",
  scholarshipNotes: "",
};

export function StudentEblPage() {
  const studentProfile = useAuthStore((state) => state.studentProfile);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(DEFAULT_FORM);
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: ["student-ebl-status-page"],
    queryFn: eblApi.getStudentStatus,
    enabled: Boolean(studentProfile?._id),
  });
  const billHistoryQuery = useQuery({
    queryKey: ["student-ebl-bills", studentProfile?._id],
    queryFn: () => billApi.getStudentBillHistory(studentProfile._id, { limit: 240 }),
    enabled: Boolean(studentProfile?._id),
  });

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      const normalizedPayload = {
        studentId: studentProfile?._id,
        fromMonth: payload.fromMonth,
        toMonth: payload.toMonth,
        monthlyGoiAmount: Number(payload.monthlyGoiAmount || 0),
        periodUtr: payload.periodUtr,
        scholarshipNotes: payload.scholarshipNotes,
      };

      return editingId
        ? eblApi.updatePeriod(editingId, normalizedPayload)
        : eblApi.createPeriod(normalizedPayload);
    },
    onSuccess: (response) => {
      const savedPeriod = response?.data;
      queryClient.setQueryData(["student-ebl-status-page"], (current) => {
        const existingPeriods = current?.data?.periods || [];
        const nextPeriods = editingId
          ? existingPeriods.map((row) => (row._id === savedPeriod._id ? savedPeriod : row))
          : [savedPeriod, ...existingPeriods.filter((row) => row._id !== savedPeriod._id)];

        return {
          ...(current || { success: true }),
          data: {
            ...(current?.data || {}),
            periods: nextPeriods,
          },
        };
      });
      toast.success(editingId ? "EBL claim updated." : "EBL claim details submitted.");
      setEditingId("");
      setForm(DEFAULT_FORM);
      statusQuery.refetch();
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Unable to save EBL details.");
    },
  });

  const periods = statusQuery.data?.data?.periods || [];
  const student = statusQuery.data?.data?.student;
  const hasLockedPeriod = periods.some((period) => period.status !== "draft");
  const selectedPeriodMessBillTotal = ((billHistoryQuery.data?.data) || [])
    .filter((row) => {
      const currentValue = getSortableMonthValue(row.month);
      const fromValue = getSortableMonthValue(form.fromMonth);
      const toValue = getSortableMonthValue(form.toMonth);
      const lowerBound = Math.min(fromValue, toValue);
      const upperBound = Math.max(fromValue, toValue);
      return currentValue >= lowerBound && currentValue <= upperBound;
    })
    .reduce((sum, row) => sum + Number(row.total_amount || 0), 0);
  const totals = {
    totalMessBill: periods.reduce((sum, period) => sum + Number(period.totals?.totalMessBill || 0), 0),
    totalScholarship: periods.reduce((sum, period) => sum + getClaimedTotal(period.totals), 0),
    totalDifference: periods.reduce((sum, period) => sum + getDifferenceTotal(period.totals), 0),
    totalRemaining: periods.reduce((sum, period) => sum + getRemainingTotal(period.totals), 0),
  };

  if (statusQuery.isLoading || billHistoryQuery.isLoading) {
    return <LoadingState label="Loading EBL details..." />;
  }

  if (statusQuery.isError || billHistoryQuery.isError) {
    return (
      <ErrorState
        description="Unable to load EBL details."
        onRetry={() => {
          statusQuery.refetch();
          billHistoryQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="EBL"
        title="EBL applicability"
        description="Submit your GOI sanctioned amount, selected month range, and scholarship UTR here, then review the EBL periods recorded against your account."
      />

      {student?.isEBL ? (
        <div className="panel p-6">
          <h2 className="section-title">{editingId ? "Update EBL claim details" : "Submit EBL claim details"}</h2>
          {hasLockedPeriod ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              One or more EBL claims have already been accepted by the caretaker. Accepted claims can no longer be edited from the student side.
            </div>
          ) : null}
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <MonthPicker label="From month" value={form.fromMonth} onChange={(value) => setForm((current) => ({ ...current, fromMonth: value }))} />
            <MonthPicker label="To month" value={form.toMonth} onChange={(value) => setForm((current) => ({ ...current, toMonth: value }))} />
            <div>
              <label className="field-label">Total mess bill for selected period</label>
              <Input readOnly value={formatCurrency(selectedPeriodMessBillTotal)} />
            </div>
            <div>
              <label className="field-label">GOI sanctioned amount</label>
              <Input
                type="number"
                value={form.monthlyGoiAmount}
                onChange={(event) => setForm((current) => ({ ...current, monthlyGoiAmount: event.target.value }))}
                placeholder="Enter sanctioned amount"
              />
            </div>
            <div>
              <label className="field-label">Scholarship UTR</label>
              <Input
                value={form.periodUtr}
                onChange={(event) => setForm((current) => ({ ...current, periodUtr: event.target.value }))}
                placeholder="Enter university transfer UTR"
              />
            </div>
            <div className="md:col-span-2">
              <label className="field-label">Notes</label>
              <Input
                value={form.scholarshipNotes}
                onChange={(event) => setForm((current) => ({ ...current, scholarshipNotes: event.target.value }))}
                placeholder="Optional note or sanction reference"
              />
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              type="button"
              loading={saveMutation.isPending}
              disabled={Boolean(editingId && periods.find((row) => row._id === editingId)?.status !== "draft")}
              onClick={() => saveMutation.mutate(form)}
            >
              {editingId ? "Update claim details" : "Submit claim details"}
            </Button>
            {editingId ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditingId("");
                  setForm(DEFAULT_FORM);
                }}
              >
                Cancel edit
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

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
          <div className="mt-5 grid gap-4 md:grid-cols-4 xl:grid-cols-5">
            <div className="panel-soft p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Total mess bill</p>
              <p className="mt-2 text-lg font-semibold text-slate-800">{formatCurrency(totals.totalMessBill)}</p>
            </div>
            <div className="panel-soft p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">GOI sanctioned</p>
              <p className="mt-2 text-lg font-semibold text-slate-800">{formatCurrency(totals.totalScholarship)}</p>
            </div>
            <div className="panel-soft p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">University claim</p>
              <p className="mt-2 text-lg font-semibold text-slate-800">
                {formatCurrency(periods.reduce((sum, period) => sum + getClaimedTotal(period.totals), 0))}
              </p>
            </div>
            <div className="panel-soft p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Total difference</p>
              <p className="mt-2 text-lg font-semibold text-slate-800">{formatCurrency(totals.totalDifference)}</p>
            </div>
            <div className="panel-soft p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Remaining balance</p>
              <p className="mt-2 text-lg font-semibold text-slate-800">{formatCurrency(totals.totalRemaining)}</p>
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
              { key: "goi", label: "GOI Sanctioned", render: (row) => formatCurrency(row.totals?.totalScholarship) },
              { key: "claimed", label: "University Claim", render: (row) => formatCurrency(getClaimedTotal(row.totals)) },
              { key: "utr", label: "Period UTR", render: (row) => row.periodUtr || "-" },
              { key: "difference", label: "Difference Total", render: (row) => formatCurrency(getDifferenceTotal(row.totals)) },
              { key: "remaining", label: "Remaining Balance", render: (row) => formatCurrency(getRemainingTotal(row.totals)) },
              {
                key: "actions",
                label: "Actions",
                render: (row) => (
                  row.status === "draft" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingId(row._id);
                        setForm({
                          fromMonth: row.fromMonth,
                          toMonth: row.toMonth,
                          monthlyGoiAmount: String(row.monthlyGoiAmount || ""),
                          periodUtr: row.periodUtr || "",
                          scholarshipNotes: row.scholarshipNotes || "",
                        });
                      }}
                    >
                      Edit
                    </Button>
                  ) : (
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Locked</span>
                  )
                ),
              },
            ]}
            emptyMessage="No EBL periods have been recorded for this student yet."
          />
        </div>
      </div>
    </div>
  );
}
