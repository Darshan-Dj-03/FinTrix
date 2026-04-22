import { formatCompactNumber, formatCurrency } from "../../utils/formatters";

export function StatCard({ label, value, tone = "brand", type = "currency", icon: Icon }) {
  const formatted =
    type === "currency" ? formatCurrency(value) : type === "compact" ? formatCompactNumber(value) : value;

  return (
    <div className="panel p-5 sm:p-6">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 sm:text-sm sm:tracking-[0.18em]">{label}</p>
          <p className="mt-3 break-words text-2xl font-display font-bold leading-tight text-ink sm:mt-4 sm:text-3xl">{formatted}</p>
        </div>
        {Icon ? (
          <div
            className={`ml-3 shrink-0 rounded-2xl p-2.5 sm:p-3 ${
              tone === "coral"
                ? "bg-orange-100 text-orange-600"
                : tone === "mint"
                  ? "bg-emerald-100 text-emerald-600"
                  : "bg-brand-100 text-brand-700"
            }`}
          >
            <Icon size={18} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
