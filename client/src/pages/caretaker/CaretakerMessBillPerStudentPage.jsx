import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { billApi } from "../../api/billApi";
import { DataTable } from "../../components/common/DataTable";
import { ErrorState } from "../../components/common/ErrorState";
import { LoadingState } from "../../components/common/LoadingState";
import { MonthPicker } from "../../components/common/MonthPicker";
import { PageHeader } from "../../components/common/PageHeader";
import { Pagination } from "../../components/common/Pagination";
import { Button } from "../../components/ui/Button";
import {
  getDynamicChargeItems,
  getDynamicChargeTotal,
  getEstablishmentChargeTotal,
  getFoodChargeTotal,
  getGrandTotal,
} from "../../features/bills/messBillBreakdown";
import { CURRENT_MONTH } from "../../utils/constants";
import { formatCurrency } from "../../utils/formatters";

const getDaysInMonth = (monthValue) => {
  const [monthName, yearText] = String(monthValue || "").split("-");
  const monthMap = {
    Jan: 0,
    Feb: 1,
    Mar: 2,
    Apr: 3,
    May: 4,
    Jun: 5,
    Jul: 6,
    Aug: 7,
    Sep: 8,
    Oct: 9,
    Nov: 10,
    Dec: 11,
  };
  const monthIndex = monthMap[monthName];
  const year = Number.parseInt(yearText, 10);

  if (monthIndex === undefined || Number.isNaN(year)) {
    return 0;
  }

  return new Date(year, monthIndex + 1, 0).getDate();
};

export function CaretakerMessBillPerStudentPage() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(CURRENT_MONTH);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [month]);

  const query = useQuery({
    queryKey: ["caretaker-mess-bill-per-student", month, page],
    queryFn: () => billApi.getBillBreakdownByMonth(month, { page, limit: 25 }),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const rows = useMemo(() => {
    const daysInMonth = getDaysInMonth(month);
    return (query.data?.data || []).map((row) => ({
      ...row,
      daysInMonth,
      foodTotal: getFoodChargeTotal(row),
      dynamicChargeItems: getDynamicChargeItems(row),
      dynamicChargeTotal: getDynamicChargeTotal(row),
      establishmentTotal: getEstablishmentChargeTotal(row),
      grandTotal: getGrandTotal(row),
    }));
  }, [month, query.data?.data]);

  const dynamicChargeColumns = useMemo(() => {
    const titles = [];

    rows.forEach((row) => {
      row.dynamicChargeItems.forEach((item) => {
        if (item?.title && !titles.includes(item.title) && titles.length < 3) {
          titles.push(item.title);
        }
      });
    });

    return titles;
  }, [rows]);

  const pagination = query.data?.pagination;
  const totals = query.data?.totals;
  const visibleStart = rows.length > 0 && pagination ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const visibleEnd =
    rows.length > 0 && pagination
      ? Math.min((pagination.page - 1) * pagination.limit + rows.length, pagination.total)
      : 0;

  if (query.isLoading) {
    return <LoadingState label="Loading student-wise mess bill breakdown..." />;
  }

  if (query.isError) {
    return (
      <ErrorState
        description="Unable to load the mess bill per student workspace."
        onRetry={query.refetch}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Mess Bill Per Student"
        title="Mess Bill Per Student"
        // description="Review exactly how each saved student bill was built from mess, food, establishment, and fine components."
        action={
          <div className="flex w-full max-w-xl items-end gap-3">
            <div className="flex-1">
              <MonthPicker value={month} onChange={setMonth} />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate("/caretaker/reports", { state: { month } })}
            >
              Generate report
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[28px] border border-slate-200/70 bg-white/90 p-6 shadow-[0_18px_45px_rgba(148,163,184,0.12)]">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-400">
            Total Billed
          </p>
          <p className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">
            {formatCurrency(totals?.billed || 0)}
          </p>
          {/* <p className="mt-2 text-sm text-slate-500">
            Sum of all final student bills for {month}.
          </p> */}
        </div>
        <div className="rounded-[28px] border border-slate-200/70 bg-white/90 p-6 shadow-[0_18px_45px_rgba(148,163,184,0.12)]">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-400">
            Total Fine
          </p>
          <p className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">
            {formatCurrency(totals?.fine || 0)}
          </p>
          {/* <p className="mt-2 text-sm text-slate-500">
            Combined fine applied across all saved student bills.
          </p> */}
        </div>
        <div className="rounded-[28px] border border-slate-200/70 bg-white/90 p-6 shadow-[0_18px_45px_rgba(148,163,184,0.12)]">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-400">
            Student Bills
          </p>
          <p className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">
            {totals?.count || 0}
          </p>
          {/* <p className="mt-2 text-sm text-slate-500">
            Generated bill rows included in this monthly breakdown.
          </p> */}
        </div>
      </div>

      {pagination?.total ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            Showing <span className="font-semibold text-slate-800">{visibleStart}</span>
            {" - "}
            <span className="font-semibold text-slate-800">{visibleEnd}</span>
            {" of "}
            <span className="font-semibold text-slate-800">{pagination.total}</span> student bills
          </p>
          <Pagination page={pagination?.page} totalPages={pagination?.totalPages} onPageChange={setPage} />
        </div>
      ) : null}

      <DataTable
        rows={rows}
        columns={[
          { key: "studentId", label: "Student", render: (row) => row.studentId?.studentId || "-" },
          { key: "name", label: "Name", render: (row) => row.userId?.name || "-" },
          { key: "daysInMonth", label: "Days" },
          { key: "base_mess", label: "Mess Bill", render: (row) => formatCurrency(row.base_mess) },
          { key: "egg_total", label: "Egg", render: (row) => formatCurrency(row.egg_total) },
          { key: "bakery_charge", label: "Bakery / Banana", render: (row) => formatCurrency(row.bakery_charge) },
          { key: "paneer_total", label: "Paneer", render: (row) => formatCurrency(row.paneer_total) },
          { key: "milk_total", label: "Milk", render: (row) => formatCurrency(row.milk_total) },
          { key: "chicken_total", label: "Chicken", render: (row) => formatCurrency(row.chicken_total) },
          { key: "foodTotal", label: "Food Total", render: (row) => formatCurrency(row.foodTotal) },
          ...dynamicChargeColumns.map((title, index) => ({
            key: `dynamic_${index}`,
            label: title,
            render: (row) =>
              formatCurrency(
                row.dynamicChargeItems.find((item) => item.title === title)?.amount || 0
              ),
          })),
          { key: "dynamicChargeTotal", label: "Static Total", render: (row) => formatCurrency(row.dynamicChargeTotal) },
          { key: "labour_charge", label: "Labour", render: (row) => formatCurrency(row.labour_charge) },
          { key: "night_watch_charge", label: "Night Watch", render: (row) => formatCurrency(row.night_watch_charge) },
          { key: "keb_charge", label: "Electricity", render: (row) => formatCurrency(row.keb_charge) },
          {
            key: "establishmentTotal",
            label: "Est. Total",
            render: (row) => formatCurrency(row.establishmentTotal),
          },
          { key: "fine", label: "Fine", render: (row) => formatCurrency(row.fine || 0) },
          { key: "grandTotal", label: "Total", render: (row) => formatCurrency(row.grandTotal) },
        ]}
        emptyMessage={`No generated student bills are available for ${month}.`}
      />
    </div>
  );
}
