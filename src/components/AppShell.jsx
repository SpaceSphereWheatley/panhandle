import { useEffect, useRef, useState } from "react";
import { UiIcon } from "./UiIcon.jsx";
import { ChangelogModal } from "./ChangelogModal.jsx";
import { InstallBanner } from "./InstallBanner.jsx";
import { ShoppingListTab } from "../tabs/ShoppingListTab.jsx";
import { MealsTab } from "../tabs/MealsTab.jsx";
import { SettingsTab, SETTINGS_TITLES } from "../tabs/SettingsTab.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useDeployVersionCheck } from "../hooks/useDeployVersionCheck.js";

const TITLES = { list: "Handleliste", meals: "Måltider", settings: "Innstillinger" };

export function AppShell() {
  const [tab, setTab] = useState("list");
  const [settingsView, setSettingsView] = useState("main");
  const [sync, setSync] = useState({ text: "", offline: false });
  const [showChangelog, setShowChangelog] = useState(false);
  const toast = useToast();
  const applyingPopRef = useRef(false);

  useDeployVersionCheck({ toast, onOpenChangelog: () => setShowChangelog(true) });

  // Tab switches and settings drill-down each push a history entry so the
  // hardware/browser back button steps through them instead of exiting the
  // installed PWA outright — there's no other history to fall back to.
  // (Modals don't participate in this yet — see CLAUDE.md/PR notes.)
  useEffect(() => {
    history.replaceState({ tab: "list", settingsView: "main" }, "");
    function onPopState(e) {
      const state = e.state || { tab: "list", settingsView: "main" };
      applyingPopRef.current = true;
      setTab(state.tab);
      setSettingsView(state.settingsView);
      applyingPopRef.current = false;
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function pushNav(nextTab, nextSettingsView) {
    if (applyingPopRef.current) return;
    history.pushState({ tab: nextTab, settingsView: nextSettingsView }, "");
  }

  function onSyncTick() {
    const t = new Date().toLocaleTimeString("no-NO", { hour: "2-digit", minute: "2-digit" });
    setSync({ text: "Oppdatert " + t, offline: false });
  }
  function onOffline() {
    setSync({ text: navigator.onLine === false ? "Offline" : "Kunne ikke oppdatere", offline: true });
  }

  function switchTab(t) {
    if (t === tab) return;
    setTab(t);
    setSettingsView("main");
    pushNav(t, "main");
  }

  // The in-page "‹ Innstillinger" back links mean "go back" — make that an
  // actual history pop instead of a forward push, so it and the hardware back
  // button stay in sync with each other.
  function onSettingsViewChange(v) {
    if (v === "main") {
      if (settingsView !== "main") history.back();
      return;
    }
    setSettingsView(v);
    pushNav(tab, v);
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
      <InstallBanner />
      <main>
        {tab === "list" && <ShoppingListTab onSyncTick={onSyncTick} onOffline={onOffline} />}
        {tab === "meals" && <MealsTab onSyncTick={onSyncTick} onOffline={onOffline} />}
        {tab === "settings" && <SettingsTab view={settingsView} onViewChange={onSettingsViewChange} />}
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
      {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)} />}
    </div>
  );
}
