import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { studentSignupApi } from "../../api/studentSignupApi";
import { DataTable } from "../../components/common/DataTable";
import { ErrorState } from "../../components/common/ErrorState";
import { LoadingState } from "../../components/common/LoadingState";
import { PageHeader } from "../../components/common/PageHeader";
import { StatusBadge } from "../../components/common/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { useAuthStore } from "../../store/authStore";
import { formatDate } from "../../utils/formatters";

export function StudentSignupRequestsPage({ mode = "caretaker" }) {
  const user = useAuthStore((state) => state.user);
  const [reviewState, setReviewState] = useState({});

  const query = useQuery({
    queryKey: ["student-signup-requests", mode],
    queryFn: studentSignupApi.list,
  });

  const forwardMutation = useMutation({
    mutationFn: ({ id, payload }) => studentSignupApi.caretakerForward(id, payload),
    onSuccess: () => {
      toast.success("Request forwarded to admin.");
      query.refetch();
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Unable to forward request."),
  });

  const caretakerRejectMutation = useMutation({
    mutationFn: ({ id, payload }) => studentSignupApi.caretakerReject(id, payload),
    onSuccess: () => {
      toast.success("Request rejected.");
      query.refetch();
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Unable to reject request."),
  });

  const adminApproveMutation = useMutation({
    mutationFn: (id) => studentSignupApi.adminApprove(id),
    onSuccess: () => {
      toast.success("Student approved.");
      query.refetch();
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Unable to approve request."),
  });

  const adminRejectMutation = useMutation({
    mutationFn: ({ id, payload }) => studentSignupApi.adminReject(id, payload),
    onSuccess: () => {
      toast.success("Request rejected.");
      query.refetch();
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Unable to reject request."),
  });

  const requests = query.data?.data || [];

  const updateReviewState = (id, key, value) => {
    setReviewState((current) => ({
      ...current,
      [id]: {
        hostelId:
          current[id]?.hostelId ||
          user?.hostelId?._id ||
          user?.hostelId ||
          "",
        isEBL: current[id]?.isEBL || false,
        eblCategory: current[id]?.eblCategory || "",
        reason: current[id]?.reason || "",
        [key]: value,
      },
    }));
  };

  if (query.isLoading) {
    return <LoadingState label="Loading student requests..." />;
  }

  if (query.isError) {
    return (
      <ErrorState
        description="Unable to load student signup requests."
        onRetry={() => {
          query.refetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Student Requests"
        title={mode === "caretaker" ? "Caretaker signup review" : "Admin signup approvals"}
        description={
          mode === "caretaker"
            ? "Assign hostel and EBL status before forwarding student requests to admin."
            : "Approve or reject caretaker-reviewed student signup requests."
        }
      />

      <DataTable
        rows={requests}
        columns={[
          { key: "studentId", label: "Student ID", render: (row) => row.studentId },
          { key: "name", label: "Name", render: (row) => row.user?.name || "-" },
          { key: "email", label: "Email", render: (row) => row.user?.email || "-" },
          { key: "gender", label: "Gender", render: (row) => row.gender || "-" },
          { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
          {
            key: "assignment",
            label: mode === "caretaker" ? "Caretaker Review" : "Assigned Review",
            render: (row) =>
              mode === "caretaker" ? (
                <div className="space-y-2">
                  <div className="text-xs text-slate-500">
                    Hostel: {user?.hostelId?.name || "Current hostel"}
                  </div>
                  <Select
                    value={reviewState[row.id]?.isEBL ? "yes" : "no"}
                    onChange={(event) => updateReviewState(row.id, "isEBL", event.target.value === "yes")}
                  >
                    <option value="no">EBL: No</option>
                    <option value="yes">EBL: Yes</option>
                  </Select>
                  {reviewState[row.id]?.isEBL ? (
                    <Select
                      value={reviewState[row.id]?.eblCategory || ""}
                      onChange={(event) => updateReviewState(row.id, "eblCategory", event.target.value)}
                    >
                      <option value="">Select category</option>
                      <option value="SC">SC</option>
                      <option value="ST">ST</option>
                    </Select>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-1 text-xs text-slate-600">
                  <div>Hostel: {row.assignedHostelId?.name || "-"}</div>
                  <div>EBL: {row.assignedIsEBL ? `Yes${row.assignedEblCategory ? ` (${row.assignedEblCategory})` : ""}` : "No"}</div>
                  <div>Reviewed: {row.caretakerReviewedAt ? formatDate(row.caretakerReviewedAt) : "-"}</div>
                </div>
              ),
          },
          {
            key: "actions",
            label: "Actions",
            render: (row) =>
              mode === "caretaker" ? (
                <div className="space-y-2">
                  <Input
                    value={reviewState[row.id]?.reason || ""}
                    onChange={(event) => updateReviewState(row.id, "reason", event.target.value)}
                    placeholder="Optional rejection reason"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        forwardMutation.mutate({
                          id: row.id,
                          payload: {
                            hostelId: reviewState[row.id]?.hostelId || user?.hostelId?._id || user?.hostelId,
                            isEBL: Boolean(reviewState[row.id]?.isEBL),
                            eblCategory: reviewState[row.id]?.eblCategory || "",
                          },
                        })
                      }
                      loading={forwardMutation.isPending}
                    >
                      Forward
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() =>
                        caretakerRejectMutation.mutate({
                          id: row.id,
                          payload: { reason: reviewState[row.id]?.reason || "" },
                        })
                      }
                      loading={caretakerRejectMutation.isPending}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    value={reviewState[row.id]?.reason || ""}
                    onChange={(event) => updateReviewState(row.id, "reason", event.target.value)}
                    placeholder="Optional rejection reason"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => adminApproveMutation.mutate(row.id)} loading={adminApproveMutation.isPending}>
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() =>
                        adminRejectMutation.mutate({
                          id: row.id,
                          payload: { reason: reviewState[row.id]?.reason || "" },
                        })
                      }
                      loading={adminRejectMutation.isPending}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ),
          },
        ]}
        emptyMessage={
          mode === "caretaker"
            ? "No pending caretaker reviews."
            : "No pending admin approvals."
        }
      />
    </div>
  );
}
