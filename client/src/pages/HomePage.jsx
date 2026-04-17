import { useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  ChevronRight,
  Clock3,
  GithubIcon,
  GraduationCap,
  Layers3,
  Linkedin,
  Menu,
  ShieldCheck,
  Sparkles,
  UserCog,
  WalletCards,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "../components/ui/Button";
import logo from "../public/Logo.png";
import { useAuthStore } from "../store/authStore";

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#workflow", label: "Workflow" },
  { href: "#team", label: "Team" },
];

const heroMetrics = [
  { value: "124", label: "Students reconciled monthly" },
  { value: "5", label: "Approval-ready report layers" },
  { value: "100%", label: "Bill transparency per student" },
];

const featureCards = [
  {
    icon: Layers3,
    title: "Hostel expense intelligence",
    copy: "Capture hostel expense, guest charges, consumption, and live splits without losing the audit trail.",
  },
  {
    icon: WalletCards,
    title: "Payment operations that stay synced",
    copy: "Collections, ledger totals, and bill states move together so caretakers never update two systems.",
  },
  {
    icon: ShieldCheck,
    title: "Approval flow with certainty",
    copy: "Reports move from caretaker to warden to dean with downloadable proof at every step.",
  },
];

const workflowSteps = [
  {
    title: "Capture",
    description: "Enter hostel expense, guest charges, and student-wise consumption for the selected month.",
  },
  {
    title: "Generate",
    description: "Build expenditure reports, mess bills per student, and auditable monthly expense snapshots.",
  },
  {
    title: "Approve",
    description: "Push reports through warden and dean approval, then reconcile the cycle through payments and ledger.",
  },
];

const roleCards = [
  {
    icon: GraduationCap,
    title: "Student workspace",
    description: "See exactly how your bill was split, track EBL status, and download month-wise PDFs.",
  },
  {
    icon: UserCog,
    title: "Caretaker control",
    description: "Run the full billing cycle from guest charges and consumption sheets to reports and payments.",
  },
  {
    icon: BarChart3,
    title: "Institution review",
    description: "Approvals, analytics, and ledger views stay visible for warden, dean, and admin users.",
  },
];

const teamMembers = [
  {
    name: "Darshan",
    role: "Backend Development",
    initials: "DA",
    linkedin: "https://www.linkedin.com/in/darshan-janganure-8ba493214/",
    github: "https://github.com/Darshan-Dj-03",
  },
  {
    name: "Pooja",
    role: "Frontend Developer",
    initials: "PO",
    linkedin: "https://www.linkedin.com/in/pooja",
    github: "https://github.com/pooja",
  },
  {
    name: "Pragnya",
    role: "Database",
    initials: "PR",
    linkedin: "https://www.linkedin.com/in/pragnya",
    github: "https://github.com/pragnya",
  },
  {
    name: "Vaishnavi",
    role: "Backend Development",
    initials: "VI",
    linkedin: "https://www.linkedin.com/in/vaishnavi",
    github: "https://github.com/vaishnavi",
  },
];

function WorkspaceLink({ className = "" }) {
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return (
      <Link to="/login" className={className}>
        <Button size="lg" className="w-full sm:w-auto">
          Sign in to workspace
        </Button>
      </Link>
    );
  }

  const path =
    user.role === "student"
      ? "/student"
      : user.role === "caretaker"
        ? "/caretaker"
        : "/admin";

  return (
    <Link to={path} className={className}>
      <Button size="lg" className="w-full sm:w-auto">
        Open workspace
      </Button>
    </Link>
  );
}

