import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { Input, Button } from "../design-system/index.js";
import { GoogleSignIn } from "./GoogleSignIn.jsx";
import logoMark from "../design-system/assets/logo/panhandle-mark.svg";

export function LoginScreen({ onSignup, onForgot }) {
  const { login, loginWithGoogle, expiredReason } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function doLogin() {
    setError("");
    setBusy(true);
    try {
      const { error } = await login(username.trim(), password);
      if (error) setError(error);
    } catch {
      setError("Nettverksfeil");
    } finally {
      setBusy(false);
    }
  }

  async function doGoogle(credential) {
    setError("");
    setBusy(true);
    try {
      const { error } = await loginWithGoogle(credential);
      if (error) setError(error);
    } catch {
      setError("Nettverksfeil");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      id="login"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
        gap: 14,
        background: "var(--surface-page)",
      }}
    >
      <img src={logoMark} alt="" style={{ width: 56, height: 56, marginBottom: 4 }} />
      <h1
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-2xl)",
          fontWeight: "var(--weight-bold)",
          letterSpacing: "var(--tracking-tight)",
          color: "var(--text-primary)",
          margin: "0 0 12px",
        }}
      >
        Panhandle
      </h1>
      <div style={{ width: "100%", maxWidth: 320 }}>
        <Input
          placeholder="Brukernavn"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doLogin()}
        />
      </div>
      <div style={{ width: "100%", maxWidth: 320 }}>
        <Input
          type={showPassword ? "text" : "password"}
          placeholder="Passord"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doLogin()}
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label="Vis eller skjul passord"
              style={{
                background: "none",
                border: "none",
                color: "var(--text-tertiary)",
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-xs)",
                fontWeight: 600,
                cursor: "pointer",
                padding: "4px 2px",
                flexShrink: 0,
              }}
            >
              {showPassword ? "Skjul" : "Vis"}
            </button>
          }
        />
      </div>
      <div style={{ marginTop: 6 }}>
        <Button variant="primary" size="lg" disabled={busy} onClick={doLogin}>
          {busy ? "Logger inn..." : "Logg inn"}
        </Button>
      </div>
      <div
        id="loginErr"
        style={{ color: "var(--status-danger)", fontSize: "var(--text-sm)", minHeight: 18, textAlign: "center" }}
      >
        {error || expiredReason}
      </div>
      <div style={{ margin: "2px 0", color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>eller</div>
      <GoogleSignIn onCredential={doGoogle} />
      <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
        <button
          type="button"
          onClick={onSignup}
          style={{ background: "none", border: "none", color: "var(--accent-primary)", fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", cursor: "pointer" }}
        >
          Opprett ny husstand
        </button>
        <button
          type="button"
          onClick={onForgot}
          style={{ background: "none", border: "none", color: "var(--accent-primary)", fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", cursor: "pointer" }}
        >
          Glemt passord?
        </button>
      </div>
    </div>
  );
}
