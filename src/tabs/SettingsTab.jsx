import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { ProfileSettings } from "../components/settings/ProfileSettings.jsx";
import { MembersSettings } from "../components/settings/MembersSettings.jsx";
import { AdminSettings } from "../components/settings/AdminSettings.jsx";
import { MetricsSettings } from "../components/settings/MetricsSettings.jsx";
import { RecurringSettings } from "../components/settings/RecurringSettings.jsx";
import { AboutSettings } from "../components/settings/AboutSettings.jsx";

export const SETTINGS_TITLES = {
  main: "Innstillinger",
  profile: "Profil",
  members: "Medlemmer",
  admin: "Administrasjon",
  metrics: "Statistikk",
  recurring: "Fast ukentlig ansvar",
  about: "Om",
};

// `view`/`onViewChange` are controlled by AppShell (rather than owned here)
// so the browser back button can restore a specific subpage via history state.
export function SettingsTab({ view, onViewChange }) {
  const { isAdmin, isOwner } = useAuth();

  if (view !== "main") {
    return (
      <section>
        <button className="subpage-back" onClick={() => onViewChange("main")}>‹ Innstillinger</button>
        {view === "profile" && <ProfileSettings />}
        {view === "members" && <MembersSettings />}
        {view === "admin" && <AdminSettings />}
        {view === "metrics" && <MetricsSettings />}
        {view === "recurring" && <RecurringSettings />}
        {view === "about" && <AboutSettings />}
      </section>
    );
  }

  return (
    <section>
      <NavRow label="Profil" onClick={() => onViewChange("profile")} />
      {isOwner && <NavRow label="Medlemmer" onClick={() => onViewChange("members")} />}
      {isAdmin && <NavRow label="Administrasjon" onClick={() => onViewChange("admin")} />}
      {isAdmin && <NavRow label="Statistikk" onClick={() => onViewChange("metrics")} />}
      <NavRow label="Fast ukentlig ansvar" onClick={() => onViewChange("recurring")} />
      <NavRow label="Om" onClick={() => onViewChange("about")} />
    </section>
  );
}

// Card-style drill-down row, built on design-system tokens (matches the card
// look of the shopping/meals tabs) with a real Phosphor caret and a light
// press "give" on tap, replacing the old hand-drawn CSS chevron.
function NavRow({ label, onClick }) {
  const [press, setPress] = useState(false);
  return (
    <button
      onClick={onClick}
      onPointerDown={() => setPress(true)}
      onPointerUp={() => setPress(false)}
      onPointerLeave={() => setPress(false)}
      onPointerCancel={() => setPress(false)}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        background: "var(--surface-card)",
        border: "none",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-card)",
        padding: 16,
        marginBottom: 10,
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-md)",
        color: "var(--text-primary)",
        textAlign: "left",
        transition: "transform var(--duration-fast) var(--ease-out)",
        transform: press ? "scale(var(--press-scale))" : "none",
      }}
    >
      <span>{label}</span>
      <i className="ph ph-caret-right" style={{ color: "var(--accent-primary)", fontSize: 18, flexShrink: 0 }} />
    </button>
  );
}
