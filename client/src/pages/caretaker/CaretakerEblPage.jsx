import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

import { billApi } from "../../api/billApi";
import { eblApi } from "../../api/eblApi";
import { studentApi } from "../../api/studentApi";
import { DataTable } from "../../components/common/DataTable";
import { ErrorState } from "../../components/common/ErrorState";
import { LoadingState } from "../../components/common/LoadingState";
import { MonthPicker } from "../../components/common/MonthPicker";
import { PageHeader } from "../../components/common/PageHeader";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { CURRENT_MONTH, MONTH_OPTIONS, parseMonthValue } from "../../utils/constants";
import { formatCurrency } from "../../utils/formatters";

const getMonthOffset = (value, offset) => {
  const index = MONTH_OPTIONS.indexOf(value);
  if (index === -1) return value;
  return MONTH_OPTIONS[Math.max(0, Math.min(MONTH_OPTIONS.length - 1, index - offset))];
};

const DEFAULT_FORM = {
  studentId: "",
  fromMonth: getMonthOffset(CURRENT_MONTH, 3),
  toMonth: CURRENT_MONTH,
  universityClaimAmount: "",
  periodUtr: "",
  scholarshipNotes: "",
};

const getSortableMonthValue = (month) => {
  const { monthIndex, year } = parseMonthValue(month);
  return year * 12 + monthIndex;
};

