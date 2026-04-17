import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { MONTH_OPTIONS } from "../../utils/constants";

export function ChargeForm({ onSubmit, loading, defaultMonth, initialValues, onCancel }) {
  const { register, handleSubmit, reset } = useForm({
    defaultValues: {
      title: "",
      amount: "",
      month: defaultMonth || MONTH_OPTIONS[0],
    },
  });

  useEffect(() => {
    if (!initialValues) {
      reset({
        title: "",
        amount: "",
        month: defaultMonth || MONTH_OPTIONS[0],
      });
      return;
    }

    reset({
      title: initialValues.title || "",
      amount: initialValues.amount ?? "",
      month: initialValues.month || defaultMonth || MONTH_OPTIONS[0],
    });
  }, [defaultMonth, initialValues, reset]);

  const submit = (values) => {
    onSubmit({ ...values, amount: Number(values.amount) });
    if (!initialValues) {
      reset({ title: "", amount: "", month: values.month });
    }
  };

  return (
    <form className="panel p-6" onSubmit={handleSubmit(submit)}>
      <div className="flex items-center justify-between gap-4">
        <h3 className="section-title">{initialValues ? "Edit Static Charge" : "Add Static Charge"}</h3>
        {initialValues && onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel edit
          </Button>
        ) : null}
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div>
          <label className="field-label">Title</label>
          <Input {...register("title", { required: true })} placeholder="Static utility adjustment" />
        </div>
        <div>
          <label className="field-label">Amount</label>
          <Input type="number" {...register("amount", { required: true })} placeholder="2500" />
        </div>
        <div>
          <label className="field-label">Month</label>
          <Select {...register("month")}>
            {MONTH_OPTIONS.map((month) => (
              <option key={month} value={month}>
                {month}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="mt-5">
        <Button loading={loading} type="submit">
          {initialValues ? "Update charge" : "Save charge"}
        </Button>
      </div>
    </form>
  );
}