export function HomePage() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 24);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const reveals = Array.from(document.querySelectorAll(".home-reveal"));

    if (!reveals.length) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.16, rootMargin: "0px 0px -8% 0px" }
    );

    reveals.forEach((item) => observer.observe(item));

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-hero-mesh">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="hero-orbit absolute left-[4%] top-28 h-80 w-80 rounded-full bg-sky-300/25 blur-3xl" />
        <div className="hero-orbit-delayed absolute right-[6%] top-20 h-96 w-96 rounded-full bg-fuchsia-200/20 blur-3xl" />
        <div className="hero-orbit absolute bottom-12 left-[35%] h-96 w-96 rounded-full bg-cyan-200/20 blur-3xl" />
      </div>

      <header
        className={`sticky top-0 z-40 transition-all duration-300 ${
          scrolled ? "border-b border-white/70 bg-white/82 backdrop-blur-xl shadow-sm" : "bg-transparent"
        }`}
      >
        <div className="mx-auto flex max-w-[92rem] items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <img
              src={logo}
              alt="Fintrix logo"
              className="h-14 w-14 rounded-2xl border border-slate-200/80 bg-white object-cover shadow-lg"
            />
            <div className="min-w-0">
              <p className="truncate font-display text-2xl font-bold tracking-tight text-ink">Fintrix</p>
              <p className="truncate text-xs uppercase tracking-[0.26em] text-slate-400">Mess Control Center</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-xl px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-white/70 hover:text-ink"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <WorkspaceLink />
          </div>

          <button
            type="button"
            aria-label="Toggle menu"
            className="rounded-2xl border border-slate-200 bg-white p-3 text-slate-600 shadow-sm transition hover:border-brand-200 hover:text-brand-700 md:hidden"
            onClick={() => setMobileMenuOpen((value) => !value)}
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        <div
          className={`overflow-hidden border-t border-white/70 bg-white/92 backdrop-blur-xl transition-all duration-300 md:hidden ${
            mobileMenuOpen ? "max-h-80 opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 sm:px-6">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-2xl px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-ink"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-slate-200 pt-4">
              <div onClick={() => setMobileMenuOpen(false)}>
                <WorkspaceLink className="block" />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main>
        <section className="relative py-14 lg:py-20">
          <div className="mx-auto grid max-w-[92rem] gap-10 px-4 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
            <div className="home-reveal">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-white/75 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-brand-700 shadow-sm backdrop-blur">
                <Sparkles size={14} />
                Hostel mess operations platform
              </div>

              <h1 className="mt-6 max-w-3xl font-display text-4xl font-bold leading-tight tracking-tight text-ink sm:text-5xl">
                Professional monthly billing, approvals, and reconciliation in one workspace.
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
                Fintrix centralizes expense capture, consumption-based billing, approval routing, and payment tracking so
                teams can close each month with confidence and clarity.
              </p>

              <div className="home-reveal home-reveal-delay-1 mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <WorkspaceLink />
                <a
                  href="#workflow"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 transition hover:border-brand-200 hover:text-brand-700"
                >
                  Explore workflow
                  <ChevronRight size={16} />
                </a>
              </div>

              <div className="home-reveal home-reveal-delay-2 mt-10 grid gap-4 sm:grid-cols-3">
                {heroMetrics.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-white/80 bg-white/80 px-5 py-5 shadow-panel backdrop-blur"
                  >
                    <p className="font-display text-3xl font-bold text-ink">{item.value}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="home-reveal home-reveal-delay-2">
              <div className="home-preview-shell relative overflow-hidden rounded-3xl border border-white/80 bg-white/84 p-6 shadow-panel backdrop-blur">
                <div className="hero-card-shimmer absolute inset-0" />
                <div className="relative space-y-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Live workspace preview</p>
                      <h2 className="mt-2 font-display text-2xl font-bold text-ink">Built for monthly closure without stress</h2>
                    </div>
                    <img
                      src={logo}
                      alt="Fintrix logo"
                      className="h-14 w-14 rounded-2xl border border-slate-200/80 bg-white object-cover shadow-md"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="home-preview-card rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">Current cycle</span>
                        <Clock3 size={16} className="text-sky-500" />
                      </div>
                      <p className="mt-4 font-display text-3xl font-bold text-ink">Apr-2026</p>
                      <p className="mt-1 text-sm text-slate-500">72% process completion</p>
                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-sky-100">
                        <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-brand-600 via-cyan-500 to-fuchsia-500" />
                      </div>
                    </div>

                    <div className="home-preview-card home-preview-card-delay rounded-2xl border border-white/80 bg-ink p-5 text-white shadow-lg">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-200">Approval lane</p>
                      <div className="mt-4 space-y-2.5">
                        {["Caretaker ready", "Warden reviewed", "Dean approved"].map((item, index) => (
                          <div
                            key={item}
                            className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm ${
                              index === 2 ? "bg-emerald-500/15 text-emerald-100" : "bg-white/10 text-slate-200"
                            }`}
                          >
                            <span>{item}</span>
                            <ChevronRight size={15} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    {featureCards.map((card, index) => (
                      <div
                        key={card.title}
                        className={`home-preview-card rounded-2xl border border-white/75 bg-white/90 p-4 shadow-sm home-preview-card-delay-${index + 1}`}
                      >
                        <div className="inline-flex rounded-xl bg-brand-50 p-2.5 text-brand-700">
                          <card.icon size={18} />
                        </div>
                        <h3 className="mt-3 text-sm font-semibold text-ink">{card.title}</h3>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="py-10 lg:py-14">
          <div className="mx-auto max-w-[92rem] px-4 sm:px-6 lg:px-8">
            <div className="home-reveal mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-600">Why Fintrix works</p>
                <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                  Structured operations with a cleaner experience.
                </h2>
              </div>
              <p className="max-w-xl text-sm leading-7 text-slate-500 sm:text-base">
                Every workflow block is designed for operational teams that need visibility, traceability, and fewer manual
                handoffs across a monthly cycle.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {featureCards.map((card, index) => (
                <div
                  key={card.title}
                  className={`home-reveal hover-lift rounded-2xl border border-white/80 bg-white/84 p-6 shadow-panel backdrop-blur home-reveal-delay-${Math.min(index + 1, 3)}`}
                >
                  <div className="inline-flex rounded-xl bg-brand-50 p-3 text-brand-700">
                    <card.icon size={20} />
                  </div>
                  <h3 className="mt-4 text-xl font-semibold text-ink">{card.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-500">{card.copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="py-10 lg:py-14">
          <div className="mx-auto max-w-[92rem] px-4 sm:px-6 lg:px-8">
            <div className="home-reveal rounded-3xl border border-white/80 bg-white/82 p-6 shadow-panel backdrop-blur sm:p-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-600">Workflow</p>
                  <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                    One operational path from capture to approval.
                  </h2>
                </div>
                <p className="max-w-xl text-sm leading-7 text-slate-500 sm:text-base">
                  A predictable three-stage sequence helps teams stay aligned and keeps every report backed by source data.
                </p>
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                {workflowSteps.map((step, index) => (
                  <div
                    key={step.title}
                    className={`home-reveal rounded-2xl border border-slate-200 bg-slate-50/80 p-5 home-reveal-delay-${Math.min(index + 1, 3)}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink text-sm font-bold text-white">
                        {index + 1}
                      </div>
                      <h3 className="text-lg font-semibold text-ink">{step.title}</h3>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-slate-500">{step.description}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {roleCards.map((role) => (
                  <div key={role.title} className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="flex items-center justify-between">
                      <div className="inline-flex rounded-xl bg-brand-50 p-2.5 text-brand-700">
                        <role.icon size={18} />
                      </div>
                      <ArrowRight className="text-slate-300" size={16} />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-ink">{role.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-slate-500">{role.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="team" className="pb-16 pt-10 lg:pb-24 lg:pt-14">
          <div className="mx-auto max-w-[92rem] px-4 sm:px-6 lg:px-8">
            <div className="team-grid-bg home-reveal overflow-hidden rounded-3xl border border-white/80 bg-white/74 px-6 py-9 shadow-panel backdrop-blur sm:px-8 lg:px-10">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-600">Team</p>
                  <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                    Built by a team focused on dependable operations.
                  </h2>
                </div>
                <p className="max-w-xl text-sm leading-7 text-slate-500 sm:text-base">
                  Product, engineering, and workflow design come together to make monthly closure transparent and reliable.
                </p>
              </div>

              <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                {teamMembers.map((member, index) => (
                  <div
                    key={member.name}
                    className={`home-reveal team-card team-card-glow rounded-2xl border border-white/80 bg-white/90 p-5 shadow-panel backdrop-blur home-reveal-delay-${Math.min(index + 1, 4)}`}
                  >
                    <div className="team-card-highlight" />
                    <div className="flex items-center gap-4">
                      <div className="team-avatar-ring flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 via-cyan-400 to-fuchsia-500 font-display text-lg font-bold text-white shadow-md">
                        {member.initials}
                      </div>
                      <div>
                        <h3 className="font-display text-xl font-bold text-ink">{member.name}</h3>
                        <p className="inline-flex rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
                          {member.role}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Connect</p>
                      <div className="flex items-center gap-3">
                      {member.linkedin && (
                        <a
                          href={member.linkedin}
                          target="_blank"
                          rel="noreferrer"
                          className="team-social inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition"
                          aria-label={`${member.name} LinkedIn profile`}
                        >
                          <Linkedin size={18} />
                        </a>
                      )}
                      {member.github && (
                        <a
                          href={member.github}
                          target="_blank"
                          rel="noreferrer"
                          className="team-social inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition"
                          aria-label={`${member.name} GitHub profile`}
                        >
                          <GithubIcon size={18} />
                        </a>
                      )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
