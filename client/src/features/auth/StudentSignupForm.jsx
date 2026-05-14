import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Eye, EyeOff } from "lucide-react";

import { authApi } from "../../api/authApi";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";

export function StudentSignupForm({ onBackToSignIn }) {
  const [signupResult, setSignupResult] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const {
    register,
    watch,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: "",
      email: "",
      gender: "",
      studentIdMode: "manual",
      studentId: "",
      password: "",
      confirmPassword: "",
    },
  });

  const studentIdMode = watch("studentIdMode");
  const passwordValue = watch("password");
  const confirmPasswordValue = watch("confirmPassword");
  const hasPasswordConfirmation = Boolean(passwordValue || confirmPasswordValue);
  const passwordMatch =
    hasPasswordConfirmation && passwordValue && confirmPasswordValue && passwordValue === confirmPasswordValue;
  const passwordMismatch =
    hasPasswordConfirmation && passwordValue && confirmPasswordValue && passwordValue !== confirmPasswordValue;

  const mutation = useMutation({
    mutationFn: (values) =>
      authApi.signupStudent({
        name: values.name,
        email: values.email,
        gender: values.gender,
        studentIdMode: values.studentIdMode,
        studentId: values.studentId,
        password: values.password,
      }),
    onSuccess: (response) => {
      setSignupResult(response.data);
      toast.success("Signup request submitted.");
      reset({
        name: "",
        email: "",
        gender: "",
        studentIdMode: "manual",
        studentId: "",
        password: "",
        confirmPassword: "",
      });
    },
    onError: (error) => {
      const timedOut = error?.code === "ECONNABORTED" || /timeout/i.test(String(error?.message || ""));
      toast.error(
        timedOut
          ? "The server took too long to respond. Please try again in a few seconds."
          : error?.response?.data?.message || "Unable to submit signup request."
      );
    },
  });

  const handleCopyStudentId = async () => {
    if (!signupResult?.studentId) return;

    try {
      await navigator.clipboard.writeText(signupResult.studentId);
      toast.success("Student ID copied.");
    } catch {
      toast.error("Unable to copy student ID.");
    }
  };

  return (
    <div className="space-y-5">
      {signupResult?.studentId ? (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-5 text-sm text-emerald-900">
          <p className="font-semibold">Signup request submitted successfully.</p>
          <p className="mt-2 leading-6">
            Your student ID is <span className="font-mono font-semibold">{signupResult.studentId}</span>.
          </p>
          <p className="mt-1 text-emerald-800">
            The request will move to caretaker review first, then admin approval before access is enabled.
          </p>
          <div className="mt-4">
            <Button type="button" variant="secondary" size="sm" onClick={handleCopyStudentId}>
              Copy ID
            </Button>
          </div>
        </div>
      ) : null}

      <form className="space-y-7" onSubmit={handleSubmit((values) => {
        if (values.password !== values.confirmPassword) {
          toast.error("Passwords do not match.");
          return;
        }

        mutation.mutate(values);
      })}>
        <div className="space-y-5">
          <div>
            <label className="field-label">Full Name</label>
            <Input {...register("name", { required: "Name is required" })} placeholder="Enter your full name" />
            {errors.name ? <p className="mt-2 text-sm text-rose-500">{errors.name.message}</p> : null}
          </div>

          <div>
            <label className="field-label">Email</label>
            <Input type="email" {...register("email", { required: "Email is required" })} placeholder="name@example.com" />
            {errors.email ? <p className="mt-2 text-sm text-rose-500">{errors.email.message}</p> : null}
          </div>

          <div>
            <label className="field-label">Gender</label>
            <Select {...register("gender", { required: "Gender is required" })}>
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </Select>
            {errors.gender ? <p className="mt-2 text-sm text-rose-500">{errors.gender.message}</p> : null}
          </div>

          <div>
            <label className="field-label">Student ID Option</label>
            <Select {...register("studentIdMode")}>
              <option value="temporary">Generate temporary ID</option>
              <option value="manual">I already have an ID</option>
            </Select>
          </div>

          {studentIdMode === "manual" ? (
            <div>
              <label className="field-label">Student ID</label>
              <Input
                {...register("studentId", { required: "Student ID is required when manual mode is selected" })}
                placeholder="Enter your student ID"
              />
              {errors.studentId ? <p className="mt-2 text-sm text-rose-500">{errors.studentId.message}</p> : null}
            </div>
          ) : (
            <div className="rounded-[1.6rem] border border-dashed border-slate-300 bg-slate-50 px-5 py-5 text-sm leading-7 text-slate-600">
              A temporary student ID will be generated after submission, and you can copy it immediately.
            </div>
          )}

          <div>
            <label className="field-label">Password</label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                className="pr-16"
                {...register("password", { required: "Password is required" })}
                placeholder="Create a password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 text-xs font-semibold text-slate-500 transition hover:text-slate-700"
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {errors.password ? <p className="mt-2 text-sm text-rose-500">{errors.password.message}</p> : null}
          </div>

          <div>
            <label className="field-label">Confirm Password</label>
            <div className="relative">
              <Input
                type={showConfirmPassword ? "text" : "password"}
                className="pr-16"
                {...register("confirmPassword", { required: "Please confirm your password" })}
                placeholder="Re-enter your password"
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

        <Button className="w-full rounded-[1.35rem] shadow-[0_16px_30px_rgba(15,23,42,0.12)]" size="lg" loading={mutation.isPending} type="submit">
          Submit signup request
        </Button>

        <div className="pt-1 text-center text-sm">
          <button
            type="button"
            className="font-medium text-slate-500 transition hover:text-slate-700"
            onClick={onBackToSignIn}
          >
            Back to sign in
          </button>
        </div>
      </form>
    </div>
  );
}
