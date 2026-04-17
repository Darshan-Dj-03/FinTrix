import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Drumstick, Egg, Milk, Salad, Save, Users } from "lucide-react";
import toast from "react-hot-toast";

import { consumptionApi } from "../../api/consumptionApi";
import { hostelApi } from "../../api/hostelApi";
import { studentApi } from "../../api/studentApi";
import { DataTable } from "../../components/common/DataTable";
import { ErrorState } from "../../components/common/ErrorState";
import { LoadingState } from "../../components/common/LoadingState";
import { MonthPicker } from "../../components/common/MonthPicker";
import { PageHeader } from "../../components/common/PageHeader";
import { Pagination } from "../../components/common/Pagination";
import { SearchField } from "../../components/common/SearchField";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { useAuthStore } from "../../store/authStore";
import { CURRENT_MONTH } from "../../utils/constants";
import { formatCurrency } from "../../utils/formatters";

const getHostelId = (value) => value?._id || value || "";

const buildStudentRows = (students, records) => {
  const recordMap = new Map(records.map((record) => [record.studentId?._id, record]));

  return [...students]
    .sort((a, b) => String(a.studentId || "").localeCompare(String(b.studentId || ""), undefined, { numeric: true }))
    .map((student) => {
      const existing = recordMap.get(student._id);
      return {
        id: student._id,
        studentId: student.studentId,
        name: student.userId?.name || "Student",
        hostel: student.userId?.hostelId?.name || "-",
        egg_count: existing?.egg_count ?? 0,
        chicken_count: existing?.chicken_count ?? 0,
        paneer_count: existing?.paneer_count ?? 0,
        milk_amount: existing?.milk_amount ?? 0,
        fine_amount: existing?.fine_amount ?? 0,
        absent_days: existing?.absent_days ?? 0,
      };
    });
};

