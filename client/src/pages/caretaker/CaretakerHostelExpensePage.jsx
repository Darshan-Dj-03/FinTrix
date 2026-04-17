import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Calculator, Plus, ReceiptIndianRupee, SplitSquareVertical, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

import { hostelExpenseApi } from "../../api/hostelExpenseApi";
import { guestChargeApi } from "../../api/guestChargeApi";
import { monthlyExpenseReportApi } from "../../api/monthlyExpenseReportApi";
import { consumptionApi } from "../../api/consumptionApi";
import { studentApi } from "../../api/studentApi";
import { ErrorState } from "../../components/common/ErrorState";
import { LoadingState } from "../../components/common/LoadingState";
import { MonthPicker } from "../../components/common/MonthPicker";
import { PageHeader } from "../../components/common/PageHeader";
import { StatCard } from "../../components/common/StatCard";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import {
  blankHostelExpenseBill,
  calculateHostelExpense,
  hostelExpenseDefaultValues,
  hostelExpenseBreakdownFieldKeys,
  normalizeBillBreakdownsForForm,
  serializeBillBreakdownsForPayload,
  sumBreakdownItems,
} from "../../features/caretaker/hostelExpenseCalculations";
import { CURRENT_MONTH } from "../../utils/constants";
import { formatCurrency } from "../../utils/formatters";

const CORE_ROWS = [
  ["elp", "ELP"],
  ["chicken", "Chicken"],
  ["cylinder", "Cylinder"],
  ["keb_total", "KEB Total"],
  ["oil", "Oil"],
  ["kirani", "Kirani"],
  ["milk", "Milk"],
  ["labour_bill", "Labour Bill"],
  ["labour_night_watch", "Labour Night Watch"],
  ["hostel_fund", "Hostel Fund"],
];

const MISC_ROWS = [
  ["milling", "Milling"],
  ["veg", "Veg"],
  ["banana", "Banana"],
  ["bakery", "Bakery"],
];

const PROTEIN_ROWS = [
  ["egg_total", "Egg Total", "egg_students_count", "egg_price_per_3", "egg_price_per_unit", "Egg Students Count"],
  ["chicken_total_misc", "Chicken Total Misc", "chicken_students_count", "chicken_price_per_3", "chicken_price_per_unit", "Chicken Students Count"],
  ["paneer_total", "Paneer Total", "paneer_students_count", "paneer_price_per_3", "paneer_price_per_unit", "Paneer Students Count"],
];

const MSC_BREAKDOWN_ROWS = [
  ["kirani", "Kirani"],
  ["oil", "Oil"],
  ["milling", "Milling"],
  ["veg", "Veg"],
  ["milk", "Milk"],
  ["cylinder", "Cylinder"],
  ["elp", "ELP"],
];

const OTHER_MISC_BREAKDOWN_ROWS = [
  ["chicken_total_misc", "Chicken Misc"],
  ["paneer_total", "Paneer"],
  ["egg_total", "Egg"],
  ["banana", "Banana"],
  ["bakery", "Bakery"],
];

