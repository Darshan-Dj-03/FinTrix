import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "../ui/Button";

export function Pagination({ page = 1, totalPages = 0, onPageChange }) {
  if (!totalPages || totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-sm text-slate-500">
        Page <span className="font-semibold text-slate-800">{page}</span> of{" "}
        <span className="font-semibold text-slate-800">{totalPages}</span>
      </p>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          <ChevronLeft size={16} className="mr-1" />
          Previous
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          Next
          <ChevronRight size={16} className="ml-1" />
        </Button>
      </div>
    </div>
  );
}
