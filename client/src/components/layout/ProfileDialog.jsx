import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { X } from "lucide-react";

import { authApi } from "../../api/authApi";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { ROLE_LABELS } from "../../utils/constants";

export function ProfileDialog({ open, onClose, user, studentProfile }) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open, reset]);

  const changePasswordMutation = useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: () => {
      toast.success("Password changed successfully.");
      reset();
      onClose();
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Unable to change password.");
    },
  });

  if (!open) {
    return null;
  }

  const identityLabel = user?.role === "student" ? studentProfile?.studentId : user?.email;
  const hostelLabel =
    typeof user?.hostelId === "object" && user?.hostelId?.name
      ? user.hostelId.name
      : user?.hostelId
        ? "Assigned"
        : "Not assigned";

  const onSubmit = handleSubmit(({ currentPassword, newPassword }) => {
    changePasswordMutation.mutate({ currentPassword, newPassword });
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 px-3 py-3 backdrop-blur-sm sm:items-center sm:px-4 sm:py-6">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-panel">
        <div className="max-h-[92vh] overflow-y-auto p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-600">Profile</p>
            <h2 className="mt-2 font-display text-xl font-bold text-ink sm:text-2xl">Account details</h2>
            <p className="mt-2 text-sm text-slate-500">
              Review your personal details and update your password securely.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Personal details</h3>
            <dl className="mt-4 space-y-4 text-sm text-slate-600">
              <div>
                <dt className="text-xs uppercase tracking-[0.2em] text-slate-400">Name</dt>
                <dd className="mt-1 text-base font-semibold text-slate-800">{user?.name || "-"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.2em] text-slate-400">Role</dt>
                <dd className="mt-1 text-base font-semibold text-slate-800">{ROLE_LABELS[user?.role] || "-"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  {user?.role === "student" ? "Student ID" : "Email"}
                </dt>
                <dd className="mt-1 text-base font-semibold text-slate-800">{identityLabel || "-"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.2em] text-slate-400">Hostel</dt>
                <dd className="mt-1 text-base font-semibold text-slate-800">{hostelLabel}</dd>
              </div>
              {user?.role === "student" ? (
                <div>
                  <dt className="text-xs uppercase tracking-[0.2em] text-slate-400">Gender</dt>
                  <dd className="mt-1 text-base font-semibold capitalize text-slate-800">
                    {studentProfile?.gender || "-"}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>

          <form onSubmit={onSubmit} className="rounded-3xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Change password</h3>
            <div className="mt-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Current password</label>
                <Input
                  type="password"
                  className="mt-2"
                  placeholder="Enter current password"
                  {...register("currentPassword", { required: "Current password is required" })}
                />
                {errors.currentPassword ? (
                  <p className="mt-2 text-xs font-medium text-rose-500">{errors.currentPassword.message}</p>
                ) : null}
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">New password</label>
                <Input
                  type="password"
                  className="mt-2"
                  placeholder="Enter new password"
                  {...register("newPassword", {
                    required: "New password is required",
                    minLength: {
                      value: 8,
                      message: "New password must be at least 8 characters",
                    },
                  })}
                />
                {errors.newPassword ? (
                  <p className="mt-2 text-xs font-medium text-rose-500">{errors.newPassword.message}</p>
                ) : null}
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Confirm new password</label>
                <Input
                  type="password"
                  className="mt-2"
                  placeholder="Re-enter new password"
                  {...register("confirmPassword", {
                    required: "Please confirm the new password",
                    validate: (value) =>
                      value === watch("newPassword") || "New password and confirmation must match",
                  })}
                />
                {errors.confirmPassword ? (
                  <p className="mt-2 text-xs font-medium text-rose-500">{errors.confirmPassword.message}</p>
                ) : null}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button type="submit" loading={changePasswordMutation.isPending}>
                Update password
              </Button>
            </div>
          </form>
        </div>
        </div>
      </div>
    </div>
  );
}
