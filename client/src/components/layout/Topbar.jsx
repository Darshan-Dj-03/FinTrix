import { useState } from "react";
import { Bell, LogOut, Menu, UserCircle2 } from "lucide-react";

import { useAuthStore } from "../../store/authStore";
import { useUiStore } from "../../store/uiStore";
import { getInitials } from "../../utils/formatters";
import { ROLE_LABELS } from "../../utils/constants";
import { ProfileDialog } from "./ProfileDialog";

export function Topbar() {
  const user = useAuthStore((state) => state.user);
  const studentProfile = useAuthStore((state) => state.studentProfile);
  const logout = useAuthStore((state) => state.logout);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const identityLabel = user?.role === "student" ? studentProfile?.studentId : user?.email;

  return (
    <>
      <header className="flex flex-col gap-4 rounded-3xl border border-white/70 bg-white/80 px-4 py-4 shadow-panel backdrop-blur sm:px-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            className="rounded-2xl border border-slate-200 p-2 text-slate-500 xl:hidden"
            onClick={toggleSidebar}
          >
            <Menu size={18} />
          </button>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">workspace</p>
            <p className="mt-1 text-sm font-semibold text-slate-700">
              {ROLE_LABELS[user?.role] || "User"} dashboard
            </p>
          </div>
        </div>

        <div className="flex items-start justify-between gap-3 sm:items-center lg:justify-end">
          <button className="rounded-2xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50">
            <Bell size={18} />
          </button>
          <div className="flex min-w-0 flex-1 items-start gap-3 rounded-[26px] bg-slate-50 px-3 py-3 sm:flex-none">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ink font-semibold text-white">
              {getInitials(user?.name)}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-semibold text-slate-800">{user?.name}</p>
              <p className="truncate text-xs text-slate-500">{identityLabel || "-"}</p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsProfileOpen(true)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 sm:w-auto"
                >
                  <UserCircle2 size={14} />
                  Profile
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 sm:w-auto"
                >
                  <LogOut size={14} />
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <ProfileDialog
        open={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={user}
        studentProfile={studentProfile}
      />
    </>
  );
}
