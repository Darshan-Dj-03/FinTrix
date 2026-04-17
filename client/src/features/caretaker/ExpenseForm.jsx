import { Button } from "../../components/ui/Button";
import { formatCurrency } from "../../utils/formatters";

const DISPLAY_ROWS = [
  { key: "mess_bill_total", label: "Mess Bill" },
  { key: "egg_total", label: "Egg" },
  { key: "banana_bakery_total", label: "Banana / Bakery" },
  { key: "paneer_total", label: "Paneer" },
  { key: "milk_total", label: "Milk" },
  { key: "chicken_total", label: "Chicken" },
  { key: "dynamic_charge_total", label: "Static Charges" },
  { key: "labour_combined_total", label: "Labour" },
  { key: "keb_total", label: "Electric (KEB)" },
];

const PRICE_ROWS = [
  { key: "egg_price", label: "Egg Price Per Unit" },
  { key: "chicken_price", label: "Chicken Price Per Unit" },
  { key: "paneer_price", label: "Paneer Price Per Unit" },
];

export function ExpenseForm({ onSubmit, loading, source, existingExpense, month, onCancel }) {
  const values = source?.values;
  const dynamicCharges = values?.dynamic_charge_breakdown || [];

  return (
    <div className="panel space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="section-title">{existingExpense ? "Update monthly billing expense" : "Create monthly billing expense"}</h3>
          {/* <p className="mt-2 max-w-3xl text-sm text-slate-500">
            This snapshot is built from the saved hostel expense sheet, monthly expenditure report, static charges,
            and student consumption. The values below are prefilled so billing uses a clean monthly source of truth.
          </p> */}
        </div>
        {existingExpense && onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel edit
          </Button>
        ) : null}
      </div>

      {!values ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          No expense source is available yet for {month}. Save the hostel expense sheet and generate the total monthly expenditure report first.
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-3xl border border-slate-200">
            <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
              <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Billing Snapshot</h4>
              <p className="mt-2 text-sm text-slate-500">
                These are the only monthly values carried into the billing expense record.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Field</th>
                    <th className="px-4 py-3 font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {DISPLAY_ROWS.flatMap((row) => {
                    if (row.key !== "dynamic_charge_total") {
                      return (
                        <tr key={row.key} className="border-t border-slate-100">
                          <td className="px-4 py-3 font-medium text-ink">{row.label}</td>
                          <td className="px-4 py-3 text-slate-600">{formatCurrency(values[row.key] || 0)}</td>
                        </tr>
                      );
                    }

                    return [
                      ...dynamicCharges.map((charge) => (
                        <tr key={charge.id} className="border-t border-slate-100">
                          <td className="px-4 py-3 font-medium text-ink">Static Charge: {charge.title}</td>
                          <td className="px-4 py-3 text-slate-600">{formatCurrency(charge.amount || 0)}</td>
                        </tr>
                      )),
                      <tr key={row.key} className="border-t border-slate-100">
                        <td className="px-4 py-3 font-medium text-ink">Static Charges Total</td>
                        <td className="px-4 py-3 text-slate-600">{formatCurrency(values[row.key] || 0)}</td>
                      </tr>,
                    ];
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {PRICE_ROWS.map((row) => (
              <div key={row.key} className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">{row.label}</p>
                <p className="mt-3 text-2xl font-display font-bold text-ink">{formatCurrency(values[row.key] || 0)}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Egg Count Total</p>
              <p className="mt-3 text-2xl font-display font-bold text-ink">{values.egg_count_total || 0}</p>
            </div>
            <div className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Chicken Count Total</p>
              <p className="mt-3 text-2xl font-display font-bold text-ink">{values.chicken_count_total || 0}</p>
            </div>
            <div className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Paneer Count Total</p>
              <p className="mt-3 text-2xl font-display font-bold text-ink">{values.paneer_count_total || 0}</p>
            </div>
            <div className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Milk Amount Total</p>
              <p className="mt-3 text-2xl font-display font-bold text-ink">{formatCurrency(values.milk_amount_total || 0)}</p>
            </div>
          </div>

          {!values.monthly_report_available ? (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
              Mess Bill is currently ?0.00 because the total monthly expenditure report has not been generated for {month} yet.
            </div>
          ) : null}
        </>
      )}

      <div className="flex items-center gap-3">
        <Button type="button" onClick={onSubmit} loading={loading} disabled={!values}>
          {existingExpense ? "Update expense snapshot" : "Create expense snapshot"}
        </Button>
        {/* <p className="text-sm text-slate-500">
          Month locked to {month}. Milk stays student-specific and is billed from consumption instead of being equally split.
        </p> */}
      </div>
    </div>
  );
}
