import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { authApi } from "../../api/authApi";
import { eblApi } from "../../api/eblApi";
import { PageHeader } from "../../components/common/PageHeader";
import { StatusBadge } from "../../components/common/StatusBadge";
import { Button } from "../../components/ui/Button";
import { useAuthStore } from "../../store/authStore";

export function StudentEblPage() {
  const studentProfile = useAuthStore((state) => state.studentProfile);
  const user = useAuthStore((state) => state.user);
  const updateProfile = useAuthStore((state) => state.updateProfile);

  useQuery({
    queryKey: ["auth", "me", "ebl-status"],
    queryFn: authApi.getMe,
    enabled: Boolean(user?.id),
    refetchOnWindowFocus: true,
    onSuccess: (response) => {
      updateProfile({
        user: response.data.user,
        studentProfile: response.data.studentProfile,
      });
    },
  });

  const mutation = useMutation({
    mutationFn: () => eblApi.request(studentProfile._id),
    onSuccess: () => {
      updateProfile({
        user: {
          ...user,
          eblApproved: false,
          eblRequestPending: true,
          eblRejected: false,
        },
        studentProfile,
      });
      toast.success("EBL request submitted.");
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Unable to request EBL."),
  });

  const isApproved = Boolean(user?.eblApproved && (studentProfile?.isEBL ?? user?.isEBL));

  const state = isApproved
    ? "approved"
    : user?.eblRequestPending
      ? "submitted"
      : user?.eblRejected
        ? "rejected"
        : "pending";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="EBL"
        title="Electricity bill status"
        description="Submit or track EBL approval requests from the student workspace."
      />

      <div className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
        <div className="panel p-6">
          <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Current status</p>
          <div className="mt-4">
            <StatusBadge value={state} />
          </div>
        </div>
        <div className="panel p-6">
          <h2 className="section-title">Request EBL approval</h2>
          <p className="mt-3 text-sm text-slate-500">
            Your request enters the approval chain and updates the backend’s EBL flags when accepted.
          </p>
          <div className="mt-5">
            <Button
              onClick={() => mutation.mutate()}
              loading={mutation.isPending}
              disabled={!studentProfile?._id || isApproved || user?.eblRequestPending}
            >
              Submit request
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
