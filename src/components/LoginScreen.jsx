import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";

export function LoginScreen() {
  const { login, expiredReason } = useAuth();
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

  return (
    <div id="login">
      <h1>Panhandle</h1>
      <input
        placeholder="Brukernavn"
        autoComplete="username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && doLogin()}
      />
      <div className="pw-wrap">
        <input
          type={showPassword ? "text" : "password"}
          placeholder="Passord"
          autoComplete="current-password"
          style={{ paddingRight: 64 }}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doLogin()}
        />
        <button
          type="button"
          className="pw-toggle"
          onClick={() => setShowPassword((v) => !v)}
          aria-label="Vis eller skjul passord"
        >
          {showPassword ? "Skjul" : "Vis"}
        </button>
      </div>
      <button disabled={busy} onClick={doLogin}>
        {busy ? "Logger inn..." : "Logg inn"}
      </button>
      <div id="loginErr">{error || expiredReason}</div>
    </div>
  );
}
