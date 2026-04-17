import { ArrowLeft, ShieldCheck, Sparkles, WalletCards } from "lucide-react";
import { Link } from "react-router-dom";

import { LoginForm } from "../features/auth/LoginForm";
import logo from "../public/Logo.png";

export function LoginPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-hero-mesh px-4 py-8 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="hero-orbit absolute -left-16 top-20 h-72 w-72 rounded-full bg-sky-300/20 blur-3xl" />
        <div className="hero-orbit-delayed absolute right-0 top-10 h-80 w-80 rounded-full bg-fuchsia-200/20 blur-3xl" />
        <div className="hero-orbit absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-cyan-200/20 blur-3xl" />
      </div>

      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-[92rem] items-center gap-8 lg:grid-cols-[1.04fr_0.96fr]">
        <div className="absolute left-4 top-4 z-20 sm:left-6 sm:top-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/80 bg-white/85 px-4 py-2 text-sm font-medium text-slate-600 shadow-sm backdrop-blur transition hover:border-brand-200 hover:text-brand-700"
          >
            <ArrowLeft size={16} />
            Back to home
          </Link>
        </div>

        <div className="home-reveal is-visible hidden lg:block">
          <div className="mb-7 flex items-center gap-4">
            <img
              src={logo}
              alt="Fintrix logo"
              className="h-16 w-16 rounded-[1.4rem] border border-white/80 bg-white p-1.5 object-cover shadow-lg ring-1 ring-slate-200/70"
            />
            <div>
              <p className="font-display text-2xl font-bold tracking-tight text-ink">Fintrix</p>
              <p className="text-xs uppercase tracking-[0.26em] text-slate-400">Mess Control Center</p>
            </div>
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-brand-600">Fintrix platform</p>
          <h1 className="mt-4 max-w-xl font-display text-5xl font-bold leading-tight tracking-tight text-ink">
            Sign in to a calmer, more reliable monthly operations workflow.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-slate-600 xl:text-lg">
            Fintrix unifies billing, payment reconciliation, approvals, and reporting into one role-aware workspace for
            students and institutional teams.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              { icon: WalletCards, title: "Payments", text: "Track collections with auditable, consistent records." },
              { icon: ShieldCheck, title: "Approvals", text: "Keep report movement structured across each role." },
              { icon: Sparkles, title: "Insights", text: "Review dues, expenses, and ledger health in one place." },
            ].map((item) => (
              <div key={item.title} className="home-reveal is-visible home-reveal-delay-2 panel p-5">
                <item.icon className="text-brand-600" size={22} />
                <h3 className="mt-4 text-lg font-bold text-ink">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-500">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="home-reveal is-visible home-reveal-delay-1 relative mx-auto w-full max-w-lg">
          <div className="absolute inset-0 -z-10 rounded-[2rem] bg-gradient-to-br from-sky-300/20 via-transparent to-fuchsia-300/20 blur-xl" />
          <div className="panel rounded-[2rem] p-7 sm:p-8">
            <div className="mb-6 flex items-center gap-3 lg:hidden">
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

            <p className="text-xs font-bold uppercase tracking-[0.26em] text-brand-600">Secure sign in</p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink">Welcome back</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
            Staff sign in with email. Students sign in with their student ID.
            </p>
            <div className="mt-8">
              <LoginForm />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
