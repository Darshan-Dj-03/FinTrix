import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { analyticsApi } from "../../api/analyticsApi";
import { hostelApi } from "../../api/hostelApi";
import { useAuthStore } from "../../store/authStore";
import { ErrorState } from "../../components/common/ErrorState";
import { LoadingState } from "../../components/common/LoadingState";
import { MonthPicker } from "../../components/common/MonthPicker";
import { PageHeader } from "../../components/common/PageHeader";
import { Select } from "../../components/ui/Select";
import { CURRENT_MONTH } from "../../utils/constants";
import { formatCurrency } from "../../utils/formatters";

export function AdminAnalyticsPage() {
  const user = useAuthStore((state) => state.user);
  const [month, setMonth] = useState(CURRENT_MONTH);
  const [selectedHostelId, setSelectedHostelId] = useState(user?.role === "caretaker" ? user.hostelId : "");
  const hostelsQuery = useQuery({
    queryKey: ["analytics-hostels-list"],
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
  const financeQuery = useQuery({
    queryKey: ["admin-analytics-finance", month, selectedHostelId],
    queryFn: () => analyticsApi.getFinance(month, scopedParams),
    enabled: user?.role === "caretaker" || Boolean(selectedHostelId),
  });
  const hostelQuery = useQuery({
    queryKey: ["admin-analytics-hostels", month],
    queryFn: () => analyticsApi.getHostels(month),
    enabled: user?.role === "admin",
  });
  const summaryQuery = useQuery({
    queryKey: ["admin-analytics-summary", month, selectedHostelId],
    queryFn: () => analyticsApi.getSummary(month, scopedParams),
    enabled: user?.role === "caretaker" || Boolean(selectedHostelId),
  });

  if (
    hostelsQuery.isLoading ||
    financeQuery.isLoading ||
    summaryQuery.isLoading ||
    (user?.role === "admin" && hostelQuery.isLoading)
  ) {
    return <LoadingState label="Loading analytics..." />;
  }
  if (
    hostelsQuery.isError ||
    financeQuery.isError ||
    summaryQuery.isError ||
    (user?.role === "admin" && hostelQuery.isError)
  ) {
    return (
      <ErrorState
        description="Unable to load analytics."
        onRetry={() => {
          hostelsQuery.refetch();
          financeQuery.refetch();
          summaryQuery.refetch();
          if (user?.role === "admin") {
            hostelQuery.refetch();
          }
        }}
      />
    );
  }

  const finance = financeQuery.data?.data || {};
  const hostelData = hostelQuery.data?.hostels || [];
  const summary = summaryQuery.data?.summary || {};
  const barData = [
    { name: "Expenses", amount: finance.totalExpenses || 0 },
    { name: "Collected", amount: finance.totalCollected || 0 },
    { name: "Outstanding", amount: finance.outstanding || 0 },
    { name: "Billed", amount: finance.totalBilled || 0 },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Analytics"
        title="Financial charts"
        description="Explore expenses, collections, and billed distribution for the selected month and hostel scope."
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

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="panel p-6">
          <h2 className="section-title">Monthly finance bars</h2>
          <p className="mt-2 text-sm text-slate-500">
            Total bills: {summary.totalBills || 0} and average bill: {formatCurrency(summary.averageBill || 0)}
          </p>
          <div className="mt-6 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Bar dataKey="amount" fill="#2796f3" radius={[12, 12, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel p-6">
          <h2 className="section-title">Hostel billed split</h2>
          <div className="mt-6 h-80">
            {user?.role === "admin" ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={hostelData} dataKey="totalExpense" nameKey="hostelName" outerRadius={110} fill="#ff7a59" label />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50/80 px-6 text-center text-sm text-slate-500">
                Hostel split is institution-wide, so it stays on the admin view. The charts on the left already reflect the hostel you selected above.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
