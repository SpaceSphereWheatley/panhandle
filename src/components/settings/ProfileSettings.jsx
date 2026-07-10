import { useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useInstallPrompt, isStandalone, isIos } from "../../context/InstallPromptContext.jsx";
import { api } from "../../lib/api.js";
import { currentTheme, setTheme } from "../../lib/theme.js";

function hapticsEnabled() {
  return localStorage.getItem("ph_haptics") !== "0";
}

export function ProfileSettings() {
  const { user, logout } = useAuth();
  const { canInstall, promptInstall, installed } = useInstallPrompt();
  const [theme, setThemeState] = useState(currentTheme());
  const [haptics, setHapticsState] = useState(hapticsEnabled());
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwMsg, setPwMsg] = useState({ text: "", ok: false });

  function onSetTheme(t) {
    setTheme(t);
    setThemeState(t);
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
    <div>
      <div className="setrow">
        <div className="k">Innlogget som</div>
        <div className="v">{user}</div>
      </div>

      <div className="setrow">
        <div className="k" style={{ marginBottom: 8 }}>Tema</div>
        <div className="theme-toggle">
          <button className={theme === "light" ? "active" : ""} onClick={() => onSetTheme("light")}>Lys</button>
          <button className={theme === "dark" ? "active" : ""} onClick={() => onSetTheme("dark")}>Mørk</button>
          <button className={theme === "system" ? "active" : ""} onClick={() => onSetTheme("system")}>Følg systemet</button>
        </div>
      </div>

      <div className="setrow">
        <div className="k" style={{ marginBottom: 8 }}>Vibrasjon ved handling</div>
        <div className="theme-toggle">
          <button className={haptics ? "active" : ""} onClick={() => onSetHaptics(true)}>På</button>
          <button className={!haptics ? "active" : ""} onClick={() => onSetHaptics(false)}>Av</button>
        </div>
      </div>

      {!isStandalone() && !installed && (
        <div className="setrow">
          <div className="k" style={{ marginBottom: 8 }}>Installer app</div>
          {canInstall ? (
            <button className="btn-primary" onClick={promptInstall}>Installer</button>
          ) : (
            <div className="v" style={{ marginBottom: 8, fontWeight: 400, fontSize: 14 }}>
              {isIos()
                ? 'Trykk del-ikonet ⎋ i Safari og velg "Legg til på Hjemskjerm".'
                : 'Bruk nettleserens meny (⋮) og velg "Installer app" eller "Legg til på Hjemskjerm".'}
            </div>
          )}
        </div>
      )}

      <div className="setrow">
        <div className="k" style={{ marginBottom: 10 }}>Bytt passord</div>
        <input
          type="password"
          placeholder="Nåværende passord"
          style={{ width: "100%", padding: 12, fontSize: 16, borderRadius: 10, border: "1px solid var(--border)", marginBottom: 8 }}
          value={pwCurrent}
          onChange={(e) => setPwCurrent(e.target.value)}
        />
        <input
          type="password"
          placeholder="Nytt passord (min. 6 tegn)"
          style={{ width: "100%", padding: 12, fontSize: 16, borderRadius: 10, border: "1px solid var(--border)", marginBottom: 8 }}
          value={pwNew}
          onChange={(e) => setPwNew(e.target.value)}
        />
        <button onClick={changePassword} className="btn-primary">Lagre nytt passord</button>
        <div style={{ fontSize: 13, marginTop: 8, minHeight: 16, color: pwMsg.ok ? "var(--green)" : "var(--danger)" }}>
          {pwMsg.text}
        </div>
      </div>

      <button className="logout" onClick={() => logout()}>Logg ut</button>
    </div>
  );
}
