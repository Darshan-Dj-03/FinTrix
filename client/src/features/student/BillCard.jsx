import { Download } from "lucide-react";

import { formatCurrency, formatDate } from "../../utils/formatters";
import { StatusBadge } from "../../components/common/StatusBadge";
import { Button } from "../../components/ui/Button";
import { MessBillBreakdownCard } from "../bills/MessBillBreakdownCard";

export function BillCard({ bill, onDownload }) {
  return (
    <div className="panel p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.26em] text-brand-600">{bill.month}</p>
          <h3 className="mt-2 text-2xl font-display font-bold text-ink">{formatCurrency(bill.total_amount + (bill.fine || 0))}</h3>
          <p className="mt-2 text-sm text-slate-500">
            Announced on {formatDate(bill.announcement_date)} and due on {formatDate(bill.due_date)}
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Late fine is calculated daily: Rs.2 per day for the first 30 overdue days, then Rs.5 per day after that.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge value={bill.payment_status} />
          <Button variant="ghost" onClick={onDownload}>
            <Download size={16} className="mr-2" />
            PDF
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="panel-soft p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Base Mess</p>
          <p className="mt-2 text-lg font-semibold text-slate-800">{formatCurrency(bill.base_mess)}</p>
        </div>
        <div className="panel-soft p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Utilities + Labour</p>
          <p className="mt-2 text-lg font-semibold text-slate-800">
            {formatCurrency((bill.keb_charge || 0) + (bill.labour_charge || 0))}
          </p>
        </div>
        <div className="panel-soft p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Fine</p>
          <p className="mt-2 text-lg font-semibold text-slate-800">{formatCurrency(bill.fine || 0)}</p>
        </div>
        <div className="panel-soft p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Paid So Far</p>
          <p className="mt-2 text-lg font-semibold text-slate-800">{formatCurrency(bill.amount_paid || 0)}</p>
        </div>
      </div>

      <div className="mt-6">
        <MessBillBreakdownCard bill={bill} title="Why this bill amount was charged" compact />
      </div>
    </div>
  );
}
