import { useEffect, useState } from "react";
import { isStorageModuleEnabled, subscribeStorageModule } from "../lib/storageModule.js";

// Mirrors useDesignIntensity.js's shape — reacts to the Settings toggle
// (AppearanceSubpage.jsx) so AppShell's nav updates instantly without a
// reload, even though the two components don't otherwise share state.
export function useStorageModuleEnabled() {
  const [enabled, setEnabled] = useState(isStorageModuleEnabled);
  useEffect(() => subscribeStorageModule(setEnabled), []);
  return enabled;
}
