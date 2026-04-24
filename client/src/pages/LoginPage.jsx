import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

import { ForgotPasswordForm } from "../features/auth/ForgotPasswordForm";
import { LoginForm } from "../features/auth/LoginForm";
import { StudentSignupForm } from "../features/auth/StudentSignupForm";
import logo from "../public/Logo.png";
export function LoginPage() {
  const [mode, setMode] = useState("login");
  const [transitionState, setTransitionState] = useState({ phase: "idle", direction: "signup" });
  const transitionTimersRef = useRef([]);

  useEffect(() => () => {
    transitionTimersRef.current.forEach(clearTimeout);
    transitionTimersRef.current = [];
  }, []);

  const handleModeChange = (nextMode) => {
    if (nextMode === mode || transitionState.phase !== "idle") return;

    const direction = nextMode === "signup" ? "signup" : "login";
    setTransitionState({ phase: "exit", direction });

    const swapTimer = setTimeout(() => {
      setMode(nextMode);
      setTransitionState({ phase: "enter", direction });

      const settleTimer = setTimeout(() => {
        setTransitionState({ phase: "idle", direction });
      }, 340);

      transitionTimersRef.current.push(settleTimer);
    }, 240);

    transitionTimersRef.current.push(swapTimer);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-hero-mesh px-4 py-8 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="hero-orbit absolute -left-16 top-20 h-72 w-72 rounded-full bg-sky-300/20 blur-3xl" />
        <div className="hero-orbit-delayed absolute right-0 top-10 h-80 w-80 rounded-full bg-fuchsia-200/20 blur-3xl" />
        <div className="hero-orbit absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-cyan-200/20 blur-3xl" />
      </div>

      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-[92rem] items-center justify-center">
        <div className="absolute left-4 top-4 z-20 sm:left-6 sm:top-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/80 bg-white/85 px-4 py-2 text-sm font-medium text-slate-600 shadow-sm backdrop-blur transition hover:border-brand-200 hover:text-brand-700"
          >
            <ArrowLeft size={16} />
            Back to home
          </Link>
        </div>

        <div className="home-reveal is-visible home-reveal-delay-1 relative mx-auto w-full max-w-[44rem] xl:max-w-[48rem]">
          <div className="absolute inset-0 -z-10 rounded-[2.5rem] bg-gradient-to-br from-amber-200/35 via-transparent to-rose-200/30 blur-2xl" />
          <div className="auth-shell auth-stage rounded-[2.5rem] border border-white/75 p-5 shadow-[0_28px_80px_rgba(15,23,42,0.12)] sm:p-6">
            <div className="mb-6 flex items-center gap-3">
              <img
                src={logo}
                alt="Fintrix logo"
                className="h-12 w-12 rounded-xl border border-white/80 bg-white p-1 object-cover shadow-md ring-1 ring-slate-200/70"
              />
              <div>
                <p className="font-display text-lg font-bold tracking-tight text-ink">Fintrix</p>
                <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Mess Control Center</p>
              </div>
            </div>

            {mode === "forgot" ? (
              <>
                <p className="text-xs font-bold uppercase tracking-[0.26em] text-brand-600">Secure sign in</p>
                <h2 className="mt-3 font-display text-4xl font-bold tracking-tight text-ink sm:text-[2.8rem]">Forgot password</h2>
                <p className="mt-3 max-w-xl text-base leading-7 text-slate-500">
                  Use your approved account email to receive a password reset OTP.
                </p>
                <div className="mt-5 inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  OTP Password Recovery
                </div>
                <div className="mt-10">
                  <div key="forgot" className="auth-mode-panel">
                    <ForgotPasswordForm onBackToSignIn={() => setMode("login")} />
                  </div>
                </div>
              </>
            ) : (
              <div className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/95 shadow-[0_22px_54px_rgba(15,23,42,0.08)]">
                <div className="grid lg:grid-cols-[1.18fr_0.82fr]">
                  <div
                    className={`auth-switch-panel ${mode === "signup" ? "auth-switch-panel-signup" : "auth-switch-panel-login"} auth-stage-panel auth-stage-panel-${transitionState.phase} auth-stage-panel-${transitionState.direction} p-8 sm:p-10 lg:p-12`}
                  >
                    <div
                      key={mode}
                      className={`auth-mode-panel ${mode === "signup" ? "auth-mode-panel-left" : "auth-mode-panel-right"}`}
                    >
                      <p className="text-xs font-bold uppercase tracking-[0.26em] text-brand-600">Secure sign in</p>
                      <h2 className="mt-4 font-display text-4xl font-bold tracking-tight text-ink sm:text-[3.15rem]">
                        {mode === "signup" ? "Sign up" : "Welcome back"}
                      </h2>
                      <p className="mt-4 max-w-xl text-base leading-8 text-slate-500">
                        {mode === "signup"
                          ? "Submit your signup request here. Your account will become active after caretaker and admin approval."
                          : "Staff sign in with email. Students sign in with their student ID."}
                      </p>
                      <div className="mt-10">
                        {mode === "signup" ? (
                          <StudentSignupForm onBackToSignIn={() => setMode("login")} />
                        ) : (
                          <LoginForm
                            onForgotPassword={() => setMode("forgot")}
                            onStudentSignup={() => setMode("signup")}
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`auth-pane auth-panel-grid auth-side-panel ${mode === "signup" ? "auth-side-panel-signup" : "auth-side-panel-login"} auth-stage-panel auth-stage-panel-${transitionState.phase} auth-stage-panel-${transitionState.direction} flex min-h-[24rem] flex-col justify-between px-8 py-10 text-white sm:px-10 sm:py-12`}
                  >
                    <div className="relative z-10">
                      <div className="auth-cta-chip inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/80">
                        {mode === "signup" ? "Account access" : "Student onboarding"}
                      </div>
                    </div>

                    <div key={`side-${mode}`} className={`auth-mode-panel ${mode === "signup" ? "auth-mode-panel-right" : "auth-mode-panel-left"} relative z-10 max-w-sm`}>
                      <p className="text-xs font-semibold uppercase tracking-[0.26em] text-white/65">
                        {mode === "signup" ? "Already registered?" : "Need an account?"}
                      </p>
                      <h3 className="mt-5 font-display text-4xl font-bold leading-[1.05] sm:text-[3rem]">
                        {mode === "signup" ? "Sign in to your account" : "Create your student account"}
                      </h3>
                      <p className="mt-5 text-base leading-8 text-white/78">
                        {mode === "signup"
                          ? "Use your approved email or student ID and password to access your dashboard."
                          : "If you are a new student, submit your signup request here and continue after approval."}
                      </p>
                    </div>

                    <div className="relative z-10 mt-10">
                      <button
                        type="button"
                        className="h-12 rounded-full border border-white/35 bg-white/10 px-7 text-base font-semibold text-white shadow-[0_16px_28px_rgba(15,23,42,0.18)] transition duration-300 hover:-translate-y-0.5 hover:bg-white/18"
                        onClick={() => handleModeChange(mode === "signup" ? "login" : "signup")}
                      >
                        {mode === "signup" ? "Sign in" : "Sign up"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
