import { SettingsRoot } from "../components/settings/SettingsRoot.jsx";
import { AppearanceSubpage } from "../components/settings/subpages/AppearanceSubpage.jsx";
import { AccountSubpage } from "../components/settings/subpages/AccountSubpage.jsx";
import { LanguageSubpage } from "../components/settings/subpages/LanguageSubpage.jsx";
import { NotificationsSubpage } from "../components/settings/subpages/NotificationsSubpage.jsx";
import { HouseholdSubpage } from "../components/settings/subpages/HouseholdSubpage.jsx";
import { StoreSubpage } from "../components/settings/subpages/StoreSubpage.jsx";
import { AdminSubpage } from "../components/settings/subpages/AdminSubpage.jsx";
import { StatsSubpage } from "../components/settings/subpages/StatsSubpage.jsx";

// Router over the Settings nav stack owned by AppShell (settingsPath / the
// shared Header's title+back button live there — see AppShell.jsx). This
// component only decides which screen's body to render.
export function SettingsTab({ settingsPath = [], onNavigate }) {
  const [root, sub] = settingsPath;

  if (root === "appearance") return <AppearanceSubpage />;
  if (root === "account") return <AccountSubpage />;
  if (root === "language") return <LanguageSubpage />;
  if (root === "notifications") return <NotificationsSubpage />;
  if (root === "household") return <HouseholdSubpage />;
  if (root === "store") return <StoreSubpage />;
  if (root === "admin" && sub === "stats") return <StatsSubpage />;
  if (root === "admin") return <AdminSubpage onNavigate={onNavigate} />;
  return <SettingsRoot onNavigate={onNavigate} />;
}
