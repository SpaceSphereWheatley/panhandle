import { useAuth } from "../context/AuthContext.jsx";
import { ProfileIsland } from "../components/settings/ProfileIsland.jsx";
import { PwaInstallCTA } from "../components/settings/PwaInstallCTA.jsx";
import { HomeIsland } from "../components/settings/HomeIsland.jsx";
import { AdminIsland } from "../components/settings/AdminIsland.jsx";
import { AboutFooter } from "../components/settings/AboutFooter.jsx";

// A single scrolling screen of 4 always-visible island containers, rather
// than a drill-down menu — Designintensitet, the PWA highlight, and the
// admin stats grid all need to be directly visible, which a subpage-behind-
// navigation model can't give them.
function IslandLabel({ children }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-2xs)",
        fontWeight: 700,
        color: "var(--text-tertiary)",
        textTransform: "uppercase",
        letterSpacing: "var(--tracking-wide)",
        margin: "20px 4px 8px",
      }}
    >
      {children}
    </div>
  );
}

export function SettingsTab() {
  const { isAdmin } = useAuth();
  return (
    <section>
      <IslandLabel>Meg &amp; min app</IslandLabel>
      <ProfileIsland />
      <PwaInstallCTA />

      <IslandLabel>Vårt hjem</IslandLabel>
      <HomeIsland />

      {isAdmin && (
        <>
          <IslandLabel>Administrasjon</IslandLabel>
          <AdminIsland />
        </>
      )}

      <AboutFooter />
    </section>
  );
}
