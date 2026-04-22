import { forwardRef } from "react";
import clsx from "clsx";

export const Input = forwardRef(function Input({ className, ...props }, ref) {
  const isReadOnly = Boolean(props.readOnly || props.disabled);

  return (
    <input
      ref={ref}
      data-field-state={isReadOnly ? "readonly" : "editable"}
      className={clsx(
        "h-11 w-full rounded-2xl border px-4 text-sm outline-none transition",
        isReadOnly
          ? "cursor-default border-slate-200 bg-slate-100/90 text-slate-600 shadow-inner shadow-slate-200/50"
          : "border-slate-200 bg-white text-slate-900 focus:border-brand-400 focus:ring-4 focus:ring-brand-100",
        className
      )}
      {...props}
    />
  );
});