export function CaretakerHostelExpensePage() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(CURRENT_MONTH);
  const [billBreakdowns, setBillBreakdowns] = useState(() => normalizeBillBreakdownsForForm());
  const [reportInputs, setReportInputs] = useState({
    opening_balance: "",
    closing_balance_last_month: "",
  });

  const recordQuery = useQuery({
    queryKey: ["caretaker-hostel-expense", month],
    queryFn: () => hostelExpenseApi.listByMonth(month),
    enabled: Boolean(month),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const currentRecord = useMemo(() => recordQuery.data?.data?.[0] || null, [recordQuery.data?.data]);
  const studentQuery = useQuery({
    queryKey: ["caretaker-hostel-expense-headcounts"],
    queryFn: studentApi.list,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const reportSourceQuery = useQuery({
    queryKey: ["monthly-expense-report-source", month],
    queryFn: () => monthlyExpenseReportApi.getSource(month),
    enabled: Boolean(month && currentRecord?._id),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const guestChargeQuery = useQuery({
    queryKey: ["guest-charge-report-source", month],
    queryFn: () => guestChargeApi.list(month),
    enabled: Boolean(month),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const consumptionQuery = useQuery({
    queryKey: ["caretaker-consumption-summary", month],
    queryFn: () => consumptionApi.listByMonth(month),
    enabled: Boolean(month),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const headcounts = useMemo(() => {
    const students = studentQuery.data?.students || [];
    return {
      total_students: students.length,
      total_girls: students.filter((student) => student.gender === "female").length,
      total_boys: students.filter((student) => student.gender === "male").length,
    };
  }, [studentQuery.data?.students]);
  const breakdownTotals = useMemo(
    () =>
      hostelExpenseBreakdownFieldKeys.reduce((acc, key) => {
        acc[key] = sumBreakdownItems(billBreakdowns[key]);
        return acc;
      }, {}),
    [billBreakdowns]
  );
  const proteinStudentCounts = useMemo(() => {
    const records = consumptionQuery.data?.data || [];

    return records.reduce(
      (acc, record) => ({
        egg_students_count: acc.egg_students_count + (Number(record.egg_count || 0) > 0 ? 1 : 0),
        chicken_students_count: acc.chicken_students_count + (Number(record.chicken_count || 0) > 0 ? 1 : 0),
        paneer_students_count: acc.paneer_students_count + (Number(record.paneer_count || 0) > 0 ? 1 : 0),
      }),
      {
        egg_students_count: 0,
        chicken_students_count: 0,
        paneer_students_count: 0,
      }
    );
  }, [consumptionQuery.data?.data]);
  const calculations = useMemo(
    () =>
      calculateHostelExpense({
        ...hostelExpenseDefaultValues,
        ...breakdownTotals,
        ...headcounts,
        ...proteinStudentCounts,
        bill_breakdowns: serializeBillBreakdownsForPayload(billBreakdowns),
        month,
      }),
    [billBreakdowns, breakdownTotals, headcounts, month, proteinStudentCounts]
  );

  useEffect(() => {
    if (!currentRecord) {
      setBillBreakdowns(normalizeBillBreakdownsForForm());
      return;
    }

    setBillBreakdowns(normalizeBillBreakdownsForForm(currentRecord));
  }, [currentRecord]);

  useEffect(() => {
    if (reportSourceQuery.data?.data?.existingReport) {
      const existingReport = reportSourceQuery.data.data.existingReport;
      setReportInputs({
        opening_balance: existingReport.opening_balance ?? "",
        closing_balance_last_month: existingReport.closing_balance_last_month ?? "",
      });
      return;
    }

    setReportInputs({
      opening_balance: "",
      closing_balance_last_month: "",
    });
  }, [month, currentRecord?._id, reportSourceQuery.data?.data?.existingReport]);

  const mutation = useMutation({
    mutationFn: (payload) =>
      currentRecord?._id ? hostelExpenseApi.update(currentRecord._id, payload) : hostelExpenseApi.create(payload),
    onSuccess: () => {
      toast.success(
        currentRecord?._id
          ? "Hostel expense updated and monthly report synced."
          : "Hostel expense saved and monthly report created."
      );
      recordQuery.refetch();
      reportSourceQuery.refetch();
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Unable to save hostel expense."),
  });
  const reportMutation = useMutation({
    mutationFn: (payload) => monthlyExpenseReportApi.generate(month, payload),
    onSuccess: () => {
      toast.success("Monthly expenditure report synced.");
      reportSourceQuery.refetch();
      navigate("/caretaker/reports");
    },
    onError: (error) =>
      toast.error(error?.response?.data?.message || "Unable to generate monthly expenditure report."),
  });

  if (
    recordQuery.isLoading ||
    studentQuery.isLoading ||
    guestChargeQuery.isLoading ||
    consumptionQuery.isLoading ||
    (currentRecord?._id && reportSourceQuery.isLoading)
  ) {
    return <LoadingState label="Loading hostel expense sheet..." />;
  }

  if (
    recordQuery.isError ||
    studentQuery.isError ||
    guestChargeQuery.isError ||
    consumptionQuery.isError ||
    reportSourceQuery.isError
  ) {
    return (
      <ErrorState
        description="Unable to load hostel expense sheet."
        onRetry={() => {
          recordQuery.refetch();
          studentQuery.refetch();
          reportSourceQuery.refetch();
          guestChargeQuery.refetch();
          consumptionQuery.refetch();
        }}
      />
    );
  }

  const updateBillItem = (fieldKey, itemIndex, property, value) => {
    setBillBreakdowns((current) => ({
      ...current,
      [fieldKey]: (current[fieldKey] || [blankHostelExpenseBill()]).map((item, index) =>
        index === itemIndex ? { ...item, [property]: value } : item
      ),
    }));
  };

  const addBillItem = (fieldKey) => {
    setBillBreakdowns((current) => ({
      ...current,
      [fieldKey]: [...(current[fieldKey] || [blankHostelExpenseBill()]), blankHostelExpenseBill()],
    }));
  };

  const removeBillItem = (fieldKey, itemIndex) => {
    setBillBreakdowns((current) => {
      const nextItems = (current[fieldKey] || [blankHostelExpenseBill()]).filter((_, index) => index !== itemIndex);
      return {
        ...current,
        [fieldKey]: nextItems.length ? nextItems : [blankHostelExpenseBill()],
      };
    });
  };

  const renderBillEntries = (fieldKey) => {
    const items = billBreakdowns[fieldKey] || [blankHostelExpenseBill()];

    return (
      <div className="space-y-3">
        {items.map((item, index) => (
          <div key={`${fieldKey}-${index}`} className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 xl:grid-cols-[1fr_0.9fr_1.3fr_0.8fr_auto]">
            <Input
              placeholder="Store name"
              value={item.store_name}
              onChange={(event) => updateBillItem(fieldKey, index, "store_name", event.target.value)}
            />
            <Input
              placeholder="Bill number"
              value={item.bill_number}
              onChange={(event) => updateBillItem(fieldKey, index, "bill_number", event.target.value)}
            />
            <Input
              placeholder="Brief description"
              value={item.description}
              onChange={(event) => updateBillItem(fieldKey, index, "description", event.target.value)}
            />
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="Bill amount"
              value={item.bill_amount}
              onChange={(event) => updateBillItem(fieldKey, index, "bill_amount", event.target.value)}
            />
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:border-rose-300 hover:text-rose-600"
              onClick={() => removeBillItem(fieldKey, index)}
              aria-label="Remove bill"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-2xl border border-dashed border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand-600"
          onClick={() => addBillItem(fieldKey)}
        >
          <Plus size={16} />
          Add bill
        </button>
      </div>
    );
  };

  const renderAutoTotal = (fieldKey) => (
    <Input type="number" min="0" step="0.01" value={breakdownTotals[fieldKey] || 0} readOnly disabled />
  );

  const onSubmit = () => {
    const payload = {
      month,
      ...headcounts,
      ...proteinStudentCounts,
      bill_breakdowns: serializeBillBreakdownsForPayload(billBreakdowns),
    };

    mutation.mutate(payload);
  };

  const reportSource = reportSourceQuery.data?.data;
  const existingGeneratedReport = reportSource?.existingReport || null;
  const reportLocked = Boolean(existingGeneratedReport && existingGeneratedReport.status !== "draft");
  const reportActionLabel = reportLocked
    ? "Report Locked"
    : existingGeneratedReport
      ? "Update Report"
      : "Generate Report";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Hostel Expense"
        title="Hostel expense sheet"
        //description="Enter the full monthly expense sheet, review all live splits instantly, and save one clean hostel-month record."
        action={
          <div className="w-full max-w-sm">
            <MonthPicker value={month} onChange={setMonth} />
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-4">
        <StatCard label="Girls KEB Split" value={calculations.keb_girls} icon={SplitSquareVertical} />
        <StatCard label="Boys KEB Split" value={calculations.keb_boys} tone="coral" icon={SplitSquareVertical} />
        <StatCard label="Misc Per Student" value={calculations.misc_per_student} tone="mint" icon={ReceiptIndianRupee} />
        <StatCard label="Labour Per Student" value={calculations.labour_per_student} icon={Calculator} />
      </div>

      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="panel overflow-hidden">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="section-title">Headcounts</h2>
            {/* <p className="mt-2 text-sm text-slate-500">
              These values are pulled live from the active student records 
            </p> */}
          </div>
          <div className="grid gap-4 p-6 md:grid-cols-3">
            {[
              ["total_students", "Total Students"],
              ["total_girls", "Total Girls"],
              ["total_boys", "Total Boys"],
            ].map(([key, label]) => (
              <div key={key}>
                <label className="field-label">{label}</label>
                <Input type="number" min="0" step="1" value={headcounts[key] || 0} readOnly disabled />
              </div>
            ))}
          </div>
        </div>

        <div className="panel overflow-hidden">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="section-title">Section 1: Core Expenses</h2>
            {/* <p className="mt-2 text-sm text-slate-500">
              Table-style entry with live gender and per-student splits. Night watch for girls is calculated as labour per student plus night watch divided by total girls.
            </p> */}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Field</th>
                  <th className="px-4 py-3 font-semibold">Auto Total</th>
                  <th className="px-4 py-3 font-semibold">Bill Entries</th>
                  <th className="px-4 py-3 font-semibold">Girls Split</th>
                  <th className="px-4 py-3 font-semibold">Boys Split</th>
                  <th className="px-4 py-3 font-semibold">Per Student / Derived</th>
                </tr>
              </thead>
              <tbody>
                {CORE_ROWS.map(([key, label]) => (
                  <tr key={key} className="border-t border-slate-100">
                    <td className="px-4 py-3 align-top font-medium text-ink">{label}</td>
                    <td className="px-4 py-3">{renderAutoTotal(key)}</td>
                    <td className="min-w-[540px] px-4 py-3">{renderBillEntries(key)}</td>
                    <td className="px-4 py-3 align-top text-slate-600">
                      {key === "keb_total"
                        ? formatCurrency(calculations.keb_girls)
                        : key === "labour_night_watch"
                          ? formatCurrency(calculations.labour_night_watch)
                          : "-"}
                    </td>
                    <td className="px-4 py-3 align-top text-slate-600">
                      {key === "keb_total" ? formatCurrency(calculations.keb_boys) : "-"}
                    </td>
                    <td className="px-4 py-3 align-top text-slate-600">
                      {key === "keb_total"
                        ? `₹${calculations.keb_per_girl.toFixed(2)} / girl, ₹${calculations.keb_per_boy.toFixed(2)} / boy`
                        : key === "labour_bill"
                          ? formatCurrency(calculations.labour_per_student)
                          : key === "labour_night_watch"
                            ? formatCurrency(calculations.labour_night_watch_per_girl)
                            : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel overflow-hidden">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="section-title">Section 2: Misc Expenses</h2>
            {/* <p className="mt-2 text-sm text-slate-500">Banana and bakery are combined for the current per-student misc split.</p> */}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Field</th>
                  <th className="px-4 py-3 font-semibold">Auto Total</th>
                  <th className="px-4 py-3 font-semibold">Bill Entries</th>
                  <th className="px-4 py-3 font-semibold">Per Student</th>
                </tr>
              </thead>
              <tbody>
                {MISC_ROWS.map(([key, label]) => (
                  <tr key={key} className="border-t border-slate-100">
                    <td className="px-4 py-3 align-top font-medium text-ink">{label}</td>
                    <td className="px-4 py-3">{renderAutoTotal(key)}</td>
                    <td className="min-w-[540px] px-4 py-3">{renderBillEntries(key)}</td>
                    <td className="px-4 py-3 align-top text-slate-600">
                      {key === "banana" || key === "bakery" ? formatCurrency(calculations.misc_per_student) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel overflow-hidden">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="section-title">Section 3: Protein Expense Logic</h2>
            {/* <p className="mt-2 text-sm text-slate-500">Each total is converted into a per-student 3-unit price, then a per-unit price.</p> */}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Field</th>
                  <th className="px-4 py-3 font-semibold">Auto Total</th>
                  <th className="px-4 py-3 font-semibold">Bill Entries</th>
                  <th className="px-4 py-3 font-semibold">Students Count</th>
                  <th className="px-4 py-3 font-semibold">Price Per 3 Units</th>
                  <th className="px-4 py-3 font-semibold">Price Per Unit</th>
                </tr>
              </thead>
              <tbody>
                {PROTEIN_ROWS.map(([inputKey, label, countKey, perThreeKey, perUnitKey, countLabel]) => (
                  <tr key={inputKey} className="border-t border-slate-100">
                    <td className="px-4 py-3 align-top font-medium text-ink">{label}</td>
                    <td className="px-4 py-3">{renderAutoTotal(inputKey)}</td>
                    <td className="min-w-[540px] px-4 py-3">{renderBillEntries(inputKey)}</td>
                    <td className="px-4 py-3">
                      <div>
                        <label className="field-label">{countLabel}</label>
                        <Input type="number" min="0" step="1" value={proteinStudentCounts[countKey] || 0} readOnly disabled />
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-slate-600">{formatCurrency(calculations[perThreeKey])}</td>
                    <td className="px-4 py-3 align-top text-slate-600">{formatCurrency(calculations[perUnitKey])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel p-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">KEB Per Girl</p>
              <p className="mt-3 text-2xl font-display font-bold text-ink">{formatCurrency(calculations.keb_per_girl)}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">KEB Per Boy</p>
              <p className="mt-3 text-2xl font-display font-bold text-ink">{formatCurrency(calculations.keb_per_boy)}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Night Watch Per Girl</p>
              <p className="mt-3 text-2xl font-display font-bold text-ink">
                {formatCurrency(calculations.labour_night_watch_per_girl)}
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <Button type="submit" loading={mutation.isPending}>
              {currentRecord ? "Update hostel expense" : "Save hostel expense"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!currentRecord}
              onClick={() => navigate("/caretaker/reports", { state: { month } })}
            >
              Go To Reports
            </Button>
            {/* <p className="text-sm text-slate-500">
              One record is stored per hostel and month. Saving again updates the same monthly sheet.
            </p> */}
          </div>
        </div>
      </form>

      <div className="panel space-y-5 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="section-title">Monthly Expenditure Report</h2>
            {/* <p className="mt-2 text-sm text-slate-500">
              Reused values come directly from the saved hostel expense sheet and stay read-only here. Only the manual balance inputs below can be changed.
            </p> */}
          </div>
          <Button
            type="button"
            onClick={() =>
              reportMutation.mutate({
                opening_balance: Number(reportInputs.opening_balance || 0),
                closing_balance_last_month: Number(reportInputs.closing_balance_last_month || 0),
              })
            }
            loading={reportMutation.isPending}
            disabled={!currentRecord || reportLocked}
          >
            {reportActionLabel}
          </Button>
        </div>

        {!currentRecord ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
            Save the hostel expense sheet first. Report generation only starts after a monthly hostel expense record exists.
          </div>
        ) : null}

        {reportSource ? (
          <>
            <div className="overflow-hidden rounded-3xl border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
                <h3 className="text-lg font-semibold text-ink">Report Source Breakdown</h3>
                {/* <p className="mt-1 text-sm text-slate-500">
                  The saved Hostel Expense values are shown below exactly as they will feed the monthly expenditure report.
                </p> */}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Particular</th>
                      <th className="px-4 py-3 font-semibold">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MSC_BREAKDOWN_ROWS.map(([key, label]) => (
                      <tr key={key} className="border-t border-slate-100">
                        <td className="px-4 py-3 font-medium text-ink">{label}</td>
                        <td className="px-4 py-3 text-slate-600">{formatCurrency(reportSource.values.msc_breakdown?.[key] || 0)}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-slate-200 bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-ink">MSC Total</td>
                      <td className="px-4 py-3 font-semibold text-ink">{formatCurrency(reportSource.values.msc_total)}</td>
                    </tr>
                    <tr className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-ink">Previous Month</td>
                      <td className="px-4 py-3 text-slate-600">{reportSource.previousMonth}</td>
                    </tr>
                    <tr className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-ink">Closing Balance Last Month</td>
                      <td className="px-4 py-3">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={reportInputs.closing_balance_last_month}
                          readOnly={reportLocked}
                          disabled={reportLocked}
                          onChange={(event) =>
                            setReportInputs((current) => ({
                              ...current,
                              closing_balance_last_month: event.target.value,
                            }))
                          }
                        />
                      </td>
                    </tr>
                    <tr className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-ink">Opening Balance</td>
                      <td className="px-4 py-3">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={reportInputs.opening_balance}
                          readOnly={reportLocked}
                          disabled={reportLocked}
                          onChange={(event) =>
                            setReportInputs((current) => ({
                              ...current,
                              opening_balance: event.target.value,
                            }))
                          }
                        />
                      </td>
                    </tr>
                    <tr className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-ink">Guest Charges Total</td>
                      <td className="px-4 py-3 text-slate-600">{formatCurrency(reportSource.values.guest_charge_total || 0)}</td>
                    </tr>
                    {(reportSource.values.guest_charge_breakdown || []).map((row) => (
                      <tr key={row.id} className="border-t border-slate-100">
                        <td className="px-4 py-3 font-medium text-ink">
                          {row.event_name} ({row.guest_count} guests)
                        </td>
                        <td className="px-4 py-3 text-slate-600">{formatCurrency(row.amount || 0)}</td>
                      </tr>
                    ))}
                    {OTHER_MISC_BREAKDOWN_ROWS.map(([key, label]) => (
                      <tr key={key} className="border-t border-slate-100">
                        <td className="px-4 py-3 font-medium text-ink">{label}</td>
                        <td className="px-4 py-3 text-slate-600">{formatCurrency(reportSource.values.other_misc_breakdown?.[key] || 0)}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-slate-200 bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-ink">Other Misc Total</td>
                      <td className="px-4 py-3 font-semibold text-ink">{formatCurrency(reportSource.values.other_misc)}</td>
                    </tr>
                    <tr className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-ink">Saved Total Closing Balance</td>
                      <td className="px-4 py-3 text-slate-600">
                        {existingGeneratedReport ? formatCurrency(existingGeneratedReport.total_closing_balance) : "-"}
                      </td>
                    </tr>
                    <tr className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-ink">Saved Total Opening Balance</td>
                      <td className="px-4 py-3 text-slate-600">
                        {existingGeneratedReport ? formatCurrency(existingGeneratedReport.total_opening_balance) : "-"}
                      </td>
                    </tr>
                    <tr className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-ink">Saved Total Expenditure</td>
                      <td className="px-4 py-3 text-slate-600">
                        {existingGeneratedReport ? formatCurrency(existingGeneratedReport.total_expenditure) : "-"}
                      </td>
                    </tr>
                    <tr className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-ink">Saved Mess Bill Per Day</td>
                      <td className="px-4 py-3 text-slate-600">
                        {existingGeneratedReport ? formatCurrency(existingGeneratedReport.mess_bill_per_day) : "-"}
                      </td>
                    </tr>
                    <tr className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-ink">Electricity Bill</td>
                      <td className="px-4 py-3 text-slate-600">{formatCurrency(reportSource.values.electricity_bill)}</td>
                    </tr>
                    <tr className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-ink">Internet</td>
                      <td className="px-4 py-3 text-slate-600">{formatCurrency(reportSource.values.internet)}</td>
                    </tr>
                    <tr className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-ink">Labour Payment</td>
                      <td className="px-4 py-3 text-slate-600">{formatCurrency(reportSource.values.labour_payment)}</td>
                    </tr>
                    <tr className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-ink">Total Students</td>
                      <td className="px-4 py-3 text-slate-600">{reportSource.values.total_students}</td>
                    </tr>
                    <tr className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-ink">Total Boys</td>
                      <td className="px-4 py-3 text-slate-600">{reportSource.values.total_boys}</td>
                    </tr>
                    <tr className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-ink">Total Girls</td>
                      <td className="px-4 py-3 text-slate-600">{reportSource.values.total_girls}</td>
                    </tr>
                    <tr className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-ink">Days In Month</td>
                      <td className="px-4 py-3 text-slate-600">{reportSource.values.days_in_month}</td>
                    </tr>
                    <tr className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-ink">Total Days</td>
                      <td className="px-4 py-3 text-slate-600">{reportSource.values.total_days}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {reportSource.existingReport ? (
              <div
                className={`rounded-3xl p-4 text-sm ${
                  reportLocked
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border border-sky-200 bg-sky-50 text-sky-700"
                }`}
              >
                {reportLocked
                  ? `A monthly expenditure report already exists for ${month} and is locked because it has moved beyond draft. You can view or download it from the Reports page.`
                  : `A draft monthly expenditure report already exists for ${month} and is auto-created from the saved hostel expense sheet. You can still update the opening and closing balances here before submitting it from the Reports page.`}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
