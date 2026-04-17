import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, Receipt, ScrollText } from "lucide-react";

import { billApi } from "../../api/billApi";
import { paymentApi } from "../../api/paymentApi";
import { reportApi } from "../../api/reportApi";
import { ErrorState } from "../../components/common/ErrorState";
import { LoadingState } from "../../components/common/LoadingState";
import { MonthPicker } from "../../components/common/MonthPicker";
import { PageHeader } from "../../components/common/PageHeader";
import { StatCard } from "../../components/common/StatCard";
import { CURRENT_MONTH } from "../../utils/constants";

export function CaretakerOverviewPage() {
  const [month, setMonth] = useState(CURRENT_MONTH);
  const billsQuery = useQuery({
    queryKey: ["caretaker-overview-bills", month],
    queryFn: () => billApi.getBillsByMonth(month, { page: 1, limit: 500 }),
  });
  const paymentsQuery = useQuery({
    queryKey: ["caretaker-overview-payments", month],
    queryFn: () => paymentApi.list({ month, page: 1, limit: 500 }),
  });
  const reportQuery = useQuery({ queryKey: ["caretaker-overview-report", month], queryFn: () => reportApi.getStatus(month) });

  const stats = useMemo(() => {
    const bills = billsQuery.data?.data || [];
    const payments = paymentsQuery.data?.data || [];
    return {
      totalBilled: bills.reduce((sum, item) => sum + Number(item.total_amount || 0), 0),
      totalCollected: payments.reduce((sum, item) => sum + Number(item.amount || 0), 0),
      reportStatus: reportQuery.data?.data?.status || "draft",
      totalBills: billsQuery.data?.pagination?.total || bills.length,
    };
  }, [billsQuery.data?.data, billsQuery.data?.pagination?.total, paymentsQuery.data?.data, reportQuery.data?.data?.status]);

  if (billsQuery.isLoading || paymentsQuery.isLoading || reportQuery.isLoading) {
    return <LoadingState label="Loading caretaker overview..." />;
  }

  if (billsQuery.isError || paymentsQuery.isError || reportQuery.isError) {
    return (
      <ErrorState
        description="Unable to load caretaker metrics."
        onRetry={() => {
          billsQuery.refetch();
          paymentsQuery.refetch();
          reportQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Caretaker command"
        title="Monthly Billing Overview"
      //  description="Track generated bills, collections, and report status for the current billing cycle."
        action={
          <div className="w-full max-w-xs">
            <MonthPicker value={month} onChange={setMonth} />
          </div>
        }
      />

      <div className="grid gap-5 md:grid-cols-3">
        <StatCard label="Total billed" value={stats.totalBilled} icon={Receipt} />
        <StatCard label="Total collected" value={stats.totalCollected} tone="mint" icon={CreditCard} />
        <StatCard label="Bills generated" value={stats.totalBills} type="compact" tone="coral" icon={ScrollText} />
      </div>
    </div>
  );
}
