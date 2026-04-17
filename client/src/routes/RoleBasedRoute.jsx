import { Navigate, Outlet } from "react-router-dom";

import { useAuthStore } from "../store/authStore";

export function RoleBasedRoute({ allowedRoles = [] }) {
  const user = useAuthStore((state) => state.user);

  if (!allowedRoles.includes(user?.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
