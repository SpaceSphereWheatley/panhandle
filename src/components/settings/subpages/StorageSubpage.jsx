import { useState } from "react";
import { Card, Switch } from "../../../design-system/index.js";
import { isStorageModuleEnabled, setStorageModuleEnabled } from "../../../lib/storageModule.js";
import { SubpageSection } from "../SubpageSection.jsx";
import { useTranslation } from "../../../context/LanguageContext.jsx";

// "Lager" subpage (Settings → Storage) — gathers storage-related settings in
// one place, same reasoning as Butikkoppsett doing it for the shopping list.
// Today that's just the per-device show/hide toggle (moved out of Appearance
// now that the module isn't account-gated anymore — every list member can
// reach this page, so it needed its own row rather than living inside a
// personalization-only subpage). Future storage-specific settings belong
// here rather than back on Appearance.
export function StorageSubpage() {
  const t = useTranslation();
  const [enabled, setEnabledState] = useState(isStorageModuleEnabled());

  function onSetEnabled(on) {
    setStorageModuleEnabled(on);
    setEnabledState(on);
  }

  return (
    <Card padding="lg" style={{ overflow: "hidden" }}>
      <SubpageSection
        label={t("settings.storage.showTab.label")}
        description={t("settings.storage.showTab.description")}
      >
        <Switch checked={enabled} onChange={onSetEnabled} />
      </SubpageSection>
    </Card>
  );
}
