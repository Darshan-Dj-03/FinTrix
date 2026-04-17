import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";

const DEFAULT_VALUES = {
  studentId: "",
  egg_count: 0,
  chicken_count: 0,
  paneer_count: 0,
  milk_amount: 0,
};

export function ConsumptionForm({
  students,
  month,
  onSubmit,
  loading,
  editingRecord,
  onCancel,
  disabled = false,
}) {
  const { register, handleSubmit, reset } = useForm({
    defaultValues: DEFAULT_VALUES,
  });

  useEffect(() => {
    if (!editingRecord) {
      reset(DEFAULT_VALUES);
      return;
    }

    reset({
      studentId: editingRecord.studentId?._id || "",
      egg_count: editingRecord.egg_count ?? 0,
      chicken_count: editingRecord.chicken_count ?? 0,
      paneer_count: editingRecord.paneer_count ?? 0,
      milk_amount: editingRecord.milk_amount ?? 0,
    });
  }, [editingRecord, reset]);

  const submit = (values) => {
    onSubmit({
      month,
      studentId: values.studentId,
      egg_count: Number(values.egg_count || 0),
      chicken_count: Number(values.chicken_count || 0),
      paneer_count: Number(values.paneer_count || 0),
      milk_amount: Number(values.milk_amount || 0),
    });
  };

  return (
    <form className="panel space-y-5 p-6" onSubmit={handleSubmit(submit)}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="section-title">{editingRecord ? "Edit monthly consumption" : "Add monthly consumption"}</h3>
          <p className="mt-2 text-sm text-slate-500">
            Enter the student's monthly unit consumption and milk amount so variable item totals are billed only to the students who actually consumed them.
          </p>
        </div>
        {editingRecord && onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel edit
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="xl:col-span-1">
          <label className="field-label">Student</label>
          <Select {...register("studentId")} disabled={disabled || Boolean(editingRecord)}>
            <option value="">Select student</option>
            {students.map((student) => (
              <option key={student._id} value={student._id}>
                {student.studentId} - {student.userId?.name || "Student"}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label className="field-label">Egg Count</label>
          <Input type="number" min="0" step="1" {...register("egg_count")} disabled={disabled} />
        </div>
        <div>
          <label className="field-label">Chicken Count</label>
          <Input type="number" min="0" step="1" {...register("chicken_count")} disabled={disabled} />
        </div>
        <div>
          <label className="field-label">Paneer Count</label>
          <Input type="number" min="0" step="1" {...register("paneer_count")} disabled={disabled} />
        </div>
        <div>
          <label className="field-label">Milk Amount</label>
          <Input type="number" min="0" step="0.01" {...register("milk_amount")} disabled={disabled} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" loading={loading} disabled={disabled}>
          {editingRecord ? "Save consumption" : "Add consumption"}
        </Button>
        <p className="text-sm text-slate-500">Month locked to {month}. Existing student-month records are updated instead of duplicated.</p>
      </div>
    </form>
  );
}
