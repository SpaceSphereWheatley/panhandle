import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthContext.jsx";
import { api } from "../lib/api.js";

vi.mock("../lib/api.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, rawLogin: vi.fn() };
});
import { rawLogin } from "../lib/api.js";

function TestConsumer() {
  const { token, user, expiredReason, login, logout } = useAuth();
  return (
    <div>
      <div data-testid="token">{token ?? "none"}</div>
      <div data-testid="user">{user ?? "none"}</div>
      <div data-testid="expired">{expiredReason ?? "none"}</div>
      <button onClick={() => login("alice", "pw")}>login</button>
      <button onClick={() => logout("expired")}>logout</button>
    </div>
  );
}

function renderAuth() {
  return render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  );
}

describe("AuthContext", () => {
  beforeEach(() => {
    localStorage.clear();
    rawLogin.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("login() success persists to localStorage and updates context state", async () => {
    rawLogin.mockResolvedValue({
      ok: true,
      data: { token: "tok-1", user: "alice", is_admin: 1, is_owner: 0, is_superadmin: 0 },
    });

    renderAuth();
    fireEvent.click(screen.getByText("login"));

    await waitFor(() => expect(screen.getByTestId("token").textContent).toBe("tok-1"));
    expect(screen.getByTestId("user").textContent).toBe("alice");
    expect(localStorage.getItem("ph_token")).toBe("tok-1");
    expect(localStorage.getItem("ph_user")).toBe("alice");
    expect(localStorage.getItem("ph_is_admin")).toBe("1");
  });

  it("logout('expired') clears storage and sets a user-facing expiredReason", async () => {
    rawLogin.mockResolvedValue({
      ok: true,
      data: { token: "tok-1", user: "alice", is_admin: 0, is_owner: 0, is_superadmin: 0 },
    });
    renderAuth();
    fireEvent.click(screen.getByText("login"));
    await waitFor(() => expect(screen.getByTestId("token").textContent).toBe("tok-1"));

    fireEvent.click(screen.getByText("logout"));

    await waitFor(() => expect(screen.getByTestId("token").textContent).toBe("none"));
    expect(localStorage.getItem("ph_token")).toBeNull();
    expect(screen.getByTestId("expired").textContent).toMatch(/Logg inn på nytt/);
  });

  // Regression guard for the documented invariant in AuthContext.jsx: configureApi
  // is wired synchronously during render (not in a useEffect) specifically so
  // api.js never reads a stale/null token for the first request right after login.
  it("wires api()'s getToken to the freshly logged-in token with no stale window", async () => {
    rawLogin.mockResolvedValue({
      ok: true,
      data: { token: "fresh-token", user: "alice", is_admin: 0, is_owner: 0, is_superadmin: 0 },
    });
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200, ok: true, headers: { get: () => null }, json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderAuth();
    fireEvent.click(screen.getByText("login"));
    await waitFor(() => expect(screen.getByTestId("token").textContent).toBe("fresh-token"));

    await api("/list");

    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.headers.Authorization).toBe("Bearer fresh-token");
  });

  it("a failed login does not update context state", async () => {
    rawLogin.mockResolvedValue({ ok: false, data: { error: "Feil brukernavn eller passord" } });
    renderAuth();
    fireEvent.click(screen.getByText("login"));

    await waitFor(() => expect(rawLogin).toHaveBeenCalled());
    expect(screen.getByTestId("token").textContent).toBe("none");
    expect(localStorage.getItem("ph_token")).toBeNull();
  });
});
