import { useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useListUsers } from "../../context/ListUsersContext.jsx";
import { usePush } from "../../context/PushContext.jsx";
import { currentTheme, setTheme } from "../../lib/theme.js";
import { currentIntensity, setIntensity } from "../../lib/designIntensity.js";
import { SegmentedControl, Switch } from "../../design-system/index.js";
import { PwaInstallCTA } from "./PwaInstallCTA.jsx";
import { SettingsGroup } from "./SettingsGroup.jsx";
import { SettingsRow } from "./SettingsRow.jsx";
import { AboutFooter } from "./AboutFooter.jsx";

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

// Settings root: hero PWA CTA, then two grouped clusters — device-local
// prefs that never navigate, and server-backed things that open a subpage —
// then the flat About footer. See docs/architecture-notes.md-adjacent
// reasoning in CLAUDE.md: this replaces the old five-Card/accordion layout.
export function SettingsRoot({ onNavigate }) {
  const { user, name, isAdmin } = useAuth();
  const { listUsers } = useListUsers();
  const { subscribed } = usePush();

  const [theme, setThemeState] = useState(currentTheme());
  const [intensity, setIntensityState] = useState(currentIntensity());
  const [haptics, setHapticsState] = useState(hapticsEnabled());

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

  return (
    <section>
      <PwaInstallCTA />

      <SettingsGroup label="Appinnstillinger">
        <SettingsRow
          icon="palette"
          label="Designintensitet"
          stackedControl={<SegmentedControl value={intensity} onChange={onSetIntensity} options={INTENSITY_OPTIONS} />}
        />
        <SettingsRow
          icon="circle-half"
          label="Tema"
          stackedControl={<SegmentedControl value={theme} onChange={onSetTheme} options={THEME_OPTIONS} />}
        />
        <SettingsRow
          icon="device-mobile"
          label="Vibrasjon ved handling"
          trailing={<Switch checked={haptics} onChange={onSetHaptics} />}
        />
      </SettingsGroup>

      <SettingsGroup label="Konto & liste">
        <SettingsRow
          icon="user-circle"
          label="Konto"
          supportingText={name || user}
          onClick={() => onNavigate(["konto"])}
        />
        <SettingsRow
          icon="bell"
          label="Varsler"
          supportingText={subscribed ? "Aktivert" : "Av"}
          onClick={() => onNavigate(["varsler"])}
        />
        <SettingsRow
          icon="house"
          label="Vårt hjem"
          supportingText={`${listUsers.length} / 10 medlemmer`}
          onClick={() => onNavigate(["hjem"])}
        />
        <SettingsRow
          icon="storefront"
          label="Butikkoppsett"
          supportingText="Varegrupper og gamle varer"
          onClick={() => onNavigate(["butikk"])}
        />
        {isAdmin && (
          <SettingsRow
            icon="shield-check"
            label="Administrasjon"
            supportingText="Brukere, lister og statistikk"
            onClick={() => onNavigate(["admin"])}
          />
        )}
      </SettingsGroup>

      <AboutFooter />
    </section>
  );
}
