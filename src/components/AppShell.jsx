import { useState } from "react";
import { UiIcon } from "./UiIcon.jsx";
import { ShoppingListTab } from "../tabs/ShoppingListTab.jsx";
import { MealsTab } from "../tabs/MealsTab.jsx";
import { SettingsTab, SETTINGS_TITLES } from "../tabs/SettingsTab.jsx";

const TITLES = { list: "Handleliste", meals: "Måltider", settings: "Innstillinger" };

export function AppShell() {
  const [tab, setTab] = useState("list");
  const [settingsView, setSettingsView] = useState("main");
  const [sync, setSync] = useState({ text: "", offline: false });

  function onSyncTick() {
    const t = new Date().toLocaleTimeString("no-NO", { hour: "2-digit", minute: "2-digit" });
    setSync({ text: "Oppdatert " + t, offline: false });
  }
  function onOffline() {
    setSync({ text: navigator.onLine === false ? "Offline" : "Kunne ikke oppdatere", offline: true });
  }

  function switchTab(t) {
    setTab(t);
    setSettingsView("main");
  }

  const title = tab === "settings" ? SETTINGS_TITLES[settingsView] : TITLES[tab];

  return (
    <div id="app">
      <header>
        <span id="title">{title}</span>
        <div className="header-actions">
          <span className={`sync${sync.offline ? " offline" : ""}`}>{sync.text}</span>
        </div>
      </header>
      <main>
        {tab === "list" && <ShoppingListTab onSyncTick={onSyncTick} onOffline={onOffline} />}
        {tab === "meals" && <MealsTab onSyncTick={onSyncTick} onOffline={onOffline} />}
        {tab === "settings" && <SettingsTab onViewChange={setSettingsView} />}
      </main>
      <nav>
        <button className={tab === "list" ? "active" : ""} onClick={() => switchTab("list")}>
          <span className="ico"><UiIcon name="cart" size={22} /></span>
          Handleliste
        </button>
        <button className={tab === "meals" ? "active" : ""} onClick={() => switchTab("meals")}>
          <span className="ico"><UiIcon name="utensils" size={22} /></span>
          Måltider
        </button>
        <button className={tab === "settings" ? "active" : ""} onClick={() => switchTab("settings")}>
          <span className="ico"><UiIcon name="settings" size={22} /></span>
          Innstillinger
        </button>
      </nav>
    </div>
  );
}
