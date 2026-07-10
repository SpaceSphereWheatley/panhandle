import { useState } from "react";
import { UiIcon } from "./UiIcon.jsx";
import { ShoppingListTab } from "../tabs/ShoppingListTab.jsx";
import { MealsTabStub } from "../tabs/MealsTabStub.jsx";
import { SettingsTabStub } from "../tabs/SettingsTabStub.jsx";

const TITLES = { list: "Handleliste", meals: "Måltider", settings: "Innstillinger" };

export function AppShell() {
  const [tab, setTab] = useState("list");
  const [sync, setSync] = useState({ text: "", offline: false });

  function onSyncTick() {
    const t = new Date().toLocaleTimeString("no-NO", { hour: "2-digit", minute: "2-digit" });
    setSync({ text: "Oppdatert " + t, offline: false });
  }
  function onOffline() {
    setSync({ text: navigator.onLine === false ? "Offline" : "Kunne ikke oppdatere", offline: true });
  }

  return (
    <div id="app">
      <header>
        <span id="title">{TITLES[tab]}</span>
        <div className="header-actions">
          <span className={`sync${sync.offline ? " offline" : ""}`}>{sync.text}</span>
        </div>
      </header>
      <main>
        {tab === "list" && <ShoppingListTab onSyncTick={onSyncTick} onOffline={onOffline} />}
        {tab === "meals" && <MealsTabStub />}
        {tab === "settings" && <SettingsTabStub />}
      </main>
      <nav>
        <button className={tab === "list" ? "active" : ""} onClick={() => setTab("list")}>
          <span className="ico"><UiIcon name="cart" size={22} /></span>
          Handleliste
        </button>
        <button className={tab === "meals" ? "active" : ""} onClick={() => setTab("meals")}>
          <span className="ico"><UiIcon name="utensils" size={22} /></span>
          Måltider
        </button>
        <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>
          <span className="ico"><UiIcon name="settings" size={22} /></span>
          Innstillinger
        </button>
      </nav>
    </div>
  );
}
