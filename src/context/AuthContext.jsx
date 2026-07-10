import { createContext, useContext, useEffect, useRef, useState } from "react";
import { configureApi, rawLogin } from "../lib/api.js";

const AuthContext = createContext(null);

function readStoredAuth() {
  return {
    token: localStorage.getItem("ph_token"),
    user: localStorage.getItem("ph_user"),
    isAdmin: localStorage.getItem("ph_is_admin") === "1",
    isOwner: localStorage.getItem("ph_is_owner") === "1",
  };
}

function persistAuth(auth) {
  if (auth.token == null) {
    localStorage.removeItem("ph_token");
    localStorage.removeItem("ph_user");
    localStorage.removeItem("ph_is_admin");
    localStorage.removeItem("ph_is_owner");
    return;
  }
  localStorage.setItem("ph_token", auth.token);
  localStorage.setItem("ph_user", auth.user);
  localStorage.setItem("ph_is_admin", auth.isAdmin ? "1" : "0");
  localStorage.setItem("ph_is_owner", auth.isOwner ? "1" : "0");
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(readStoredAuth);
  const [expiredReason, setExpiredReason] = useState(null);
  // api.js needs the *current* token/logout without re-subscribing on every
  // change, so it reads through a ref rather than a stale closure.
  const authRef = useRef(auth);
  authRef.current = auth;

  function logout(reason) {
    const cleared = { token: null, user: null, isAdmin: false, isOwner: false };
    authRef.current = cleared;
    setAuth(cleared);
    persistAuth(cleared);
    if (reason === "expired") {
      setExpiredReason(
        "Økten utløp eller passordet ble endret på en annen enhet. Logg inn på nytt."
      );
    }
  }

  useEffect(() => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(username, password) {
    setExpiredReason(null);
    const { ok, data } = await rawLogin(username, password);
    if (!ok) return { error: data.error || "Innlogging feilet" };
    const next = {
      token: data.token,
      user: data.user,
      isAdmin: !!data.is_admin,
      isOwner: !!data.is_owner,
    };
    authRef.current = next;
    setAuth(next);
    persistAuth(next);
    return { error: null };
  }

  return (
    <AuthContext.Provider value={{ ...auth, login, logout, expiredReason }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
