import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { advanceApi } from "../../api/advanceApi";
import { studentApi } from "../../api/studentApi";
import { DataTable } from "../../components/common/DataTable";
import { ErrorState } from "../../components/common/ErrorState";
import { LoadingState } from "../../components/common/LoadingState";
import { MonthPicker } from "../../components/common/MonthPicker";
import { PageHeader } from "../../components/common/PageHeader";
import { StatCard } from "../../components/common/StatCard";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { useAuthStore } from "../../store/authStore";
import { CURRENT_MONTH } from "../../utils/constants";
import { formatCurrency, formatDate } from "../../utils/formatters";

const defaultValues = {
  prefectStudentId: "",
  takenAmount: "",
  closedAmount: "",
  chequeDetails: "",
  billDate: "",
};

const formatDateInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

export function CaretakerAdvancesPage() {
  const user = useAuthStore((state) => state.user);
  const [month, setMonth] = useState(CURRENT_MONTH);
  const [editingAdvance, setEditingAdvance] = useState(null);
  const form = useForm({ defaultValues });

  const advancesQuery = useQuery({
    queryKey: ["caretaker-advances", month],
    queryFn: () => advanceApi.list(month),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const studentsQuery = useQuery({
    queryKey: ["caretaker-advance-students"],
    queryFn: studentApi.list,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const studentOptions = useMemo(() => {
    const hostelId = user?.hostelId?._id || user?.hostelId;
    const rows = studentsQuery.data?.students || [];

    return rows
      .filter((student) => {
        const studentHostelId = student.userId?.hostelId?._id || student.userId?.hostelId;
        return !hostelId || String(studentHostelId) === String(hostelId);
      })
      .sort((a, b) => String(a.studentId || "").localeCompare(String(b.studentId || ""), undefined, { numeric: true }));
  }, [studentsQuery.data?.students, user?.hostelId]);

  useEffect(() => {
    if (!editingAdvance) {
      form.reset(defaultValues);
      return;
    }

    form.reset({
      prefectStudentId: editingAdvance.prefectStudentId?._id || "",
      takenAmount: editingAdvance.takenAmount ?? "",
      closedAmount: editingAdvance.closedAmount ?? "",
      chequeDetails: editingAdvance.chequeDetails || "",
      billDate: formatDateInput(editingAdvance.billDates?.[0]?.billDate),
    });
  }, [editingAdvance, form]);

  const createMutation = useMutation({
    mutationFn: advanceApi.create,
    onSuccess: () => {
      toast.success("Advance saved.");
      setEditingAdvance(null);
      form.reset(defaultValues);
      advancesQuery.refetch();
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Unable to save advance."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ advanceId, payload }) => advanceApi.update(advanceId, payload),
    onSuccess: () => {
      toast.success("Advance updated.");
      setEditingAdvance(null);
      form.reset(defaultValues);
      advancesQuery.refetch();
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Unable to update advance."),
  });

  const deleteMutation = useMutation({
    mutationFn: advanceApi.remove,
    onSuccess: () => {
      toast.success("Advance deleted.");
      setEditingAdvance(null);
      form.reset(defaultValues);
      advancesQuery.refetch();
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Unable to delete advance."),
  });

  if (advancesQuery.isLoading || studentsQuery.isLoading) {
    return <LoadingState label="Loading advances..." />;
  }

  if (advancesQuery.isError || studentsQuery.isError) {
    return (
      <ErrorState
        description="Unable to load advances."
        onRetry={() => {
          advancesQuery.refetch();
          studentsQuery.refetch();
        }}
      />
    );
  }

  const rows = advancesQuery.data?.data || [];
  const totalTaken = rows.reduce((sum, row) => sum + Number(row.takenAmount || 0), 0);
  const totalClosed = rows.reduce((sum, row) => sum + Number(row.closedAmount || 0), 0);

  const onSubmit = (values) => {
    const billDates = values.billDate ? [{ billDate: values.billDate }] : [];

    const payload = {
      month,
      prefectStudentId: values.prefectStudentId,
      takenAmount: Number(values.takenAmount || 0),
      closedAmount: Number(values.closedAmount || 0),
      chequeDetails: values.chequeDetails.trim(),
      billDates,
    };

    if (editingAdvance?._id) {
      updateMutation.mutate({ advanceId: editingAdvance._id, payload });
      return;
    }

    createMutation.mutate(payload);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Advances"
        title="Prefect advance tracker"
        // description="Track money borrowed from the university against prefects, including bill dates, closed amount, and cheque details."
        action={
          <div className="w-full max-w-sm">
            <MonthPicker
              value={month}
              onChange={(nextMonth) => {
                setMonth(nextMonth);
                setEditingAdvance(null);
                form.reset(defaultValues);
              }}
            />
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Advance Entries" value={rows.length} type="number" />
        <StatCard label="Taken Amount" value={totalTaken} tone="coral" />
        <StatCard label="Open Balance" value={Math.max(totalTaken - totalClosed, 0)} tone="mint" />
      </div>

      <form className="panel space-y-5 p-6" onSubmit={form.handleSubmit(onSubmit)}>
        <div>
          <h3 className="section-title">{editingAdvance ? "Edit advance" : "Add advance"}</h3>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="xl:col-span-2">
            <label className="field-label">Prefect Student</label>
            <Select {...form.register("prefectStudentId", { required: true })}>
              <option value="">Select prefect</option>
              {studentOptions.map((student) => (
                <option key={student._id} value={student._id}>
                  {student.studentId} - {student.userId?.name || "Student"}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="field-label">Taken Amount</label>
            <Input type="number" min="0" step="0.01" {...form.register("takenAmount", { required: true })} />
          </div>
          <div>
            <label className="field-label">Closed Amount</label>
            <Input type="number" min="0" step="0.01" {...form.register("closedAmount")} />
          </div>
          <div>
            <label className="field-label">Cheque Details</label>
            <Input placeholder="Optional cheque reference" {...form.register("chequeDetails")} />
          </div>
          <div className="md:col-span-1 xl:col-span-1">
            <label className="field-label">Bill Date</label>
            <Input type="date" {...form.register("billDate")} />
          </div>
          <div className="flex items-end gap-3">
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
              {editingAdvance ? "Update advance" : "Save advance"}
            </Button>
            {editingAdvance ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditingAdvance(null);
                  form.reset(defaultValues);
                }}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        </div>
      </form>

      <DataTable
        rows={rows}
        columns={[
          {
            key: "prefect",
            label: "Prefect",
            render: (row) =>
              `${row.prefectStudentId?.studentId || "-"} - ${row.prefectStudentId?.userId?.name || "Student"}`,
          },
          { key: "takenAmount", label: "Taken", render: (row) => formatCurrency(row.takenAmount || 0) },
          { key: "closedAmount", label: "Closed", render: (row) => formatCurrency(row.closedAmount || 0) },
          {
            key: "balance",
            label: "Balance",
            render: (row) => formatCurrency(Math.max(Number(row.takenAmount || 0) - Number(row.closedAmount || 0), 0)),
          },
          {
            key: "billDate",
            label: "Bill Date",
            render: (row) =>
              row.billDates?.[0]?.billDate ? formatDate(row.billDates[0].billDate) : "-",
          },
          { key: "chequeDetails", label: "Cheque Details", render: (row) => row.chequeDetails || "-" },
          {
            key: "actions",
            label: "Actions",
            render: (row) => (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditingAdvance(row)}>
                  Edit
                </Button>
                <Button variant="danger" size="sm" onClick={() => deleteMutation.mutate(row._id)}>
                  Delete
                </Button>
              </div>
            ),
          },
        ]}
        emptyMessage="No advances recorded for this month yet."
      />
    </div>
  );
}
