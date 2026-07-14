import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { api } from "../../lib/api.js";
import { currentTheme, setTheme } from "../../lib/theme.js";
import { currentIntensity, setIntensity } from "../../lib/designIntensity.js";
import { Card, Input, SegmentedControl, Switch } from "../../design-system/index.js";
import { AccordionRow } from "./AccordionRow.jsx";
import { useToast } from "../../context/ToastContext.jsx";

function hapticsEnabled() {
  return localStorage.getItem("ph_haptics") !== "0";
}

const THEME_OPTIONS = [
  { value: "light", label: "Lys" },
  { value: "dark", label: "Mørk" },
  { value: "system", label: "Følg systemet" },
];

const INTENSITY_OPTIONS = [
  { value: "expressive", label: "Ekspressiv" },
  { value: "muted", label: "Dempet" },
  { value: "classic", label: "Klassisk" },
];

// Island 1 — "Meg & Min App": identity, Designintensitet + Tema + Vibrasjon,
// and (accordioned) password change + logout. The PWA install highlight is
// its own standalone CTA — see PwaInstallCTA.jsx — rendered as a sibling
// after this card rather than a row nested inside it.
export function ProfileIsland() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const [theme, setThemeState] = useState(currentTheme());
  const [intensity, setIntensityState] = useState(currentIntensity());
  const [haptics, setHapticsState] = useState(hapticsEnabled());
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [email, setEmail] = useState(null);
  const [emailInput, setEmailInput] = useState("");
  const [emailPw, setEmailPw] = useState("");

  useEffect(() => {
    api("/account").then((res) => {
      if (res.error) return;
      setEmail(res.email);
      setEmailInput(res.email || "");
    });
  }, []);

  async function saveEmail() {
    try {
      const res = await api("/change-email", {
        method: "POST",
        body: JSON.stringify({ current_password: emailPw, email: emailInput.trim() }),
      });
      if (res.error) {
        toast(res.error, { error: true });
        return;
      }
      setEmail(res.email);
      setEmailPw("");
      toast("E-post lagret.");
    } catch {
      toast("Noe gikk galt", { error: true });
    }
  }

  function onSetTheme(t) {
    setTheme(t);
    setThemeState(t);
  }

  function onSetIntensity(v) {
    setIntensity(v);
    setIntensityState(v);
  }

  function onSetHaptics(on) {
    localStorage.setItem("ph_haptics", on ? "1" : "0");
    setHapticsState(on);
    if (on && navigator.vibrate) navigator.vibrate(10);
  }

  async function changePassword() {
    if (pwNew.length < 6) {
      toast("Nytt passord må være minst 6 tegn", { error: true });
      return;
    }
    try {
      const res = await api("/change-password", {
        method: "POST",
        body: JSON.stringify({ current_password: pwCurrent, new_password: pwNew }),
      });
      if (res.error) {
        toast(res.error, { error: true });
        return;
      }
      // server returns a fresh token valid on the new version; the header
      // refresh is skipped for this endpoint, so the body token is authoritative.
      if (res.token) localStorage.setItem("ph_token", res.token);
      toast("Passord endret. Andre enheter er logget ut.");
      setPwCurrent("");
      setPwNew("");
    } catch {
      toast("Noe gikk galt", { error: true });
    }
  }

  return (
    <Card padding="lg" style={{ marginBottom: 16 }}>
      <div style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>Innlogget som</div>
      <div style={{ fontSize: "var(--text-md)", fontWeight: 600, marginBottom: 18, color: "var(--text-primary)" }}>{user}</div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>Designintensitet</div>
        <SegmentedControl value={intensity} onChange={onSetIntensity} options={INTENSITY_OPTIONS} />
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>Tema</div>
        <SegmentedControl value={theme} onChange={onSetTheme} options={THEME_OPTIONS} />
      </div>

      <div style={{ marginBottom: 4 }}>
        <Switch checked={haptics} onChange={onSetHaptics} label="Vibrasjon ved handling" />
      </div>

      <AccordionRow label={email ? "E-post" : "Legg til e-post"}>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginBottom: 8 }}>
          Brukes til Google-innlogging og for å tilbakestille passord hvis du glemmer det.
        </div>
        <label htmlFor="profile-email" style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
          E-post
        </label>
        <Input
          id="profile-email"
          type="email"
          placeholder="E-post"
          style={{ marginBottom: 8 }}
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
        />
        <label htmlFor="profile-email-pw" style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
          Nåværende passord
        </label>
        <Input
          id="profile-email-pw"
          type="password"
          placeholder="Nåværende passord"
          style={{ marginBottom: 8 }}
          value={emailPw}
          onChange={(e) => setEmailPw(e.target.value)}
        />
        <button onClick={saveEmail} className="btn-primary">Lagre e-post</button>
      </AccordionRow>

      <AccordionRow label="Bytt passord">
        <label htmlFor="profile-pw-current" style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
          Nåværende passord
        </label>
        <Input
          id="profile-pw-current"
          type="password"
          placeholder="Nåværende passord"
          style={{ marginBottom: 8 }}
          value={pwCurrent}
          onChange={(e) => setPwCurrent(e.target.value)}
        />
        <label htmlFor="profile-pw-new" style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
          Nytt passord (min. 6 tegn)
        </label>
        <Input
          id="profile-pw-new"
          type="password"
          placeholder="Nytt passord (min. 6 tegn)"
          style={{ marginBottom: 8 }}
          value={pwNew}
          onChange={(e) => setPwNew(e.target.value)}
        />
        <button onClick={changePassword} className="btn-primary">Lagre nytt passord</button>
      </AccordionRow>

      <button className="logout" style={{ marginTop: 16 }} onClick={() => logout()}>Logg ut</button>
    </Card>
  );
}
