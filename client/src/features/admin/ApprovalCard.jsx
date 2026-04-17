import { useState } from "react";

import { Button } from "../../components/ui/Button";
import { Textarea } from "../../components/ui/Textarea";
import { StatusBadge } from "../../components/common/StatusBadge";

export function ApprovalCard({ title, subtitle, status, onApprove, actionLabel = "Approve" }) {
  const [notes, setNotes] = useState("");

  return (
    <div className="panel p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-ink">{title}</h3>
          <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
        </div>
        <StatusBadge value={status} />
      </div>
      <div className="mt-5">
        <label className="field-label">Approval notes</label>
        <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional notes..." />
      </div>
      <div className="mt-5">
        <Button onClick={() => onApprove(notes)}>{actionLabel}</Button>
      </div>
    </div>
  );
}
