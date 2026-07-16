import { useState } from "react";
import { currentTheme, setTheme } from "../../lib/theme.js";
import { currentIntensity, setIntensity } from "../../lib/designIntensity.js";
import { Card, SegmentedControl, Switch } from "../../design-system/index.js";
import { SectionHeader } from "./SectionHeader.jsx";

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

// Island 2 — "Appinnstillinger": device/app-level prefs (Designintensitet,
// Tema, Vibrasjon), all persisted per-device in localStorage — split out
// from the account-identity fields in ProfileIsland.jsx (its own separate
// "Konto" island), matching every other Settings section being one Card
// with one SectionHeader.
export function AppSettingsIsland() {
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
    <Card padding="lg" style={{ marginBottom: 16, overflow: "hidden" }}>
      <SectionHeader>Appinnstillinger</SectionHeader>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>Designintensitet</div>
        <SegmentedControl value={intensity} onChange={onSetIntensity} options={INTENSITY_OPTIONS} />
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>Tema</div>
        <SegmentedControl value={theme} onChange={onSetTheme} options={THEME_OPTIONS} />
      </div>

      <div>
        <Switch checked={haptics} onChange={onSetHaptics} label="Vibrasjon ved handling" />
      </div>
    </Card>
  );
}
