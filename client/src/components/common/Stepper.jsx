import clsx from "clsx";

export function Stepper({ steps = [], current }) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      {steps.map((step, index) => {
        const active = step.value === current;
        const completed = steps.findIndex((item) => item.value === current) > index;

        return (
          <div key={step.value} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div
              className={clsx(
                "flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold",
                active
                  ? "bg-brand-600 text-white"
                  : completed
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-500"
              )}
            >
              {index + 1}
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{step.label}</p>
              <p className="mt-1 text-sm font-semibold text-slate-700">
                {active ? "Current step" : completed ? "Completed" : "Waiting"}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
