import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { Input, Button } from "../design-system/index.js";
import { Turnstile } from "./Turnstile.jsx";
import { GoogleSignIn } from "./GoogleSignIn.jsx";
import { useTranslation } from "../context/LanguageContext.jsx";
import logoMark from "../design-system/assets/logo/panhandle-mark.svg";
import { apiErrorMessage } from "../lib/apiError.js";

export function SignupScreen({ onBack }) {
  const t = useTranslation();
  const { register, loginWithGoogle } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [listName, setListName] = useState("");
  const [turnstileToken, setTurnstileToken] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function doRegister() {
    setError("");
    if (password !== confirm) {
      setError(t("auth.signup.passwordMismatch"));
      return;
    }
    if (!turnstileToken) {
      setError(t("auth.signup.turnstileRequired"));
      return;
    }
    setBusy(true);
    try {
      const res = await register({
        name: name.trim(),
        email: email.trim(),
        password,
        list_name: listName.trim() || undefined,
        turnstile_token: turnstileToken,
      });
      if (res.error || res.code) setError(apiErrorMessage(res, t) || t("auth.signup.failed"));
    } catch {
      setError(t("auth.networkError"));
    } finally {
      setBusy(false);
    }
  }

  async function doGoogle(credential) {
    setError("");
    setBusy(true);
    try {
      const res = await loginWithGoogle(credential, listName.trim() || undefined);
      if (res.error || res.code) setError(apiErrorMessage(res, t) || t("auth.google.failed"));
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
          fontSize: "var(--text-2xl)",
          fontWeight: "var(--weight-bold)",
          letterSpacing: "var(--tracking-tight)",
          color: "var(--text-primary)",
          margin: "0 0 8px",
        }}
      >
        {t("auth.signup.title")}
      </h1>
      <div style={{ width: "100%", maxWidth: 320 }}>
        <Input placeholder={t("auth.signup.name")} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div style={{ width: "100%", maxWidth: 320 }}>
        <Input placeholder={t("auth.email")} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div style={{ width: "100%", maxWidth: 320 }}>
        <Input placeholder={t("auth.signup.password")} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div style={{ width: "100%", maxWidth: 320 }}>
        <Input placeholder={t("auth.signup.repeatPassword")} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      <div style={{ width: "100%", maxWidth: 320 }}>
        <Input placeholder={t("auth.signup.listName")} value={listName} onChange={(e) => setListName(e.target.value)} />
      </div>
      <Turnstile onToken={setTurnstileToken} />
      <div style={{ marginTop: 6 }}>
        <Button variant="primary" size="lg" disabled={busy} onClick={doRegister}>
          {t(busy ? "auth.signup.busy" : "auth.signup.submit")}
        </Button>
      </div>
      <div style={{ margin: "6px 0", color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>{t("auth.or")}</div>
      <GoogleSignIn onCredential={doGoogle} />
      <div style={{ color: "var(--status-danger)", fontSize: "var(--text-sm)", minHeight: 18, textAlign: "center" }}>
        {error}
      </div>
      <button
        type="button"
        onClick={onBack}
        style={{ background: "none", border: "none", color: "var(--accent-primary)", fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", cursor: "pointer", marginTop: 8 }}
      >
        {t("auth.signup.backLink")}
      </button>
    </div>
  );
}
