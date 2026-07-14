// Same-origin: the Worker handles /api/* on shopping.mohibb.com.
// Ported from public/app.html's `api()` wrapper — auth state itself lives in
// AuthContext; this module is wired to it via configureApi() so it stays a
// plain fetch helper with no React dependency.
const API_BASE = "/api";

let getToken = () => null;
let onRefresh = () => {};
let onUnauthorized = () => {};

export function configureApi({ getToken: g, onRefresh: r, onUnauthorized: u }) {
  getToken = g;
  onRefresh = r;
  onUnauthorized = u;
}

export async function api(path, opts = {}) {
  let res;
  try {
    res = await fetch(API_BASE + path, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + getToken(),
        ...(opts.headers || {}),
      },
    });
  } catch {
    throw new Error("network");
  }
  if (res.status === 401) {
    onUnauthorized();
    throw new Error("unauth");
  }
  // Sliding expiry: if the Worker handed back a refreshed token, store it.
  // Skipped for /change-password: that response's body carries the
  // authoritative new-version token, and the header token is the now-invalid
  // old version.
  const refreshed = res.headers.get("X-Refresh-Token");
  if (refreshed && refreshed !== getToken() && path !== "/change-password") {
    onRefresh(refreshed);
  }
  return res.json();
}

export async function rawLogin(username, password) {
  const res = await fetch(API_BASE + "/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  return { ok: res.ok, data };
}

// Unauthenticated POST helper shared by the public signup/recovery
// endpoints below — no token exists yet for any of these calls.
async function rawPost(path, body) {
  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { ok: res.ok, data };
}

export function rawRegister(fields) {
  return rawPost("/register", fields);
}

export function rawGoogleAuth(credential, listName) {
  return rawPost("/auth/google", { credential, list_name: listName });
}

export function rawForgotPassword(email, turnstileToken) {
  return rawPost("/forgot-password", { email, turnstile_token: turnstileToken });
}

export function rawResetPassword(token, newPassword) {
  return rawPost("/reset-password", { token, new_password: newPassword });
}
