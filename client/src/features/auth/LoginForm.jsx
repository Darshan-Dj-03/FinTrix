import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { authApi } from "../../api/authApi";
import { useAuthStore } from "../../store/authStore";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

export function LoginForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((state) => state.setSession);
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
      setSession({ token: response.token, user: response.user, studentProfile: null });

      try {
        const me = await authApi.getMe();
        setSession({
          token: response.token,
          user: me.data.user,
          studentProfile: me.data.studentProfile,
        });
      } catch {
        setSession({ token: response.token, user: response.user, studentProfile: null });
      }

      toast.success("Welcome back to Fintrix.");
      navigate(location.state?.from?.pathname || "/workspace", { replace: true });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Unable to sign in.");
    },
  });

  return (
    <form className="space-y-5" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
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

      <Button className="w-full" size="lg" loading={mutation.isPending} type="submit">
        Sign in
      </Button>
    </form>
  );
}
