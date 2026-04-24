import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Eye, EyeOff } from "lucide-react";

import { authApi } from "../../api/authApi";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

export function ForgotPasswordForm({ onBackToSignIn }) {
  const [email, setEmail] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      email: "",
      otp: "",
      newPassword: "",
      confirmPassword: "",
    },
  });
  const newPasswordValue = watch("newPassword");
  const confirmPasswordValue = watch("confirmPassword");
  const hasPasswordConfirmation = Boolean(newPasswordValue || confirmPasswordValue);
  const passwordMatch =
    hasPasswordConfirmation && newPasswordValue && confirmPasswordValue && newPasswordValue === confirmPasswordValue;
  const passwordMismatch =
    hasPasswordConfirmation && newPasswordValue && confirmPasswordValue && newPasswordValue !== confirmPasswordValue;

  const requestOtpMutation = useMutation({
    mutationFn: (payload) => authApi.requestPasswordResetOtp(payload),
    onSuccess: (_, variables) => {
      setEmail(variables.email);
      setOtpRequested(true);
      toast.success("If the account is approved, an OTP has been emailed.");
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Unable to send OTP."),
  });

  const resetMutation = useMutation({
    mutationFn: (payload) => authApi.resetPasswordWithOtp(payload),
    onSuccess: () => {
      setOtpRequested(false);
      setEmail("");
      reset({
        email: "",
        otp: "",
        newPassword: "",
        confirmPassword: "",
      });
      toast.success("Password reset successfully.");
      onBackToSignIn?.();
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Unable to reset password."),
  });

  return (
    <form
      className="space-y-5"
      onSubmit={handleSubmit((values) => {
        if (!otpRequested) {
          requestOtpMutation.mutate({ email: values.email });
          return;
        }

        if (values.newPassword !== values.confirmPassword) {
          toast.error("Passwords do not match.");
          return;
        }

        resetMutation.mutate({
          email: email || values.email,
          otp: values.otp,
          newPassword: values.newPassword,
        });
      })}
    >
      <div>
        <label className="field-label">Approved Account Email</label>
        <Input
          type="email"
          readOnly={otpRequested}
          {...register("email", { required: "Email is required" })}
          placeholder="Enter your approved account email"
        />
        {errors.email ? <p className="mt-2 text-sm text-rose-500">{errors.email.message}</p> : null}
      </div>

      {otpRequested ? (
        <>
          <div>
            <label className="field-label">OTP</label>
            <Input {...register("otp", { required: "OTP is required" })} placeholder="Enter the 6-digit OTP" />
            {errors.otp ? <p className="mt-2 text-sm text-rose-500">{errors.otp.message}</p> : null}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="field-label">New Password</label>
              <div className="relative">
                <Input
                  type={showNewPassword ? "text" : "password"}
                  className="pr-16"
                  {...register("newPassword", { required: "New password is required" })}
                  placeholder="Enter a new password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 text-xs font-semibold text-slate-500 transition hover:text-slate-700"
                  onClick={() => setShowNewPassword((current) => !current)}
                >
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  {showNewPassword ? "Hide" : "Show"}
                </button>
              </div>
              {errors.newPassword ? <p className="mt-2 text-sm text-rose-500">{errors.newPassword.message}</p> : null}
            </div>
            <div>
              <label className="field-label">Confirm New Password</label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  className="pr-16"
                  {...register("confirmPassword", { required: "Please confirm the new password" })}
                  placeholder="Re-enter the new password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 text-xs font-semibold text-slate-500 transition hover:text-slate-700"
                  onClick={() => setShowConfirmPassword((current) => !current)}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>
              </div>
              {errors.confirmPassword ? <p className="mt-2 text-sm text-rose-500">{errors.confirmPassword.message}</p> : null}
              {passwordMatch ? <p className="mt-2 text-sm text-emerald-600">Passwords match.</p> : null}
              {passwordMismatch ? <p className="mt-2 text-sm text-rose-500">Passwords do not match.</p> : null}
            </div>
          </div>
        </>
      ) : null}

      <div>
        <Button className="w-full" size="lg" loading={requestOtpMutation.isPending || resetMutation.isPending} type="submit">
          {otpRequested ? "Reset password" : "Send OTP"}
        </Button>
      </div>

      <div className="text-center text-sm">
        <button
          type="button"
          className="font-medium text-slate-500 transition hover:text-slate-700"
          onClick={onBackToSignIn}
        >
          Back to sign in
        </button>
      </div>
    </form>
  );
}
