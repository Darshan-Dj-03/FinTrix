import clsx from "clsx";

const badgeMap = {
  paid: "bg-emerald-100 text-emerald-700",
  partial: "bg-amber-100 text-amber-700",
  pending: "bg-slate-200 text-slate-700",
  draft: "bg-slate-200 text-slate-700",
  submitted: "bg-sky-100 text-sky-700",
  verified: "bg-cyan-100 text-cyan-700",
  warden_approved: "bg-indigo-100 text-indigo-700",
  dean_approved: "bg-emerald-100 text-emerald-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
  active: "bg-emerald-100 text-emerald-700",
  inactive: "bg-slate-200 text-slate-700",
  available: "bg-violet-100 text-violet-700",
  enrolled: "bg-fuchsia-100 text-fuchsia-700",
  not_applicable: "bg-amber-100 text-amber-700",
  ebl: "bg-blue-100 text-blue-700",
};

export function StatusBadge({ value }) {
  return (
    <span
      className={clsx(
        "inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize tracking-wide",
        badgeMap[value] || "bg-slate-200 text-slate-700"
      )}
    >
      {String(value || "unknown").replaceAll("_", " ")}
    </span>
  );
}
