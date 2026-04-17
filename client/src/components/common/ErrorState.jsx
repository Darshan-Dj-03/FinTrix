import { AlertTriangle } from "lucide-react";

import { Button } from "../ui/Button";

export function ErrorState({ title = "Something went wrong", description, onRetry }) {
  return (
    <div className="panel flex min-h-52 flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="rounded-3xl bg-rose-100 p-4 text-rose-600">
        <AlertTriangle size={28} />
      </div>
      <div>
        <h3 className="text-lg font-bold text-ink">{title}</h3>
        <p className="mt-2 max-w-md text-sm text-slate-500">{description}</p>
      </div>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