export function ConsumptionManagementPage({ mode = "caretaker" }) {
  const user = useAuthStore((state) => state.user);
  const isCaretaker = mode === "caretaker";
  const [month, setMonth] = useState(CURRENT_MONTH);
  const [search, setSearch] = useState("");
  const [selectedHostelId, setSelectedHostelId] = useState("");
  const [sheetRows, setSheetRows] = useState([]);
  const [recordsOverride, setRecordsOverride] = useState(null);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const userHostelId = getHostelId(user?.hostelId);
  const activeHostelId = isCaretaker ? userHostelId : selectedHostelId;

  const studentsQuery = useQuery({
    queryKey: ["consumption-students", user?.role],
    queryFn: studentApi.list,
    refetchOnMount: "always",
  });
  const recordsQuery = useQuery({
    queryKey: ["consumption-records", month, user?.role],
    queryFn: () => consumptionApi.listByMonth(month),
    enabled: Boolean(month),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const hostelQuery = useQuery({
    queryKey: ["consumption-hostels", user?.role],
    queryFn: hostelApi.list,
    enabled: !isCaretaker,
    refetchOnMount: "always",
  });

  const refetchAll = () => {
    studentsQuery.refetch();
    recordsQuery.refetch();
    hostelQuery.refetch();
  };

  const saveSheetMutation = useMutation({
    mutationFn: consumptionApi.bulkUpsert,
    onSuccess: (response) => {
      toast.success("Consumption sheet saved.");
      setRecordsOverride(response?.data || []);
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Unable to save consumption sheet."),
  });

  const deleteMutation = useMutation({
    mutationFn: consumptionApi.remove,
    onSuccess: () => {
      toast.success("Consumption deleted.");
      setRecordsOverride(null);
      refetchAll();
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Unable to delete consumption."),
  });

  useEffect(() => {
    setRecordsOverride(null);
  }, [month, activeHostelId]);

  useEffect(() => {
    setPage(1);
  }, [month, activeHostelId, search]);

  const students = useMemo(() => {
    const allStudents = studentsQuery.data?.students || [];
    return allStudents.filter((student) => {
      const hostelId = student.userId?.hostelId?._id || student.userId?.hostelId;
      if (!activeHostelId) return true;
      return hostelId?.toString() === activeHostelId.toString();
    });
  }, [activeHostelId, studentsQuery.data?.students]);

  const records = useMemo(() => {
    const rows = recordsOverride ?? recordsQuery.data?.data ?? [];
    return rows
      .filter((row) => {
        const hostelId = row.studentId?.userId?.hostelId?._id || row.studentId?.userId?.hostelId;
        const matchesHostel = activeHostelId ? hostelId?.toString() === activeHostelId.toString() : true;
        const text = `${row.studentId?.studentId || ""} ${row.studentId?.userId?.name || ""}`.toLowerCase();
        const matchesSearch = search ? text.includes(search.toLowerCase()) : true;
        return matchesHostel && matchesSearch;
      })
      .sort((left, right) =>
        String(left.studentId?.studentId || "").localeCompare(String(right.studentId?.studentId || ""), undefined, {
          numeric: true,
        })
      );
  }, [activeHostelId, recordsOverride, recordsQuery.data?.data, search]);

  useEffect(() => {
    if (!isCaretaker) return;
    setSheetRows(buildStudentRows(students, records));
  }, [isCaretaker, students, records, month]);

  const filteredSheetRows = useMemo(() => {
    if (!isCaretaker) return [];
    return sheetRows.filter((row) => {
      const text = `${row.studentId} ${row.name}`.toLowerCase();
      return search ? text.includes(search.toLowerCase()) : true;
    });
  }, [isCaretaker, search, sheetRows]);

  const summary = useMemo(() => {
    const sourceRows = isCaretaker ? sheetRows : records;
    return sourceRows.reduce(
      (totals, row) => ({
        records: totals.records + 1,
        egg: totals.egg + Number(row.egg_count || 0),
        eggStudents: totals.eggStudents + (Number(row.egg_count || 0) > 0 ? 1 : 0),
        chicken: totals.chicken + Number(row.chicken_count || 0),
        chickenStudents: totals.chickenStudents + (Number(row.chicken_count || 0) > 0 ? 1 : 0),
        paneer: totals.paneer + Number(row.paneer_count || 0),
        paneerStudents: totals.paneerStudents + (Number(row.paneer_count || 0) > 0 ? 1 : 0),
        milk: totals.milk + Number(row.milk_amount || 0),
        fine: totals.fine + Number(row.fine_amount || 0),
        absentDays: totals.absentDays + Number(row.absent_days || 0),
      }),
      {
        records: 0,
        egg: 0,
        eggStudents: 0,
        chicken: 0,
        chickenStudents: 0,
        paneer: 0,
        paneerStudents: 0,
        milk: 0,
        fine: 0,
        absentDays: 0,
      }
    );
  }, [isCaretaker, records, sheetRows]);

  const paginatedRecords = useMemo(() => {
    if (isCaretaker) {
      return [];
    }

    const startIndex = (page - 1) * pageSize;
    return records.slice(startIndex, startIndex + pageSize);
  }, [isCaretaker, page, records]);

  const totalPages = isCaretaker ? 0 : Math.max(1, Math.ceil(records.length / pageSize));
  const visibleStart = !isCaretaker && records.length ? (page - 1) * pageSize + 1 : 0;
  const visibleEnd = !isCaretaker && records.length ? Math.min((page - 1) * pageSize + paginatedRecords.length, records.length) : 0;

  if (studentsQuery.isLoading || recordsQuery.isLoading || hostelQuery.isLoading) {
    return <LoadingState label="Loading consumption manager..." />;
  }

  const shouldTreatRecordsErrorAsFatal = !isCaretaker;

  if (studentsQuery.isError || hostelQuery.isError || (recordsQuery.isError && shouldTreatRecordsErrorAsFatal)) {
    return <ErrorState description="Unable to load consumption workspace." onRetry={refetchAll} />;
  }

  const hostels = hostelQuery.data?.data || [];

  const updateSheetValue = (studentRowId, field, value) => {
    setSheetRows((current) =>
      current.map((row) =>
        row.id === studentRowId
          ? {
              ...row,
              [field]: value === "" ? "" : Number(value),
            }
          : row
      )
    );
  };

  const saveSheet = () => {
    const payload = filteredSheetRows.map((row) => ({
      studentId: row.id,
      egg_count: Number(row.egg_count || 0),
      chicken_count: Number(row.chicken_count || 0),
      paneer_count: Number(row.paneer_count || 0),
      milk_amount: Number(row.milk_amount || 0),
      fine_amount: Number(row.fine_amount || 0),
      absent_days: Number(row.absent_days || 0),
    }));

    if (!payload.length) {
      toast.error("No students available to save for this filter.");
      return;
    }

    saveSheetMutation.mutate({ month, records: payload });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Consumption"
        title={isCaretaker ? "Student consumptions" : "Consumption oversight"}
        // description={
        //   isCaretaker
        //     ? "Capture egg, chicken, paneer counts, and milk amounts for each student in one monthly sheet, just like attendance." 
        //     : "Audit monthly student consumption across hostels using the same records that feed bill generation."
        // }
        action={
          <div className="flex w-full max-w-3xl gap-3">
            <div className="flex-1">
              <MonthPicker value={month} onChange={setMonth} />
            </div>
            {!isCaretaker ? (
              <div className="flex-1">
                <label className="field-label">Hostel</label>
                <Select value={selectedHostelId} onChange={(event) => setSelectedHostelId(event.target.value)}>
                  <option value="">All hostels</option>
                  {hostels.map((hostel) => (
                    <option key={hostel._id} value={hostel._id}>
                      {hostel.name}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
            <div className="flex-[1.2]">
              <label className="field-label">Search</label>
              <SearchField value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search student id or name" />
            </div>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        <div className="panel min-h-[168px] p-5">
          <div className="flex h-full flex-col">
            <div className="flex items-start justify-between gap-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Students in sheet</p>
              <div className="rounded-2xl bg-brand-100 p-3 text-brand-700">
                <Users size={18} />
              </div>
            </div>
            <div className="mt-auto pt-6">
              <p className="text-3xl font-display font-bold leading-none text-ink">{summary.records}</p>
              <p className="mt-2 text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Active records</p>
            </div>
          </div>
        </div>

        {[
          {
            label: "Egg Summary",
            totalLabel: "Total units",
            totalValue: summary.egg,
            countLabel: "Students",
            countValue: summary.eggStudents,
            icon: Egg,
            tone: "brand",
          },
          {
            label: "Chicken Summary",
            totalLabel: "Total units",
            totalValue: summary.chicken,
            countLabel: "Students",
            countValue: summary.chickenStudents,
            icon: Drumstick,
            tone: "coral",
          },
          {
            label: "Paneer Summary",
            totalLabel: "Total units",
            totalValue: summary.paneer,
            countLabel: "Students",
            countValue: summary.paneerStudents,
            icon: Salad,
            tone: "mint",
          },
        ].map(({ label, totalLabel, totalValue, countLabel, countValue, icon: Icon, tone }) => (
          <div key={label} className="panel min-h-[168px] p-5">
            <div className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
                <div
                  className={`rounded-2xl p-3 ${
                    tone === "coral"
                      ? "bg-orange-100 text-orange-600"
                      : tone === "mint"
                        ? "bg-emerald-100 text-emerald-600"
                        : "bg-brand-100 text-brand-700"
                  }`}
                >
                  <Icon size={18} />
                </div>
              </div>
              <div className="mt-auto grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{totalLabel}</p>
                  <p className="mt-1 text-3xl font-display font-bold leading-none text-ink">{totalValue}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{countLabel}</p>
                  <p className="mt-1 text-3xl font-display font-bold leading-none text-ink">{countValue}</p>
                </div>
              </div>
            </div>
          </div>
        ))}

        <div className="panel min-h-[168px] p-5">
          <div className="flex h-full flex-col">
            <div className="flex items-start justify-between gap-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Charges Summary</p>
              <div className="rounded-2xl bg-brand-100 p-3 text-brand-700">
                <Milk size={18} />
              </div>
            </div>
            <div className="mt-auto space-y-3 border-t border-slate-100 pt-4">
              <div className="flex items-end justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Milk amount</p>
                <p className="text-xl font-display font-bold leading-none text-ink">{formatCurrency(summary.milk)}</p>
              </div>
              <div className="flex items-end justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Fine amount</p>
                <p className="text-xl font-display font-bold leading-none text-ink">{formatCurrency(summary.fine)}</p>
              </div>
              <div className="flex items-end justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Absent days</p>
                <p className="text-xl font-display font-bold leading-none text-ink">{summary.absentDays}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isCaretaker ? (
        <div className="panel space-y-5 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="section-title">Monthly consumption sheet</h3>
              {/* <p className="mt-2 text-sm text-slate-500">
                Every active student in your hostel is listed here. Fill the counts like attendance, then save the whole month in one go.
              </p> */}
            </div>
            <Button type="button" onClick={saveSheet} loading={saveSheetMutation.isPending}>
              <Save className="h-4 w-4" />
              Save sheet
            </Button>
          </div>

          {recordsQuery.isError ? (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
              The sheet was saved, but the background refresh failed. You can keep working here, and a page refresh after restarting the backend should resync everything.
            </div>
          ) : null}

          {!filteredSheetRows.length ? (
            <div className="panel-soft flex min-h-40 items-center justify-center p-8 text-sm text-slate-500">
              No students found for the selected filters.
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {[
                        "Student",
                        "Name",
                        "Egg Count",
                        "Chicken Count",
                        "Paneer Count",
                        "Milk Amount",
                        "Fine",
                        "Absent Days",
                      ].map((label) => (
                        <th
                          key={label}
                          className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-400"
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSheetRows.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/70">
                        <td className="px-5 py-4 font-medium text-ink">{row.studentId}</td>
                        <td className="px-5 py-4 text-slate-600">{row.name}</td>
                        <td className="px-5 py-4">
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={row.egg_count}
                            onChange={(event) => updateSheetValue(row.id, "egg_count", event.target.value)}
                            className="h-10 min-w-28"
                          />
                        </td>
                        <td className="px-5 py-4">
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={row.chicken_count}
                            onChange={(event) => updateSheetValue(row.id, "chicken_count", event.target.value)}
                            className="h-10 min-w-28"
                          />
                        </td>
                        <td className="px-5 py-4">
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={row.paneer_count}
                            onChange={(event) => updateSheetValue(row.id, "paneer_count", event.target.value)}
                            className="h-10 min-w-28"
                          />
                        </td>
                        <td className="px-5 py-4">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.milk_amount}
                            onChange={(event) => updateSheetValue(row.id, "milk_amount", event.target.value)}
                            className="h-10 min-w-32"
                          />
                        </td>
                        <td className="px-5 py-4">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.fine_amount}
                            onChange={(event) => updateSheetValue(row.id, "fine_amount", event.target.value)}
                            className="h-10 min-w-28"
                          />
                        </td>
                        <td className="px-5 py-4">
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={row.absent_days}
                            onChange={(event) => updateSheetValue(row.id, "absent_days", event.target.value)}
                            className="h-10 min-w-28"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {!isCaretaker ? (
        <div className="space-y-3">
          {records.length ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-500">
                Showing <span className="font-semibold text-slate-800">{visibleStart}</span>
                {" - "}
                <span className="font-semibold text-slate-800">{visibleEnd}</span>
                {" of "}
                <span className="font-semibold text-slate-800">{records.length}</span> monthly consumption records
              </p>
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          ) : null}
          <DataTable
            rows={paginatedRecords}
            columns={[
              { key: "student", label: "Student", render: (row) => row.studentId?.studentId || "-" },
              { key: "name", label: "Name", render: (row) => row.studentId?.userId?.name || "-" },
              { key: "hostel", label: "Hostel", render: (row) => row.studentId?.userId?.hostelId?.name || "-" },
              { key: "egg_count", label: "Egg", render: (row) => row.egg_count || 0 },
              { key: "chicken_count", label: "Chicken", render: (row) => row.chicken_count || 0 },
              { key: "paneer_count", label: "Paneer", render: (row) => row.paneer_count || 0 },
              { key: "milk_amount", label: "Milk Amount", render: (row) => formatCurrency(row.milk_amount || 0) },
              { key: "fine_amount", label: "Fine", render: (row) => formatCurrency(row.fine_amount || 0) },
              { key: "absent_days", label: "Absent Days", render: (row) => row.absent_days || 0 },
              {
                key: "actions",
                label: "Actions",
                render: (row) =>
                  user?.role === "admin" ? "-" : (
                    <Button type="button" size="sm" variant="danger" onClick={() => deleteMutation.mutate(row._id)}>
                      Delete
                    </Button>
                  ),
              },
            ]}
            emptyMessage="No monthly consumption records found for the selected filters."
          />
        </div>
      ) : null}
    </div>
  );
}
