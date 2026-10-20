import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { Button, Card, Checkbox } from "../design-system/index.js";
import { useTranslation } from "../context/LanguageContext.jsx";
import { apiErrorMessage } from "../lib/apiError.js";
import logoMark from "../design-system/assets/logo/panhandle-mark.svg";

// Consent screen for the claude.ai connector (docs/mcp-connector-plan.md).
// worker/mcp.js's /oauth/authorize validates Claude's request, binds a
// one-time consent handle to this browser (a __Host- cookie) and redirects
// here with ?handle=. Allow/Deny post back to the Worker, which answers with
// the URL to send the browser to — back to Claude, with a code or with
// access_denied. Every string from the client (its self-registered name)
// is rendered as plain text by React, never as HTML.
export function ConnectScreen({ handle, onExit }) {
  const t = useTranslation();
  const [details, setDetails] = useState(null);
  const [error, setError] = useState("");
  const [allowWrite, setAllowWrite] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api(`/oauth-consent/${encodeURIComponent(handle)}`)
      .then((res) => {
        if (cancelled) return;
        if (res.error || res.code) setError(apiErrorMessage(res, t));
        else setDetails(res);
      })
      .catch(() => !cancelled && setError(t("auth.networkError")));
    return () => {
      cancelled = true;
    };
  }, [handle, t]);

  async function decide(approve) {
    setBusy(true);
    setError("");
    try {
      const res = await api(`/oauth-consent/${encodeURIComponent(handle)}/${approve ? "approve" : "deny"}`, {
        method: "POST",
        body: JSON.stringify({ write: allowWrite }),
      });
      if (res.redirectTo) {
        window.location.assign(res.redirectTo);
        return;
      }
      setError(apiErrorMessage(res, t));
    } catch {
      setError(t("auth.networkError"));
    }
    setBusy(false);
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
    margin: "0 0 4px",
    textAlign: "center",
  };
  const mutedStyle = { color: "var(--text-secondary)", fontSize: "var(--text-sm)", textAlign: "center", maxWidth: 360 };

  if (!details) {
    return (
      <div style={wrapStyle}>
        <img src={logoMark} alt="" style={{ width: 56, height: 56, marginBottom: 4 }} />
        {error ? (
          <>
            <h1 style={titleStyle}>{t("connect.failedTitle")}</h1>
            <div style={mutedStyle}>{error}</div>
            <div style={{ marginTop: 6 }}>
              <Button variant="primary" size="lg" onClick={onExit}>
                {t("connect.toApp")}
              </Button>
            </div>
          </>
        ) : (
          <div style={mutedStyle}>{t("connect.loading")}</div>
        )}
      </div>
    );
  }

  return (
    <div style={wrapStyle}>
      <img src={logoMark} alt="" style={{ width: 56, height: 56, marginBottom: 4 }} />
      <h1 style={titleStyle}>{t("connect.title", { client: details.client_name })}</h1>
      <div style={mutedStyle}>
        {details.list_name ? t("connect.subtitleNamed", { list: details.list_name }) : t("connect.subtitle")}
      </div>

      <Card padding="lg" style={{ width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
          {t("connect.sentTo")} <strong>{details.redirect_host}</strong>
        </div>
        {details.redirect_is_loopback && (
          <div style={{ fontSize: "var(--text-sm)", color: "var(--status-danger)" }}>{t("connect.loopbackWarning")}</div>
        )}
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>{t("connect.unverifiedName")}</div>
        <div style={{ borderTop: "1px solid var(--border-default)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>
            <i className="ph ph-check" aria-hidden="true" style={{ marginRight: 8 }} />
            {t("connect.scope.read")}
          </div>
          {/* Label beside, not inside, the Checkbox: its own label is a
              single ellipsized line, too short for this sentence on a phone. */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <Checkbox variant="select" checked={allowWrite} onChange={setAllowWrite} />
            <span
              onClick={() => setAllowWrite(!allowWrite)}
              style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)", cursor: "pointer", paddingTop: 2 }}
            >
              {t("connect.scope.write")}
            </span>
          </div>
        </div>
      </Card>

      <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
        <Button variant="outline" size="lg" disabled={busy} onClick={() => decide(false)}>
          {t("connect.deny")}
        </Button>
        <Button variant="primary" size="lg" disabled={busy} onClick={() => decide(true)}>
          {t("connect.allow")}
        </Button>
      </div>
      <div style={{ color: "var(--status-danger)", fontSize: "var(--text-sm)", minHeight: 18, textAlign: "center" }}>{error}</div>
      <div style={{ ...mutedStyle, fontSize: "var(--text-xs)" }}>{t("connect.revokeHint")}</div>
    </div>
  );
}
