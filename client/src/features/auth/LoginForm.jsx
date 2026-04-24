import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { authApi } from "../../api/authApi";
import { useAuthStore } from "../../store/authStore";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

export function LoginForm({ onForgotPassword, onStudentSignup }) {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((state) => state.setSession);
  const [loginError, setLoginError] = useState("");
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      identifier: "",
      password: "",
    },
  });

  const mutation = useMutation({
    mutationFn: (values) =>
      authApi.login({
        username: values.identifier,
        password: values.password,
      }),
    onSuccess: async (response) => {
      setLoginError("");
      setSession({
        token: response.token,
        refreshToken: response.refreshToken,
        user: response.user,
        studentProfile: response.studentProfile ?? null,
      });

      try {
        const me = await authApi.getMe();
        setSession({
          token: response.token,
          refreshToken: response.refreshToken,
          user: me.data.user,
          studentProfile: me.data.studentProfile,
        });
      } catch {
        setSession({
          token: response.token,
          refreshToken: response.refreshToken,
          user: response.user,
          studentProfile: response.studentProfile ?? null,
        });
      }

      toast.success("Welcome back to Fintrix.");
      navigate(location.state?.from?.pathname || "/workspace", { replace: true });
    },
    onError: (error) => {
      const message = error?.response?.data?.message || "Unable to sign in.";
      setLoginError(message);
      toast.error(message);
    },
  });

  return (
    <form className="space-y-6" onSubmit={handleSubmit((values) => {
      setLoginError("");
      mutation.mutate(values);
    })}>
      <div>
        <label className="field-label">Email or Student ID</label>
        <Input
          placeholder="Use email for staff or student ID for students"
          {...register("identifier", { required: "Email or student ID is required" })}
        />
        {errors.identifier ? <p className="mt-2 text-sm text-rose-500">{errors.identifier.message}</p> : null}
      </div>

      <div>
        <label className="field-label">Password</label>
        <Input
          type="password"
          placeholder="Enter your password"
          {...register("password", { required: "Password is required" })}
        />
        {errors.password ? <p className="mt-2 text-sm text-rose-500">{errors.password.message}</p> : null}
      </div>

      <Button className="w-full rounded-[1.35rem] shadow-[0_16px_30px_rgba(15,23,42,0.12)]" size="lg" loading={mutation.isPending} type="submit">
        Sign in
      </Button>

      {loginError ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p>{loginError}</p>
          {loginError.toLowerCase().includes("sign up") || loginError.toLowerCase().includes("account not found") ? (
            <button
              type="button"
              className="mt-2 inline-flex items-center font-semibold text-brand-700 transition hover:text-brand-800"
              onClick={onStudentSignup}
            >
              Open student signup
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center justify-start gap-3 pt-1 text-sm">
        <button
          type="button"
          className="font-medium text-brand-700 transition hover:text-brand-800"
          onClick={onForgotPassword}
        >
          Forgot password?
        </button>
      </div>
    </form>
  );
}
