import { useState } from "react";
import { rawForgotPassword } from "../lib/api.js";
import { Input, Button } from "../design-system/index.js";
import { Turnstile } from "./Turnstile.jsx";
import logoMark from "../design-system/assets/logo/panhandle-mark.svg";

export function ForgotPasswordScreen({ onBack }) {
  const [email, setEmail] = useState("");
  const [turnstileToken, setTurnstileToken] = useState(null);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError("");
    if (!turnstileToken) {
      setError("Fullfør bot-verifiseringen");
      return;
    }
    setBusy(true);
    try {
      // Always shown regardless of the API result — this endpoint returns the
      // same generic response whether or not the email is registered, so the
      // UI must never let the two cases look different to the user either.
      await rawForgotPassword(email.trim(), turnstileToken);
      setSent(true);
    } catch {
      setError("Nettverksfeil");
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
          textAlign: "center",
        }}
      >
        Glemt passord?
      </h1>
      {sent ? (
        <p style={{ color: "var(--text-secondary)", textAlign: "center", maxWidth: 320 }}>
          Hvis e-posten finnes hos oss, har vi sendt en lenke for å tilbakestille passordet.
        </p>
      ) : (
        <>
          <div style={{ width: "100%", maxWidth: 320 }}>
            <Input placeholder="E-post" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Turnstile onToken={setTurnstileToken} />
          <div style={{ marginTop: 6 }}>
            <Button variant="primary" size="lg" disabled={busy} onClick={submit}>
              {busy ? "Sender..." : "Send lenke"}
            </Button>
          </div>
          <div style={{ color: "var(--status-danger)", fontSize: "var(--text-sm)", minHeight: 18, textAlign: "center" }}>
            {error}
          </div>
        </>
      )}
      <button
        type="button"
        onClick={onBack}
        style={{ background: "none", border: "none", color: "var(--accent-primary)", fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", cursor: "pointer", marginTop: 8 }}
      >
        Tilbake til innlogging
      </button>
    </div>
  );
}
