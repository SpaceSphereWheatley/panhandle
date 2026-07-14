import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { rawResetPassword } from "../lib/api.js";
import { Input, Button } from "../design-system/index.js";
import logoMark from "../design-system/assets/logo/panhandle-mark.svg";

export function ResetPasswordScreen({ token, onDone }) {
  const { completeAuth } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError("");
    if (password !== confirm) {
      setError("Passordene er ikke like");
      return;
    }
    if (password.length < 8) {
      setError("Passord må være minst 8 tegn");
      return;
    }
    setBusy(true);
    try {
      const { ok, data } = await rawResetPassword(token, password);
      if (!ok) {
        setError(data.error || "Tilbakestilling feilet");
        return;
      }
      completeAuth(data);
      // Strip the one-time token from the URL so a refresh can't replay it.
      const url = new URL(window.location.href);
      url.searchParams.delete("reset_token");
      window.history.replaceState({}, "", url);
      onDone();
    } catch {
      setError("Nettverksfeil");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
        gap: 12,
        background: "var(--surface-page)",
      }}
    >
      <img src={logoMark} alt="" style={{ width: 56, height: 56, marginBottom: 4 }} />
      <h1
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-xl)",
          fontWeight: "var(--weight-bold)",
          color: "var(--text-primary)",
          margin: "0 0 8px",
        }}
      >
        Nytt passord
      </h1>
      <div style={{ width: "100%", maxWidth: 320 }}>
        <Input placeholder="Nytt passord (minst 8 tegn)" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div style={{ width: "100%", maxWidth: 320 }}>
        <Input placeholder="Gjenta nytt passord" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      <div style={{ marginTop: 6 }}>
        <Button variant="primary" size="lg" disabled={busy} onClick={submit}>
          {busy ? "Lagrer..." : "Lagre nytt passord"}
        </Button>
      </div>
      <div style={{ color: "var(--status-danger)", fontSize: "var(--text-sm)", minHeight: 18, textAlign: "center" }}>
        {error}
      </div>
    </div>
  );
}
