import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { rawResetPassword } from "../lib/api.js";
import { Input, Button } from "../design-system/index.js";
import { useTranslation } from "../context/LanguageContext.jsx";
import logoMark from "../design-system/assets/logo/panhandle-mark.svg";

export function ResetPasswordScreen({ token, onDone }) {
  const t = useTranslation();
  const { completeAuth } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError("");
    if (password !== confirm) {
      setError(t("auth.signup.passwordMismatch"));
      return;
    }
    if (password.length < 8) {
      setError(t("auth.reset.tooShort"));
      return;
    }
    setBusy(true);
    try {
      const { ok, data } = await rawResetPassword(token, password);
      if (!ok) {
        // TODO(i18n): data.error is a raw server string (worker/index.js), not run through t() — phase 2+.
        setError(data.error || t("auth.reset.failed"));
        return;
      }
      completeAuth(data);
      // Strip the one-time token from the URL so a refresh can't replay it.
      const url = new URL(window.location.href);
      url.searchParams.delete("reset_token");
      window.history.replaceState({}, "", url);
      onDone();
    } catch {
      setError(t("auth.networkError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
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
        {t("auth.reset.title")}
      </h1>
      <div style={{ width: "100%", maxWidth: 320 }}>
        <Input placeholder={t("auth.reset.password")} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div style={{ width: "100%", maxWidth: 320 }}>
        <Input placeholder={t("auth.reset.repeatPassword")} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      <div style={{ marginTop: 6 }}>
        <Button variant="primary" size="lg" disabled={busy} onClick={submit}>
          {t(busy ? "auth.reset.busy" : "auth.reset.submit")}
        </Button>
      </div>
      <div style={{ color: "var(--status-danger)", fontSize: "var(--text-sm)", minHeight: 18, textAlign: "center" }}>
        {error}
      </div>
    </div>
  );
}
