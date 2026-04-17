export function LoadingState({ label = "Loading dashboard..." }) {
  return (
    <div className="panel flex min-h-40 items-center justify-center p-8">
      <div className="flex items-center gap-3 text-sm font-medium text-slate-500">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
        {label}
      </div>
    </div>
  );
}
