import { Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { ProtectedRoute } from "./ProtectedRoute";
import { RoleBasedRoute } from "./RoleBasedRoute";
import { useAuthStore } from "../store/authStore";
import { renderWithProviders } from "../test/utils";

function resetAuthState(partialState) {
  useAuthStore.setState({
    token: null,
    user: null,
    studentProfile: null,
    hydrated: true,
    ...partialState,
  });
}

describe("route guards", () => {
  it("redirects unauthenticated users away from protected routes", async () => {
    resetAuthState({ token: null });

    const { findByText } = renderWithProviders(
      <Routes>
        <Route path="/login" element={<div>Login screen</div>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/admin" element={<div>Admin home</div>} />
        </Route>
      </Routes>,
      { route: "/admin" }
    );

    expect(await findByText("Login screen")).toBeInTheDocument();
  });

  it("renders protected content for authenticated users", async () => {
    resetAuthState({
      token: "token-1",
      user: { role: "admin" },
    });

    const { findByText } = renderWithProviders(
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/admin" element={<div>Admin home</div>} />
        </Route>
      </Routes>,
      { route: "/admin" }
    );

    expect(await findByText("Admin home")).toBeInTheDocument();
  });

  it("blocks users whose role is not allowed", async () => {
    resetAuthState({
      token: "token-1",
      user: { role: "student" },
    });

    const { findByText } = renderWithProviders(
      <Routes>
        <Route path="/" element={<div>Dashboard home</div>} />
        <Route element={<RoleBasedRoute allowedRoles={["admin"]} />}>
          <Route path="/admin" element={<div>Admin panel</div>} />
        </Route>
      </Routes>,
      { route: "/admin" }
    );

    expect(await findByText("Dashboard home")).toBeInTheDocument();
  });
});
