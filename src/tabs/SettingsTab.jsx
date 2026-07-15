import { useAuth } from "../context/AuthContext.jsx";
import { ProfileIsland } from "../components/settings/ProfileIsland.jsx";
import { PwaInstallCTA } from "../components/settings/PwaInstallCTA.jsx";
import { HomeIsland } from "../components/settings/HomeIsland.jsx";
import { AdminIsland } from "../components/settings/AdminIsland.jsx";
import { AboutFooter } from "../components/settings/AboutFooter.jsx";

// A single scrolling screen of 4 always-visible island containers, rather
// than a drill-down menu — Designintensitet, the PWA highlight, and the
// admin stats grid all need to be directly visible, which a subpage-behind-
// navigation model can't give them. Each island carries its own section
// title as a header strip baked into its Card (see SectionHeader.jsx)
// instead of a label floating above it, so the title reads as part of its
// card rather than a separate element competing with it. The extra
// marginBottom on each section wrapper (on top of each island's own
// internal spacing) is what visually separates the three sections from
// each other.
export function SettingsTab() {
  const { isAdmin } = useAuth();
  return (
    <section>
      <div style={{ marginBottom: 24 }}>
        <ProfileIsland />
        <PwaInstallCTA />
      </div>

      <div style={{ marginBottom: 24 }}>
        <HomeIsland />
      </div>

      {isAdmin && (
        <div style={{ marginBottom: 24 }}>
          <AdminIsland />
        </div>
      )}

      <AboutFooter />
    </section>
  );
}
