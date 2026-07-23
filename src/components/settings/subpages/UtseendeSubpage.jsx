import { useState } from "react";
import { Card, SegmentedControl, Switch } from "../../../design-system/index.js";
import { currentTheme, setTheme } from "../../../lib/theme.js";
import { currentIntensity, setIntensity } from "../../../lib/designIntensity.js";
import { SubpageSection } from "../SubpageSection.jsx";

// "Utseende" subpage — the device-local personalization that used to sit
// inline on the Settings root (design intensity, theme, haptics). Moved into
// its own subpage so the root is a single uniform list of navigation rows,
// consistent with Konto/Varsler/Vårt hjem/Butikkoppsett/Administrasjon, rather
// than one cluster that behaved differently. These are the only settings the
// app stores per-device (localStorage/theme helpers), never on the server, so
// each control applies instantly — no save button.
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

export function UtseendeSubpage() {
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
    <Card padding="lg" style={{ overflow: "hidden" }}>
      <SubpageSection
        label="Designintensitet"
        description="Hvor uttrykksfullt appen ser ut — farger, dybde og animasjon. Gjelder bare denne enheten."
      >
        <SegmentedControl value={intensity} onChange={onSetIntensity} options={INTENSITY_OPTIONS} />
      </SubpageSection>

      <SubpageSection
        label="Tema"
        description="Lyst eller mørkt utseende. «Følg systemet» bytter automatisk med enheten. Gjelder bare denne enheten."
      >
        <SegmentedControl value={theme} onChange={onSetTheme} options={THEME_OPTIONS} />
      </SubpageSection>

      <SubpageSection
        label="Vibrasjon ved handling"
        description="Kort vibrasjon når du krysser av eller legger til varer. Gjelder bare denne enheten."
      >
        <Switch checked={haptics} onChange={onSetHaptics} />
      </SubpageSection>
    </Card>
  );
}
