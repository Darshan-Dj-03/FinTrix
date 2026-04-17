import { formatCompactNumber, formatCurrency } from "../../utils/formatters";

export function StatCard({ label, value, tone = "brand", type = "currency", icon: Icon }) {
  const formatted =
    type === "currency" ? formatCurrency(value) : type === "compact" ? formatCompactNumber(value) : value;

  return (
    <div className="panel p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
          <p className="mt-4 text-3xl font-display font-bold text-ink">{formatted}</p>
        </div>
        {Icon ? (
          <div
            className={`rounded-2xl p-3 ${
              tone === "coral"
                ? "bg-orange-100 text-orange-600"
                : tone === "mint"
                  ? "bg-emerald-100 text-emerald-600"
                  : "bg-brand-100 text-brand-700"
            }`}
          >
            <Icon size={20} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
