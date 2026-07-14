import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { Input, Button } from "../design-system/index.js";
import { Turnstile } from "./Turnstile.jsx";
import { GoogleSignIn } from "./GoogleSignIn.jsx";
import logoMark from "../design-system/assets/logo/panhandle-mark.svg";

export function SignupScreen({ onBack }) {
  const { register, loginWithGoogle } = useAuth();
  const [username, setUsername] = useState("");
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
      setError("Passordene er ikke like");
      return;
    }
    if (!turnstileToken) {
      setError("Fullfør bot-verifiseringen");
      return;
    }
    setBusy(true);
    try {
      const { error } = await register({
        username: username.trim(),
        email: email.trim(),
        password,
        list_name: listName.trim() || undefined,
        turnstile_token: turnstileToken,
      });
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
      const { error } = await loginWithGoogle(credential, listName.trim() || undefined);
      if (error) setError(error);
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
          fontSize: "var(--text-2xl)",
          fontWeight: "var(--weight-bold)",
          letterSpacing: "var(--tracking-tight)",
          color: "var(--text-primary)",
          margin: "0 0 8px",
        }}
      >
        Opprett ny husstand
      </h1>
      <div style={{ width: "100%", maxWidth: 320 }}>
        <Input placeholder="Brukernavn" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
      </div>
      <div style={{ width: "100%", maxWidth: 320 }}>
        <Input placeholder="E-post" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div style={{ width: "100%", maxWidth: 320 }}>
        <Input placeholder="Passord (minst 8 tegn)" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div style={{ width: "100%", maxWidth: 320 }}>
        <Input placeholder="Gjenta passord" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      <div style={{ width: "100%", maxWidth: 320 }}>
        <Input placeholder="Familienavn (valgfritt)" value={listName} onChange={(e) => setListName(e.target.value)} />
      </div>
      <Turnstile onToken={setTurnstileToken} />
      <div style={{ marginTop: 6 }}>
        <Button variant="primary" size="lg" disabled={busy} onClick={doRegister}>
          {busy ? "Oppretter..." : "Opprett konto"}
        </Button>
      </div>
      <div style={{ margin: "6px 0", color: "var(--text-tertiary)", fontSize: "var(--text-sm)" }}>eller</div>
      <GoogleSignIn onCredential={doGoogle} />
      <div style={{ color: "var(--status-danger)", fontSize: "var(--text-sm)", minHeight: 18, textAlign: "center" }}>
        {error}
      </div>
      <button
        type="button"
        onClick={onBack}
        style={{ background: "none", border: "none", color: "var(--accent-primary)", fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", cursor: "pointer", marginTop: 8 }}
      >
        Har du allerede en konto? Logg inn
      </button>
    </div>
  );
}
