import { useState } from "react";
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
  monthlyGoiAmount: "",
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

  const selectedRangeMessBillTotal = ((billHistoryQuery.data?.data) || [])
    .filter((row) => {
      const currentValue = getSortableMonthValue(row.month);
      const fromValue = getSortableMonthValue(form.fromMonth);
      const toValue = getSortableMonthValue(form.toMonth);
      const lowerBound = Math.min(fromValue, toValue);
      const upperBound = Math.max(fromValue, toValue);
      return currentValue >= lowerBound && currentValue <= upperBound;
    })
    .reduce((sum, row) => sum + Number(row.total_amount || 0), 0);

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (!eblStudents.find((item) => item._id === payload.studentId)) {
        throw new Error("Select a valid EBL student first.");
      }

      const normalizedPayload = {
        studentId: payload.studentId,
        monthlyGoiAmount: Number(payload.monthlyGoiAmount || 0),
        periodUtr: payload.periodUtr,
        scholarshipNotes: payload.scholarshipNotes,
      };

      if (editingId) {
        return eblApi.updatePeriod(editingId, normalizedPayload);
      }

      return eblApi.createPeriod({
        ...normalizedPayload,
        fromMonth: payload.fromMonth,
        toMonth: payload.toMonth,
      });
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
      toast.success(editingId ? "EBL period updated." : "EBL period created.");
      setEditingId("");
      setForm(DEFAULT_FORM);
      periodsQuery.refetch();
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || error?.message || "Unable to save EBL period.");
    },
  });

  const generateReportMutation = useMutation({
    mutationFn: ({ reportType }) =>
      eblApi.generateReport({
        reportType,
        fromMonth: form.fromMonth,
        toMonth: form.toMonth,
      }),
    onSuccess: () => {
      toast.success("EBL report generated.");
      reportsQuery.refetch();
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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="EBL"
        title="EBL reimbursement workspace"
        description="Create EBL periods, record the GOI sanctioned amount for a selected range, and generate the period reports used in approvals."
      />

      <div className="panel p-6">
        <h2 className="section-title">{editingId ? "Update EBL period" : "Create EBL period"}</h2>
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
            <label className="field-label">GOI sanctioned amount</label>
            <Input type="number" value={form.monthlyGoiAmount} onChange={(event) => setForm((current) => ({ ...current, monthlyGoiAmount: event.target.value }))} />
          </div>
          <MonthPicker label="From month" value={form.fromMonth} onChange={(value) => setForm((current) => ({ ...current, fromMonth: value }))} />
          <MonthPicker label="To month" value={form.toMonth} onChange={(value) => setForm((current) => ({ ...current, toMonth: value }))} />
          <div>
            <label className="field-label">Period UTR</label>
            <Input value={form.periodUtr} onChange={(event) => setForm((current) => ({ ...current, periodUtr: event.target.value }))} placeholder="Scholarship transfer UTR" />
          </div>
          <div className="md:col-span-2 xl:col-span-3">
            <label className="field-label">Scholarship notes</label>
            <Input value={form.scholarshipNotes} onChange={(event) => setForm((current) => ({ ...current, scholarshipNotes: event.target.value }))} placeholder="Sanction note or supporting detail" />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Button type="button" loading={saveMutation.isPending} onClick={() => saveMutation.mutate(form)}>
            {editingId ? "Update period" : "Save period"}
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

      <div className="panel p-6">
        <h2 className="section-title">EBL report generation</h2>
        <p className="mt-2 text-sm text-slate-500">
          Generate the period reports here. They will appear in the reports page and the warden approval flow.
        </p>
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
              { key: "goi", label: "GOI Amount", render: (row) => formatCurrency(row.monthlyGoiAmount) },
              { key: "utr", label: "Period UTR", render: (row) => row.periodUtr || "-" },
              { key: "difference", label: "Difference Total", render: (row) => formatCurrency(row.totals?.totalDifference) },
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
