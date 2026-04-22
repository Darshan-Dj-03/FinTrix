import clsx from "clsx";
import { ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { NavLink } from "react-router-dom";

import logo from "../../public/Logo.png";
import { navigationByRole } from "../../utils/navigation";
import { useAuthStore } from "../../store/authStore";
import { useUiStore } from "../../store/uiStore";
import { Logo } from "./Logo";

export function Sidebar() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  const items = navigationByRole[user?.role] || [];

  return (
    <>
      <div
        className={clsx(
          "fixed inset-0 z-30 bg-slate-950/40 transition xl:hidden",
          sidebarOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={toggleSidebar}
      />

      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-40 flex h-[100dvh] max-h-[100dvh] w-[min(18rem,calc(100vw-1.5rem))] flex-col overflow-hidden border-r border-white/60 bg-white/92 backdrop-blur transition-[transform,width] duration-300 ease-out xl:static xl:z-auto xl:flex xl:w-72",
          sidebarOpen ? "translate-x-0" : "-translate-x-full xl:translate-x-0",
          sidebarOpen ? "xl:w-72" : "xl:w-24"
        )}
      >
        <div className="shrink-0 flex items-center justify-between px-6 py-6">
          <div
            className={clsx(
              "overflow-hidden transition-[max-width,opacity] duration-250 ease-out",
              sidebarOpen ? "max-w-[220px] opacity-100" : "max-w-0 opacity-0"
            )}
          >
            <Logo />
          </div>
          {!sidebarOpen ? (
            <div className="rounded-[1.15rem] border border-white/80 bg-white/90 p-1.5 shadow-md ring-1 ring-slate-200/70">
              <img src={logo} alt="Fintrix logo" className="h-8 w-8 rounded-[0.85rem] object-cover" />
            </div>
          ) : null}
          <button
            className="rounded-2xl border border-slate-200 p-2 text-slate-500 transition duration-200 hover:bg-slate-50"
            onClick={toggleSidebar}
            type="button"
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>
        </div>

        <nav className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-6">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to.split("/").length === 2}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition duration-200",
                  isActive
                    ? "bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-lg"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )
              }
              onClick={() => {
                if (window.innerWidth < 1280) {
                  toggleSidebar();
                }
              }}
            >
              <item.icon size={18} />
              <span
                className={clsx(
                  "whitespace-nowrap transition-[max-width,opacity,margin] duration-250 ease-out",
                  sidebarOpen ? "ml-0 max-w-[160px] opacity-100" : "-ml-1 max-w-0 opacity-0"
                )}
              >
                {item.label}
              </span>
            </NavLink>
          ))}
        </nav>

        <div className="shrink-0 border-t border-slate-200 p-4">
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-600 transition duration-200 hover:bg-slate-50 hover:text-slate-900"
            onClick={logout}
          >
            <LogOut size={18} />
            <span
              className={clsx(
                "whitespace-nowrap transition-[max-width,opacity,margin] duration-250 ease-out",
                sidebarOpen ? "ml-0 max-w-[120px] opacity-100" : "-ml-1 max-w-0 opacity-0"
              )}
            >
              Logout
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}
