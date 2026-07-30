import { useState } from "react";
import { Card, SegmentedControl, Switch } from "../../../design-system/index.js";
import { currentTheme, setTheme } from "../../../lib/theme.js";
import { currentIntensity, setIntensity } from "../../../lib/designIntensity.js";
import { layoutOverride, setLayoutOverride } from "../../../lib/layoutMode.js";
import { useIsDesktopViewport } from "../../../hooks/useIsDesktop.js";
import { SubpageSection } from "../SubpageSection.jsx";
import { useTranslation } from "../../../context/LanguageContext.jsx";

// Appearance subpage (Settings → "Utseende") — the device-local personalization that used to sit
// inline on the Settings root (design intensity, theme, haptics). Moved into
// its own subpage so the root is a single uniform list of navigation rows,
// consistent with Konto/Varsler/Vårt hjem/Butikkoppsett/Administrasjon, rather
// than one cluster that behaved differently. These are the only settings the
// app stores per-device (localStorage/theme helpers), never on the server, so
// each control applies instantly — no save button.
function hapticsEnabled() {
  return localStorage.getItem("ph_haptics") !== "0";
}

export function AppearanceSubpage() {
  const t = useTranslation();
  const themeOptions = [
    { value: "light", label: t("settings.appearance.theme.light") },
    { value: "dark", label: t("settings.appearance.theme.dark") },
    { value: "system", label: t("settings.appearance.theme.system") },
  ];
  const intensityOptions = [
    { value: "expressive", label: t("settings.appearance.intensity.expressive") },
    { value: "muted", label: t("settings.appearance.intensity.muted") },
    { value: "classic", label: t("settings.appearance.intensity.classic") },
  ];
  const [theme, setThemeState] = useState(currentTheme());
  const [intensity, setIntensityState] = useState(currentIntensity());
  const [haptics, setHapticsState] = useState(hapticsEnabled());
  const [preferPhoneUi, setPreferPhoneUiState] = useState(layoutOverride() === "compact");
  const isDesktopViewport = useIsDesktopViewport();

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
  function onSetPreferPhoneUi(on) {
    setLayoutOverride(on ? "compact" : null);
    setPreferPhoneUiState(on);
  }

  return (
    <Card padding="lg" style={{ overflow: "hidden" }}>
      <SubpageSection
        label={t("settings.appearance.intensity.label")}
        description={t("settings.appearance.intensity.description")}
      >
        <SegmentedControl value={intensity} onChange={onSetIntensity} options={intensityOptions} />
      </SubpageSection>

      <SubpageSection
        label={t("settings.appearance.theme.label")}
        description={t("settings.appearance.theme.description")}
      >
        <SegmentedControl value={theme} onChange={onSetTheme} options={themeOptions} />
      </SubpageSection>

      <SubpageSection
        label={t("settings.appearance.haptics.label")}
        description={t("settings.appearance.haptics.description")}
      >
        <Switch checked={haptics} onChange={onSetHaptics} />
      </SubpageSection>

      {isDesktopViewport && (
        <SubpageSection
          label={t("settings.appearance.preferPhoneUi.label")}
          description={t("settings.appearance.preferPhoneUi.description")}
        >
          <Switch checked={preferPhoneUi} onChange={onSetPreferPhoneUi} />
        </SubpageSection>
      )}
    </Card>
  );
}
