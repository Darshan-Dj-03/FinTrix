import { useEffect, useState } from "react";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, LogOut, X } from "lucide-react";
import { NavLink } from "react-router-dom";

import logo from "../../public/Logo.png";
import { navigationByRole } from "../../utils/navigation";
import { useAuthStore } from "../../store/authStore";
import { useUiStore } from "../../store/uiStore";
import { Logo } from "./Logo";

export function Sidebar() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const mobileSidebarOpen = useUiStore((state) => state.mobileSidebarOpen);
  const desktopSidebarExpanded = useUiStore((state) => state.desktopSidebarExpanded);
  const closeMobileSidebar = useUiStore((state) => state.closeMobileSidebar);
  const toggleDesktopSidebar = useUiStore((state) => state.toggleDesktopSidebar);
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 1280 : true
  );

  const items = navigationByRole[user?.role] || [];
  const sidebarExpanded = isDesktop ? desktopSidebarExpanded : true;

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(min-width: 1280px)");
    const updateDesktopState = () => setIsDesktop(mediaQuery.matches);
    updateDesktopState();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updateDesktopState);
      return () => mediaQuery.removeEventListener("change", updateDesktopState);
    }

    mediaQuery.addListener(updateDesktopState);
    return () => mediaQuery.removeListener(updateDesktopState);
  }, []);

  return (
    <>
      <div
        className={clsx(
          "fixed inset-0 z-30 bg-slate-950/40 transition xl:hidden",
          mobileSidebarOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={closeMobileSidebar}
      />

      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-40 flex h-[100dvh] max-h-[100dvh] w-[min(18rem,calc(100vw-1.5rem))] flex-col overflow-hidden border-r border-white/60 bg-white/92 backdrop-blur transition-[transform,width] duration-300 ease-out xl:static xl:z-auto xl:flex xl:w-72",
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full xl:translate-x-0",
          desktopSidebarExpanded ? "xl:w-72" : "xl:w-24"
        )}
      >
        <div
          className={clsx(
            "relative shrink-0 flex items-center py-6",
            isDesktop
              ? sidebarExpanded
                ? "justify-between px-6"
                : "justify-center px-4"
              : "justify-between px-5"
          )}
        >
          {!isDesktop || sidebarExpanded ? (
            <div
              className={clsx(
                "overflow-hidden transition-[max-width,opacity] duration-250 ease-out",
                sidebarExpanded ? "max-w-[220px] opacity-100" : "max-w-0 opacity-0"
              )}
            >
              <Logo />
            </div>
          ) : null}
          {isDesktop && !sidebarExpanded ? (
            <div className="rounded-[1.15rem] border border-white/80 bg-white/90 p-1.5 shadow-md ring-1 ring-slate-200/70">
              <img src={logo} alt="Fintrix logo" className="h-8 w-8 rounded-[0.85rem] object-cover" />
            </div>
          ) : null}
          {isDesktop ? (
            <button
              className={clsx(
                "rounded-2xl border border-slate-200 p-2 text-slate-500 transition duration-200 hover:bg-slate-50",
                sidebarExpanded ? "static" : "absolute right-4 top-6"
              )}
              onClick={toggleDesktopSidebar}
              type="button"
              aria-label={sidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
            >
              {sidebarExpanded ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
            </button>
          ) : (
            <button
              className="rounded-2xl border border-slate-200 p-2 text-slate-500 transition duration-200 hover:bg-slate-50 xl:hidden"
              onClick={closeMobileSidebar}
              type="button"
              aria-label="Close sidebar"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <nav
          className={clsx(
            "scrollbar-hidden min-h-0 flex-1 space-y-2 overflow-x-hidden overflow-y-auto py-6",
            sidebarExpanded ? "px-4" : "px-2"
          )}
        >
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to.split("/").length === 2}
              className={({ isActive }) =>
                clsx(
                  "flex items-center rounded-2xl py-3 text-sm font-semibold transition duration-200",
                  sidebarExpanded ? "gap-3 px-4 justify-start" : "justify-center px-0",
                  isActive
                    ? "bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-lg"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )
              }
              onClick={() => {
                if (window.innerWidth < 1280) {
                  closeMobileSidebar();
                }
              }}
            >
              <item.icon size={18} />
              <span
                className={clsx(
                  "whitespace-nowrap transition-[max-width,opacity,margin] duration-250 ease-out",
                  sidebarExpanded ? "ml-0 max-w-[160px] opacity-100" : "-ml-1 max-w-0 opacity-0"
                )}
              >
                {item.label}
              </span>
            </NavLink>
          ))}
        </nav>

        <div className={clsx("shrink-0 border-t border-slate-200", sidebarExpanded ? "p-4" : "p-3")}>
          <button
            type="button"
            className={clsx(
              "flex w-full items-center rounded-2xl py-3 text-sm font-semibold text-slate-600 transition duration-200 hover:bg-slate-50 hover:text-slate-900",
              sidebarExpanded ? "gap-3 px-4 justify-start" : "justify-center px-0"
            )}
            onClick={logout}
          >
            <LogOut size={18} />
            <span
              className={clsx(
                "whitespace-nowrap transition-[max-width,opacity,margin] duration-250 ease-out",
                sidebarExpanded ? "ml-0 max-w-[120px] opacity-100" : "-ml-1 max-w-0 opacity-0"
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