export function CaretakerEblPage() {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [editingId, setEditingId] = useState("");
  const [reportRange, setReportRange] = useState({
    fromMonth: getMonthOffset(CURRENT_MONTH, 3),
    toMonth: CURRENT_MONTH,
  });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const studentsQuery = useQuery({
    queryKey: ["caretaker-ebl-students"],
    queryFn: studentApi.list,
  });
  const periodsQuery = useQuery({
    queryKey: ["caretaker-ebl-periods"],
    queryFn: () => eblApi.listPeriods(),
  });
  const billHistoryQuery = useQuery({
    queryKey: ["caretaker-ebl-bills", form.studentId],
    queryFn: () => billApi.getStudentBillHistory(form.studentId, { limit: 240 }),
    enabled: Boolean(form.studentId),
  });

  const eblStudents = (studentsQuery.data?.students || []).filter((student) => student.isEBL);
  const selectedRangeBills = useMemo(
    () =>
      ((billHistoryQuery.data?.data) || [])
        .filter((row) => {
          const currentValue = getSortableMonthValue(row.month);
          const fromValue = getSortableMonthValue(form.fromMonth);
          const toValue = getSortableMonthValue(form.toMonth);
          const lowerBound = Math.min(fromValue, toValue);
          const upperBound = Math.max(fromValue, toValue);
          return currentValue >= lowerBound && currentValue <= upperBound;
        })
        .sort((left, right) => getSortableMonthValue(left.month) - getSortableMonthValue(right.month)),
    [billHistoryQuery.data?.data, form.fromMonth, form.toMonth]
  );

  const periods = periodsQuery.data?.data || [];
  const matchedPeriod = periods.find(
    (row) =>
      String(row.studentId?._id || row.studentId) === String(form.studentId) &&
      row.fromMonth === form.fromMonth &&
      row.toMonth === form.toMonth
  );
  const selectedRangeMessBillTotal = selectedRangeBills.reduce((sum, row) => sum + Number(row.total_amount || 0), 0);
  const selectedRangeDifferenceTotal = selectedRangeBills.reduce(
    (sum, row) => sum + Number(row.ebl_difference_amount || 0),
    0
  );
  const appliedUniversityClaimTotal = Math.min(
    Math.max(Number(form.universityClaimAmount || 0), 0),
    Math.max(selectedRangeDifferenceTotal, 0)
  );
  const totalDifferenceWeight = selectedRangeBills.reduce(
    (sum, row) => sum + Math.max(Number(row.ebl_difference_amount || 0), 0),
    0
  );
  const settlementRows = selectedRangeBills.map((row) => {
    const differenceAmount = Number(row.ebl_difference_amount || 0);
    const claimedAmount =
      totalDifferenceWeight > 0
        ? Math.round(((appliedUniversityClaimTotal * differenceAmount) / totalDifferenceWeight + Number.EPSILON) * 100) / 100
        : 0;
    const remainingBalance = Math.max(differenceAmount - claimedAmount, 0);

    return {
      ...row,
      claimedAmount,
      differenceAmount,
      remainingBalance,
    };
  });

  useEffect(() => {
    if (!matchedPeriod) {
      return;
    }

    setEditingId((current) => (current === matchedPeriod._id ? current : matchedPeriod._id));
    setForm((current) => {
      const nextForm = {
        ...current,
        universityClaimAmount: String(matchedPeriod.universityClaimAmount || ""),
        periodUtr: matchedPeriod.periodUtr || "",
        scholarshipNotes: matchedPeriod.scholarshipNotes || "",
      };

      return JSON.stringify(nextForm) === JSON.stringify(current) ? current : nextForm;
    });
  }, [matchedPeriod]);

  useEffect(() => {
    if (!matchedPeriod && editingId) {
      setEditingId("");
    }
  }, [matchedPeriod, editingId]);

  useEffect(() => {
    if (matchedPeriod) {
      return;
    }

    setForm((current) => {
      if (!current.universityClaimAmount && !current.periodUtr && !current.scholarshipNotes) {
        return current;
      }

      return {
        ...current,
        universityClaimAmount: "",
        periodUtr: "",
        scholarshipNotes: "",
      };
    });
  }, [matchedPeriod, form.studentId, form.fromMonth, form.toMonth]);

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (!eblStudents.find((item) => item._id === payload.studentId)) {
        throw new Error("Select a valid EBL student first.");
      }

      const normalizedPayload = {
        studentId: payload.studentId,
        universityClaimAmount: Number(payload.universityClaimAmount || 0),
        periodUtr: payload.periodUtr,
        scholarshipNotes: payload.scholarshipNotes,
      };

      if (matchedPeriod?._id || editingId) {
        return eblApi.updatePeriod(matchedPeriod?._id || editingId, normalizedPayload);
      }

      throw new Error("Student EBL details must be submitted first before recording the university claim.");
    },
    onSuccess: (response) => {
      const savedPeriod = response?.data;
      if (savedPeriod) {
        queryClient.setQueryData(["caretaker-ebl-periods"], (current) => {
          const existingRows = current?.data || [];
          const nextRows = editingId
            ? existingRows.map((row) => (row._id === savedPeriod._id ? savedPeriod : row))
            : [savedPeriod, ...existingRows.filter((row) => row._id !== savedPeriod._id)];

          return {
            ...(current || { success: true }),
            data: nextRows,
          };
        });
      }
      toast.success("University claim updated.");
      periodsQuery.refetch();
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || error?.message || "Unable to save university claim.");
    },
  });
  const verifyMutation = useMutation({
    mutationFn: (id) => eblApi.verifyPeriod(id),
    onSuccess: (response) => {
      const savedPeriod = response?.data;
      if (savedPeriod) {
        queryClient.setQueryData(["caretaker-ebl-periods"], (current) => {
          const existingRows = current?.data || [];
          return {
            ...(current || { success: true }),
            data: existingRows.map((row) => (row._id === savedPeriod._id ? savedPeriod : row)),
          };
        });
      }
      toast.success("EBL claim accepted.");
      periodsQuery.refetch();
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Unable to accept EBL claim.");
    },
  });

  const generateReportMutation = useMutation({
    mutationFn: ({ reportType }) =>
      eblApi.generateReport({
        reportType,
        fromMonth: reportRange.fromMonth,
        toMonth: reportRange.toMonth,
      }),
    onSuccess: () => {
      toast.success("EBL report generated.");
      navigate("/caretaker/reports");
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Unable to generate EBL report."),
  });

  if (studentsQuery.isLoading || periodsQuery.isLoading || billHistoryQuery.isLoading) {
    return <LoadingState label="Loading EBL workspace..." />;
  }

  if (studentsQuery.isError || periodsQuery.isError || billHistoryQuery.isError) {
    return (
      <ErrorState
        description="Unable to load EBL workspace."
        onRetry={() => {
          studentsQuery.refetch();
          periodsQuery.refetch();
          billHistoryQuery.refetch();
        }}
      />
    );
  }

  const draftPeriods = (periodsQuery.data?.data || []).filter((row) => row.status === "draft");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="EBL"
        title="EBL reimbursement workspace"
        description="Review submitted EBL periods, manage remaining balance settlements, and generate the period reports used in approvals."
      />

      <div className="panel p-6">
        <h2 className="section-title">Submitted EBL scholarship details</h2>
        <p className="mt-2 text-sm text-slate-500">
          Review the GOI amount, duration, UTR, and notes submitted by students, then accept the claim to lock student edits.
        </p>
        <div className="mt-5">
          <DataTable
            rows={draftPeriods}
            columns={[
              { key: "studentId", label: "Student ID", render: (row) => row.studentId?.studentId || "-" },
              { key: "name", label: "Name", render: (row) => row.userId?.name || "-" },
              { key: "period", label: "Duration", render: (row) => `${row.fromMonth} to ${row.toMonth}` },
              { key: "messBill", label: "Mess Bill", render: (row) => formatCurrency(row.totals?.totalMessBill) },
              { key: "claimed", label: "GOI Claimed", render: (row) => formatCurrency(row.totals?.totalClaimedAmount || row.monthlyGoiAmount) },
              { key: "utr", label: "UTR", render: (row) => row.periodUtr || "-" },
              { key: "notes", label: "Notes", render: (row) => row.scholarshipNotes || "-" },
              {
                key: "actions",
                label: "Actions",
                render: (row) => (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      loading={verifyMutation.isPending}
                      onClick={() => verifyMutation.mutate(row._id)}
                    >
                      Accept
                    </Button>
                  </div>
                ),
              },
            ]}
            emptyMessage="No student-submitted EBL claims are waiting for caretaker acceptance."
          />
        </div>
      </div>

      <div className="panel p-6">
        <h2 className="section-title">EBL claim From University</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <label className="field-label">EBL student</label>
            <Select value={form.studentId} onChange={(event) => setForm((current) => ({ ...current, studentId: event.target.value }))}>
              <option value="">Select student</option>
              {eblStudents.map((student) => (
                <option key={student._id} value={student._id}>
                  {student.studentId} - {student.userId?.name || "Student"}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="field-label">Mess bill amount</label>
            <Input readOnly value={formatCurrency(selectedRangeMessBillTotal)} />
          </div>
          <div>
            <label className="field-label">Difference amount for selected period</label>
            <Input readOnly value={formatCurrency(selectedRangeDifferenceTotal)} />
          </div>
          <MonthPicker label="From month" value={form.fromMonth} onChange={(value) => setForm((current) => ({ ...current, fromMonth: value }))} />
          <MonthPicker label="To month" value={form.toMonth} onChange={(value) => setForm((current) => ({ ...current, toMonth: value }))} />
          <div>
            <label className="field-label">Amount claimed from university</label>
            <Input
              type="number"
              value={form.universityClaimAmount}
              onChange={(event) => setForm((current) => ({ ...current, universityClaimAmount: event.target.value }))}
            />
          </div>
          <div>
            <label className="field-label">Period UTR</label>
            <Input value={form.periodUtr} onChange={(event) => setForm((current) => ({ ...current, periodUtr: event.target.value }))} placeholder="Scholarship transfer UTR" />
          </div>
          <div className="md:col-span-2 xl:col-span-3">
            <label className="field-label">Scholarship notes</label>
            <Input value={form.scholarshipNotes} onChange={(event) => setForm((current) => ({ ...current, scholarshipNotes: event.target.value }))} placeholder="Sanction note or supporting detail" />
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Claim and remaining balance</h3>
              <p className="mt-2 text-sm text-slate-500">
                The university claim is reduced from the period difference amount, and the remaining balance shows what the student still needs to pay.
              </p>
            </div>
            <div className="rounded-2xl bg-white px-4 py-3 text-right shadow-sm">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Remaining Total</p>
              <p className="mt-1 text-lg font-semibold text-slate-800">
                {formatCurrency(settlementRows.reduce((sum, row) => sum + Number(row.remainingBalance || 0), 0))}
              </p>
            </div>
          </div>

          {settlementRows.length ? (
            <div className="mt-5 space-y-4">
              {settlementRows.map((row) => (
                <div key={row.month} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="grid gap-4 lg:grid-cols-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Month</p>
                      <p className="mt-2 text-sm font-semibold text-slate-800">{row.month}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">University Claim</p>
                      <p className="mt-2 text-sm font-semibold text-slate-800">{formatCurrency(row.claimedAmount)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Difference Amount</p>
                      <p className="mt-2 text-sm font-semibold text-slate-800">{formatCurrency(row.differenceAmount)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Remaining Balance</p>
                      <p className="mt-2 text-sm font-semibold text-slate-800">{formatCurrency(row.remainingBalance)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
              Select an EBL student and the same month range submitted by the student to record the university claim.
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Button type="button" loading={saveMutation.isPending} onClick={() => saveMutation.mutate(form)}>
            Save university claim
          </Button>
        </div>
      </div>

      <div className="panel p-6">
        <h2 className="section-title">EBL report generation</h2>
        <p className="mt-2 text-sm text-slate-500">
          Generate the period reports here. They will appear in the reports page and the warden approval flow.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <MonthPicker
            label="Report from month"
            value={reportRange.fromMonth}
            onChange={(value) => setReportRange((current) => ({ ...current, fromMonth: value }))}
          />
          <MonthPicker
            label="Report to month"
            value={reportRange.toMonth}
            onChange={(value) => setReportRange((current) => ({ ...current, toMonth: value }))}
          />
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <Button
            type="button"
            variant="secondary"
            loading={generateReportMutation.isPending}
            onClick={() => generateReportMutation.mutate({ reportType: "pre_receipt" })}
          >
            Generate Pre-Receipt
          </Button>
          <Button
            type="button"
            variant="secondary"
            loading={generateReportMutation.isPending}
            onClick={() => generateReportMutation.mutate({ reportType: "month_wise" })}
          >
            Generate Month-wise Calculation
          </Button>
          <Button
            type="button"
            variant="secondary"
            loading={generateReportMutation.isPending}
            onClick={() => generateReportMutation.mutate({ reportType: "university_claim" })}
          >
            Generate University Claim Report
          </Button>
          <Button
            type="button"
            variant="secondary"
            loading={generateReportMutation.isPending}
            onClick={() => generateReportMutation.mutate({ reportType: "university_claim_month_wise" })}
          >
            Generate University Claim Month-wise
          </Button>
        </div>
      </div>

      <div className="panel p-6">
        <h2 className="section-title">Saved EBL periods</h2>
        <div className="mt-5">
          <DataTable
            rows={periodsQuery.data?.data || []}
            columns={[
              { key: "studentId", label: "Student ID", render: (row) => row.studentId?.studentId || "-" },
              { key: "name", label: "Name", render: (row) => row.userId?.name || "-" },
              { key: "period", label: "Period", render: (row) => `${row.fromMonth} to ${row.toMonth}` },
              { key: "messBill", label: "Mess Bill Total", render: (row) => formatCurrency(row.totals?.totalMessBill) },
              { key: "goi", label: "Claimed Amount", render: (row) => formatCurrency(row.totals?.totalClaimedAmount || row.monthlyGoiAmount) },
              { key: "utr", label: "Period UTR", render: (row) => row.periodUtr || "-" },
              { key: "difference", label: "Difference Total", render: (row) => formatCurrency(row.totals?.totalDifference) },
              { key: "remaining", label: "Remaining Balance", render: (row) => formatCurrency(row.totals?.totalRemainingBalance || 0) },
              {
                key: "actions",
                label: "Actions",
                render: (row) => (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditingId(row._id);
                      setForm({
                        studentId: row.studentId?._id || "",
                        fromMonth: row.fromMonth,
                        toMonth: row.toMonth,
                        monthlyGoiAmount: String(row.monthlyGoiAmount || ""),
                        periodUtr: row.periodUtr || "",
                        scholarshipNotes: row.scholarshipNotes || "",
                        monthlySettlements: Object.fromEntries(
                          (row.monthlyDetails || []).map((detail) => [detail.month, String(detail.studentPaidAmount || 0)])
                        ),
                      });
                    }}
                  >
                    Edit
                  </Button>
                ),
              },
            ]}
            emptyMessage="No EBL periods have been created yet."
          />
        </div>
      </div>
    </div>
  );
}
