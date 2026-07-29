import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { rawGetInvitePreview } from "../lib/api.js";
import { Input, Button } from "../design-system/index.js";
import { GoogleSignIn } from "./GoogleSignIn.jsx";
import { useTranslation } from "../context/LanguageContext.jsx";
import logoMark from "../design-system/assets/logo/panhandle-mark.svg";
import { apiErrorMessage } from "../lib/apiError.js";

// Landing screen for a shared invite link (?invite_token=...). Unlike
// SignupScreen, there's no list-name field — the household already exists —
// and unlike ResetPasswordScreen, an invalid/expired token has to route the
// visitor somewhere (onBack), since there's no form to fall back to.
export function AcceptInviteScreen({ token, onDone, onBack }) {
  const t = useTranslation();
  const { acceptInvite, acceptInviteGoogle } = useAuth();
  const [preview, setPreview] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    rawGetInvitePreview(token).then(({ ok, data }) => {
      if (cancelled) return;
      setPreview(ok ? data : null);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  function finish() {
    // Strip the one-time token from the URL so a refresh can't replay it.
    const url = new URL(window.location.href);
    url.searchParams.delete("invite_token");
    window.history.replaceState({}, "", url);
    onDone();
  }

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
      const res = await acceptInvite(token, { name: name.trim(), email: email.trim(), password });
      if (res.error || res.code) {
        setError(apiErrorMessage(res, t) || t("auth.invite.failed"));
        return;
      }
      finish();
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
      const res = await acceptInviteGoogle(token, credential);
      if (res.error || res.code) {
        setError(apiErrorMessage(res, t) || t("auth.google.failed"));
        return;
      }
      finish();
    } catch {
      setError(t("auth.networkError"));
    } finally {
      setBusy(false);
    }
  }

  const wrapStyle = {
    minHeight: "100dvh",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 12,
    background: "var(--surface-page)",
  };
  const titleStyle = {
    fontFamily: "var(--font-sans)",
    fontSize: "var(--text-2xl)",
    fontWeight: "var(--weight-bold)",
    letterSpacing: "var(--tracking-tight)",
    color: "var(--text-primary)",
    margin: "0 0 8px",
    textAlign: "center",
  };

  if (!loaded) {
    return (
      <div style={wrapStyle}>
        <img src={logoMark} alt="" style={{ width: 56, height: 56, marginBottom: 4 }} />
        <div style={{ color: "var(--text-secondary)", fontSize: "var(--text-md)" }}>{t("auth.invite.loading")}</div>
      </div>
    );
  }

  if (!preview) {
    return (
      <div style={wrapStyle}>
        <img src={logoMark} alt="" style={{ width: 56, height: 56, marginBottom: 4 }} />
        <h1 style={titleStyle}>{t("auth.invite.invalidTitle")}</h1>
        <div style={{ color: "var(--text-secondary)", fontSize: "var(--text-md)", textAlign: "center", maxWidth: 320 }}>
          {t("auth.invite.invalidBody")}
        </div>
        <div style={{ marginTop: 6 }}>
          <Button variant="primary" size="lg" onClick={onBack}>
            {t("auth.invite.backToLogin")}
          </Button>
        </div>
      </div>
    );
  }

  const inviterName = preview.inviter_name || preview.list_name;

  return (
    <div style={wrapStyle}>
      <img src={logoMark} alt="" style={{ width: 56, height: 56, marginBottom: 4 }} />
      <h1 style={titleStyle}>
        {inviterName ? t("auth.invite.title", { name: inviterName }) : t("auth.invite.titleFallback")}
      </h1>
      <div style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", textAlign: "center", maxWidth: 320, marginBottom: 4 }}>
        {t("auth.invite.subtitle")}
      </div>
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
      <div style={{ marginTop: 6 }}>
        <Button variant="primary" size="lg" disabled={busy} onClick={submit}>
          {t(busy ? "auth.invite.busy" : "auth.invite.submit")}
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
        {t("auth.invite.backToLogin")}
      </button>
    </div>
  );
}
