import { beforeEach, describe, expect, it } from "vitest";

import { useAuthStore } from "./authStore";

function resetStore() {
  useAuthStore.setState({
    token: null,
    refreshToken: null,
    user: null,
    studentProfile: null,
    hydrated: false,
  });
}

describe("authStore", () => {
  beforeEach(() => {
    resetStore();
  });

  it("persists the user session to localStorage", () => {
    useAuthStore.getState().setSession({
      token: "jwt-token",
      refreshToken: "refresh-token",
      user: { _id: "user-1", role: "caretaker", name: "Caretaker" },
      studentProfile: null,
    });

    expect(useAuthStore.getState().token).toBe("jwt-token");

    const persisted = JSON.parse(localStorage.getItem("fintrix-auth"));
    expect(persisted).toMatchObject({
      token: "jwt-token",
      refreshToken: "refresh-token",
      user: { role: "caretaker" },
    });
  });

  it("clears all auth state on logout", () => {
    useAuthStore.getState().setSession({
      token: "jwt-token",
      refreshToken: "refresh-token",
      user: { _id: "user-1", role: "student" },
      studentProfile: { _id: "student-1" },
    });

    useAuthStore.getState().logout();

    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().refreshToken).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().studentProfile).toBeNull();
    expect(localStorage.getItem("fintrix-auth")).toBeNull();
  });
});
