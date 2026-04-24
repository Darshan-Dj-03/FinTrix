import { formatCurrency } from "../../utils/formatters";
import {
  getDynamicChargeItems,
  getDynamicChargeTotal,
  getEstablishmentChargeTotal,
  getFoodChargeTotal,
  getGrandTotal,
} from "./messBillBreakdown";

function LineItem({ label, value, emphasis = false, formatter = formatCurrency }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-3 last:border-b-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={emphasis ? "text-sm font-semibold text-slate-900" : "text-sm font-medium text-slate-700"}>
        {formatter(value)}
      </span>
    </div>
  );
}

export function MessBillBreakdownCard({ bill, title = "Bill breakdown", compact = false }) {
  const foodTotal = getFoodChargeTotal(bill);
  const dynamicItems = getDynamicChargeItems(bill);
  const dynamicTotal = getDynamicChargeTotal(bill);
  const establishmentTotal = getEstablishmentChargeTotal(bill);
  const grandTotal = getGrandTotal(bill);

  return (
    <div className="panel p-6">
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <div>
            <h4 className="text-lg font-semibold text-ink">{title}</h4>
            <p className="mt-1 text-sm text-slate-500">
              This is the saved charge split used to build the final bill for the selected month.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Additional Food Charges</p>
              <div className="mt-4">
                <LineItem label="Egg" value={bill.egg_total} />
                <LineItem label="Bakery / Banana" value={bill.bakery_charge} />
                <LineItem label="Paneer" value={bill.paneer_total} />
                <LineItem label="Milk" value={bill.milk_total} />
                <LineItem label="Chicken" value={bill.chicken_total} />
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Establishment Charges</p>
              <div className="mt-4">
                {dynamicItems.length ? (
                  dynamicItems.map((item) => (
                    <LineItem key={item.title} label={item.title} value={item.amount} />
                  ))
                ) : (
                  <LineItem label="Static Charges" value={bill.additional_charge} />
                )}
                <LineItem label="Labour" value={bill.labour_charge} />
                <LineItem label="Night Watch" value={bill.night_watch_charge} />
                <LineItem label="Electricity (KEB)" value={bill.keb_charge} />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-600">Final Calculation</p>
          <div className="mt-5 space-y-1">
            <LineItem label="Absent Days" value={Number(bill.absent_days || 0)} formatter={(value) => String(value)} />
            <LineItem label="Absence Deduction" value={bill.absence_deduction || 0} />
            <LineItem label="Mess Bill" value={bill.base_mess} />
            <LineItem label="Additional Food Charges" value={foodTotal} />
            <LineItem label="Static Charges" value={dynamicTotal} />
            <LineItem label="Utilities + Labour" value={establishmentTotal} />
            <LineItem label="Fine" value={bill.fine || 0} />
            <LineItem label="Grand Total" value={grandTotal} emphasis />
          </div>
        </div>
      </div>
    </div>
  );
}
