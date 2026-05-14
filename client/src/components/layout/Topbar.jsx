import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, LogOut, Menu, UserCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { notificationApi } from "../../api/notificationApi";
import { useAuthStore } from "../../store/authStore";
import { useUiStore } from "../../store/uiStore";
import { getInitials } from "../../utils/formatters";
import { ROLE_LABELS } from "../../utils/constants";
import { ProfileDialog } from "./ProfileDialog";

const formatNotificationTime = (value) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
};

export function Topbar() {
  const user = useAuthStore((state) => state.user);
  const studentProfile = useAuthStore((state) => state.studentProfile);
  const logout = useAuthStore((state) => state.logout);
  const toggleMobileSidebar = useUiStore((state) => state.toggleMobileSidebar);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationRef = useRef(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const identityLabel = user?.role === "student" ? studentProfile?.studentId : user?.email;
  const notificationsQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationApi.list({ limit: 10 }),
    refetchInterval: 30000,
  });
  const markAllReadMutation = useMutation({
    mutationFn: notificationApi.markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
  const markReadMutation = useMutation({
    mutationFn: notificationApi.markRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
  const notifications = notificationsQuery.data?.data || [];
  const unreadCount = notificationsQuery.data?.unreadCount || 0;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setIsNotificationsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const openNotification = async (notification) => {
    if (!notification?.readAt) {
      await markReadMutation.mutateAsync(notification._id);
    }

    setIsNotificationsOpen(false);
    if (notification?.link) {
      navigate(notification.link);
    }
  };

  const handleNotificationToggle = async () => {
    const nextOpenState = !isNotificationsOpen;
    setIsNotificationsOpen(nextOpenState);

    if (nextOpenState) {
      await notificationsQuery.refetch();
    }
  };

  return (
    <>
      <header className="relative z-20 flex flex-col gap-4 rounded-3xl border border-white/70 bg-white/80 px-4 py-4 shadow-panel backdrop-blur sm:px-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            className="rounded-2xl border border-slate-200 p-2 text-slate-500 xl:hidden"
            onClick={toggleMobileSidebar}
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
          <div className="relative" ref={notificationRef}>
            <button
              type="button"
              className="relative rounded-2xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"
              onClick={handleNotificationToggle}
            >
              <Bell size={18} />
              {unreadCount ? (
                <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-semibold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </button>

            {isNotificationsOpen ? (
              <div className="absolute right-0 z-[140] mt-3 w-[320px] overflow-hidden rounded-[28px] border border-white/80 bg-white/95 shadow-panel backdrop-blur">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Notifications</p>
                    <p className="text-xs text-slate-500">
                      {unreadCount ? `${unreadCount} unread` : "All caught up"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-xs font-semibold text-brand-600 transition hover:text-brand-700 disabled:text-slate-300"
                    disabled={!unreadCount || markAllReadMutation.isPending}
                    onClick={() => markAllReadMutation.mutate()}
                  >
                    Mark all read
                  </button>
                </div>

                <div className="max-h-[360px] overflow-y-auto">
                  {notificationsQuery.isLoading ? (
                    <div className="px-4 py-6 text-sm text-slate-500">Loading notifications...</div>
                  ) : notifications.length ? (
                    notifications.map((notification) => (
                      <button
                        key={notification._id}
                        type="button"
                        onClick={() => openNotification(notification)}
                        className={`block w-full border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 ${
                          notification.readAt ? "bg-white" : "bg-sky-50/50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800">{notification.title}</p>
                            <p className="mt-1 text-sm text-slate-600">{notification.message}</p>
                          </div>
                          {!notification.readAt ? (
                            <span className="mt-1 h-2.5 w-2.5 rounded-full bg-brand-500" />
                          ) : null}
                        </div>
                        <p className="mt-2 text-xs text-slate-400">{formatNotificationTime(notification.createdAt)}</p>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-6 text-sm text-slate-500">No notifications yet.</div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
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
