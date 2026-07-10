import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { ProfileSettings } from "../components/settings/ProfileSettings.jsx";
import { MembersSettings } from "../components/settings/MembersSettings.jsx";
import { AdminSettings } from "../components/settings/AdminSettings.jsx";
import { RecurringSettings } from "../components/settings/RecurringSettings.jsx";
import { AboutSettings } from "../components/settings/AboutSettings.jsx";

export const SETTINGS_TITLES = {
  main: "Innstillinger",
  profile: "Profil",
  members: "Medlemmer",
  admin: "Administrasjon",
  recurring: "Fast ukentlig ansvar",
  about: "Om",
};

export function SettingsTab({ onViewChange }) {
  const { isAdmin, isOwner } = useAuth();
  const [view, setView] = useState("main");

  function go(v) {
    setView(v);
    onViewChange?.(v);
  }

  if (view !== "main") {
    return (
      <section>
        <button className="subpage-back" onClick={() => go("main")}>‹ Innstillinger</button>
        {view === "profile" && <ProfileSettings />}
        {view === "members" && <MembersSettings />}
        {view === "admin" && <AdminSettings />}
        {view === "recurring" && <RecurringSettings />}
        {view === "about" && <AboutSettings />}
      </section>
    );
  }

  return (
    <section>
      <button className="setrow nav-row" onClick={() => go("profile")}>
        <span>Profil</span>
        <span className="nav-row-arrow" />
      </button>
      {isOwner && (
        <button className="setrow nav-row" onClick={() => go("members")}>
          <span>Medlemmer</span>
          <span className="nav-row-arrow" />
        </button>
      )}
      {isAdmin && (
        <button className="setrow nav-row" onClick={() => go("admin")}>
          <span>Administrasjon</span>
          <span className="nav-row-arrow" />
        </button>
      )}
      <button className="setrow nav-row" onClick={() => go("recurring")}>
        <span>Fast ukentlig ansvar</span>
        <span className="nav-row-arrow" />
      </button>
      <button className="setrow nav-row" onClick={() => go("about")}>
        <span>Om</span>
        <span className="nav-row-arrow" />
      </button>
    </section>
  );
}
