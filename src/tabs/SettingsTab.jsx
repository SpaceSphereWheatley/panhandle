import { SettingsRoot } from "../components/settings/SettingsRoot.jsx";
import { KontoSubpage } from "../components/settings/subpages/KontoSubpage.jsx";
import { VarslerSubpage } from "../components/settings/subpages/VarslerSubpage.jsx";
import { HjemSubpage } from "../components/settings/subpages/HjemSubpage.jsx";
import { AdminSubpage } from "../components/settings/subpages/AdminSubpage.jsx";
import { StatistikkSubpage } from "../components/settings/subpages/StatistikkSubpage.jsx";

// Router over the Settings nav stack owned by AppShell (settingsPath / the
// shared Header's title+back button live there — see AppShell.jsx). This
// component only decides which screen's body to render.
export function SettingsTab({ settingsPath = [], onNavigate }) {
  const [root, sub] = settingsPath;

  if (root === "konto") return <KontoSubpage />;
  if (root === "varsler") return <VarslerSubpage />;
  if (root === "hjem") return <HjemSubpage />;
  if (root === "admin" && sub === "statistikk") return <StatistikkSubpage />;
  if (root === "admin") return <AdminSubpage onNavigate={onNavigate} />;
  return <SettingsRoot onNavigate={onNavigate} />;
}
