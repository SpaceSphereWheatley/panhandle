import { useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { api } from "../../lib/api.js";
import { currentTheme, setTheme } from "../../lib/theme.js";
import { currentIntensity, setIntensity } from "../../lib/designIntensity.js";
import { Card, SegmentedControl, Switch } from "../../design-system/index.js";
import { AccordionRow } from "./AccordionRow.jsx";

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
  const [theme, setThemeState] = useState(currentTheme());
  const [intensity, setIntensityState] = useState(currentIntensity());
  const [haptics, setHapticsState] = useState(hapticsEnabled());
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwMsg, setPwMsg] = useState({ text: "", ok: false });

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
      setPwMsg({ text: "Nytt passord må være minst 6 tegn", ok: false });
      return;
    }
    try {
      const res = await api("/change-password", {
        method: "POST",
        body: JSON.stringify({ current_password: pwCurrent, new_password: pwNew }),
      });
      if (res.error) {
        setPwMsg({ text: res.error, ok: false });
        return;
      }
      // server returns a fresh token valid on the new version; the header
      // refresh is skipped for this endpoint, so the body token is authoritative.
      if (res.token) localStorage.setItem("ph_token", res.token);
      setPwMsg({ text: "Passord endret. Andre enheter er logget ut.", ok: true });
      setPwCurrent("");
      setPwNew("");
    } catch {
      setPwMsg({ text: "Noe gikk galt", ok: false });
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

      <AccordionRow label="Bytt passord">
        <input
          type="password"
          placeholder="Nåværende passord"
          style={{ width: "100%", padding: 12, fontSize: 16, borderRadius: 10, border: "1px solid var(--border-default)", marginBottom: 8 }}
          value={pwCurrent}
          onChange={(e) => setPwCurrent(e.target.value)}
        />
        <input
          type="password"
          placeholder="Nytt passord (min. 6 tegn)"
          style={{ width: "100%", padding: 12, fontSize: 16, borderRadius: 10, border: "1px solid var(--border-default)", marginBottom: 8 }}
          value={pwNew}
          onChange={(e) => setPwNew(e.target.value)}
        />
        <button onClick={changePassword} className="btn-primary">Lagre nytt passord</button>
        <div style={{ fontSize: 13, marginTop: 8, minHeight: 16, color: pwMsg.ok ? "var(--status-success)" : "var(--status-danger)" }}>
          {pwMsg.text}
        </div>
      </AccordionRow>

      <button className="logout" style={{ marginTop: 16 }} onClick={() => logout()}>Logg ut</button>
    </Card>
  );
}
