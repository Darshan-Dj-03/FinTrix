import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, FileBarChart2, ShieldCheck } from "lucide-react";

import { hostelApi } from "../../api/hostelApi";
import { ledgerApi } from "../../api/ledgerApi";
import { monthlyExpenseReportApi } from "../../api/monthlyExpenseReportApi";
import { reportApi } from "../../api/reportApi";
import { studentApi } from "../../api/studentApi";
import { ErrorState } from "../../components/common/ErrorState";
import { LoadingState } from "../../components/common/LoadingState";
import { MonthPicker } from "../../components/common/MonthPicker";
import { PageHeader } from "../../components/common/PageHeader";
import { StatCard } from "../../components/common/StatCard";
import { Select } from "../../components/ui/Select";
import { useAuthStore } from "../../store/authStore";
import { CURRENT_MONTH } from "../../utils/constants";

export function AdminOverviewPage() {
  const user = useAuthStore((state) => state.user);
  const [month, setMonth] = useState(CURRENT_MONTH);
  const [selectedHostelId, setSelectedHostelId] = useState(user?.role === "caretaker" ? user.hostelId : "");

  const hostelsQuery = useQuery({
    queryKey: ["admin-overview-hostels"],
    queryFn: hostelApi.list,
    enabled: user?.role !== "caretaker",
  });

  const hostelOptions = useMemo(
    () =>
      (hostelsQuery.data?.data || []).map((hostel) => ({
        value: hostel._id,
        label: hostel.name,
      })),
    [hostelsQuery.data?.data]
  );

  useEffect(() => {
    if (user?.role === "caretaker") {
      setSelectedHostelId(user.hostelId || "");
      return;
    }

    if (!selectedHostelId && hostelOptions.length > 0) {
      setSelectedHostelId(hostelOptions[0].value);
    }
  }, [hostelOptions, selectedHostelId, user?.hostelId, user?.role]);

  const scopedParams = selectedHostelId ? { hostelId: selectedHostelId } : {};
  const reportQuery = useQuery({
    queryKey: ["admin-overview-report", month, selectedHostelId],
    queryFn: () => reportApi.getFull(month, scopedParams),
    enabled: user?.role === "caretaker" || Boolean(selectedHostelId),
  });
  const ledgerQuery = useQuery({
    queryKey: ["admin-overview-ledger", month, selectedHostelId],
    queryFn: () => ledgerApi.list(month, scopedParams),
    enabled: user?.role === "caretaker" || Boolean(selectedHostelId),
  });
  const monthlyExpenseReportQuery = useQuery({
    queryKey: ["admin-overview-monthly-expense-report", month, selectedHostelId],
    queryFn: async () => {
      try {
        return await monthlyExpenseReportApi.getByMonth(month, scopedParams);
      } catch (error) {
        if (error?.response?.status === 404) {
          return { data: null };
        }
        throw error;
      }
    },
    enabled: user?.role === "caretaker" || Boolean(selectedHostelId),
    retry: false,
  });
  const studentsQuery = useQuery({
    queryKey: ["admin-overview-students"],
    queryFn: studentApi.list,
    enabled: true,
  });

  if (
    hostelsQuery.isLoading ||
    reportQuery.isLoading ||
    ledgerQuery.isLoading ||
    studentsQuery.isLoading
  ) {
    return <LoadingState label="Loading admin overview..." />;
  }

  if (
    hostelsQuery.isError ||
    reportQuery.isError ||
    ledgerQuery.isError ||
    studentsQuery.isError
  ) {
    return (
      <ErrorState
        description="Unable to load admin metrics."
        onRetry={() => {
          hostelsQuery.refetch();
          reportQuery.refetch();
          ledgerQuery.refetch();
          monthlyExpenseReportQuery.refetch();
          studentsQuery.refetch();
        }}
      />
    );
  }

  const report = reportQuery.data?.data || {};
  const ledger = ledgerQuery.data?.data?.[0] || {};
  const monthlyExpenseReport = monthlyExpenseReportQuery.data?.data || null;
  const scopedStudents = (studentsQuery.data?.students || []).filter((student) => {
    if (user?.role === "caretaker") {
      return student.userId?.hostelId?._id?.toString() === user.hostelId?.toString();
    }
    if (!selectedHostelId) {
      return false;
    }
    return student.userId?.hostelId?._id?.toString() === selectedHostelId;
  });
  const closingBalance =
    monthlyExpenseReport?.total_closing_balance ??
    ledger.closingBalance ??
    0;
  const closingBalanceHint = monthlyExpenseReport
    ? "MSC Total + Closing Balance Last Month from the approved monthly expenditure report."
    : "Ledger closing balance for the selected month. Generate the monthly expenditure report to see the report-side closing balance here.";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin command"
        title="Institution-wide oversight"
        description="Monitor report totals, report-side closing balance, and overall student volume from a single dashboard."
        action={
          <div className="flex w-full max-w-2xl flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1">
              <MonthPicker value={month} onChange={setMonth} />
            </div>
            {user?.role !== "caretaker" ? (
              <div className="w-full md:w-72">
                <label className="field-label">Hostel</label>
                <Select value={selectedHostelId} onChange={(event) => setSelectedHostelId(event.target.value)}>
                  <option value="">Select hostel</option>
                  {hostelOptions.map((hostel) => (
                    <option key={hostel.value} value={hostel.value}>
                      {hostel.label}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-5 md:grid-cols-3">
        <StatCard label="Total billed" value={report.totalBilled} icon={BarChart3} />
        <StatCard
          label="Closing balance"
          value={closingBalance}
          description={closingBalanceHint}
          tone="mint"
          icon={FileBarChart2}
        />
        <StatCard
          label="Students tracked"
          value={scopedStudents.length}
          type="compact"
          tone="coral"
          icon={ShieldCheck}
        />
      </div>
    </div>
  );
}
