import { createContext, useContext, useRef, useState } from "react";
import { configureApi, rawLogin, rawRegister, rawGoogleAuth } from "../lib/api.js";
import { clearCache } from "../lib/localCache.js";

const AuthContext = createContext(null);

function readStoredAuth() {
  return {
    token: localStorage.getItem("ph_token"),
    user: localStorage.getItem("ph_user"),
    name: localStorage.getItem("ph_name"),
    isAdmin: localStorage.getItem("ph_is_admin") === "1",
    isOwner: localStorage.getItem("ph_is_owner") === "1",
    isSuperAdmin: localStorage.getItem("ph_is_superadmin") === "1",
  };
}

function persistAuth(auth) {
  if (auth.token == null) {
    localStorage.removeItem("ph_token");
    localStorage.removeItem("ph_user");
    localStorage.removeItem("ph_name");
    localStorage.removeItem("ph_is_admin");
    localStorage.removeItem("ph_is_owner");
    localStorage.removeItem("ph_is_superadmin");
    return;
  }
  localStorage.setItem("ph_token", auth.token);
  localStorage.setItem("ph_user", auth.user);
  localStorage.setItem("ph_name", auth.name || auth.user);
  localStorage.setItem("ph_is_admin", auth.isAdmin ? "1" : "0");
  localStorage.setItem("ph_is_owner", auth.isOwner ? "1" : "0");
  localStorage.setItem("ph_is_superadmin", auth.isSuperAdmin ? "1" : "0");
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(readStoredAuth);
  const [expiredReason, setExpiredReason] = useState(null);
  // api.js needs the *current* token/logout without re-subscribing on every
  // change, so it reads through a ref rather than a stale closure.
  const authRef = useRef(auth);
  authRef.current = auth;

  function logout(reason) {
    const cleared = { token: null, user: null, name: null, isAdmin: false, isOwner: false, isSuperAdmin: false };
    authRef.current = cleared;
    setAuth(cleared);
    persistAuth(cleared);
    clearCache();
    if (reason === "expired") {
      setExpiredReason(
        "Økten utløp eller passordet ble endret på en annen enhet. Logg inn på nytt."
      );
    }
  }

  // Wired synchronously during render, not in a useEffect: child providers
  // (e.g. ListUsersProvider) fire their own mount-effect API calls, and React
  // runs child effects before parent effects. An effect here would leave
  // api.js's getToken pointed at its module-level default (() => null) for
  // that first wave of requests, turning every fresh mount into a bogus 401
  // that logs the still-valid session out.
  configureApi({
    getToken: () => authRef.current.token,
    onRefresh: (token) => {
      const next = { ...authRef.current, token };
      authRef.current = next;
      setAuth(next);
      localStorage.setItem("ph_token", token);
    },
    onUnauthorized: () => logout("expired"),
  });

  // Shared by every path that ends with "the server handed back a fresh
  // login-shaped response" (login, register, Google sign-in, reset-password's
  // auto-login) so each doesn't re-derive/store the auth shape separately.
  function completeAuth(data) {
    const next = {
      token: data.token,
      user: data.user,
      name: data.name || data.user,
      isAdmin: !!data.is_admin,
      isOwner: !!data.is_owner,
      isSuperAdmin: !!data.is_superadmin,
    };
    authRef.current = next;
    setAuth(next);
    persistAuth(next);
  }

  // Merges a partial identity update (token/user/name) into the current
  // session without a full re-login — used after /change-email (username
  // changes, since it always mirrors the e-mail) and /change-name.
  function updateIdentity(patch) {
    const next = { ...authRef.current, ...patch };
    authRef.current = next;
    setAuth(next);
    persistAuth(next);
  }

  async function login(username, password) {
    setExpiredReason(null);
    const { ok, data } = await rawLogin(username, password);
    if (!ok) return { error: data.error || "Innlogging feilet" };
    completeAuth(data);
    return { error: null };
  }

  async function register(fields) {
    setExpiredReason(null);
    const { ok, data } = await rawRegister(fields);
    if (!ok) return { error: data.error || "Registrering feilet" };
    completeAuth(data);
    return { error: null };
  }

  async function loginWithGoogle(credential, listName) {
    setExpiredReason(null);
    const { ok, data } = await rawGoogleAuth(credential, listName);
    if (!ok) return { error: data.error || "Google-innlogging feilet" };
    completeAuth(data);
    return { error: null };
  }

  return (
    <AuthContext.Provider
      value={{ ...auth, login, register, loginWithGoogle, completeAuth, updateIdentity, logout, expiredReason }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
