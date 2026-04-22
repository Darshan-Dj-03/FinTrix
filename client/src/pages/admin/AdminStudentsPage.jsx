import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { studentApi } from "../../api/studentApi";
import { DataTable } from "../../components/common/DataTable";
import { ErrorState } from "../../components/common/ErrorState";
import { LoadingState } from "../../components/common/LoadingState";
import { PageHeader } from "../../components/common/PageHeader";
import { StatusBadge } from "../../components/common/StatusBadge";

export function AdminStudentsPage() {
  const query = useQuery({ queryKey: ["admin-students-page"], queryFn: studentApi.list });

  const mutation = useMutation({
    mutationFn: ({ id, payload }) => studentApi.update(id, payload),
    onSuccess: () => {
      toast.success("Student updated.");
      query.refetch();
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Unable to update student."),
  });

  if (query.isLoading) return <LoadingState label="Loading students..." />;
  if (query.isError) return <ErrorState description="Unable to load students." onRetry={query.refetch} />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Students"
        title="Student registry"
        description="Inspect hostel assignment, EBL applicability, and active status for each student."
      />

      <DataTable
        rows={query.data?.students || []}
        columns={[
          { key: "studentId", label: "Student ID" },
          { key: "name", label: "Name", render: (row) => row.userId?.name || "-" },
          { key: "hostel", label: "Hostel", render: (row) => row.userId?.hostelId?.name || "-" },
          { key: "ebl", label: "EBL", render: (row) => <StatusBadge value={row.isEBL ? "enrolled" : "not_applicable"} /> },
          { key: "active", label: "Active", render: (row) => <StatusBadge value={row.isActive ? "paid" : "pending"} /> },
          {
            key: "actions",
            label: "Actions",
            render: (row) => (
              <button
                className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700"
                onClick={() => mutation.mutate({ id: row._id, payload: { isActive: !row.isActive } })}
              >
                Toggle active
              </button>
            ),
          },
        ]}
      />
    </div>
  );
}
