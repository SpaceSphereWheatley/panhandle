import { useEffect, useRef, useState } from "react";
import { Header, TabBar } from "../design-system/index.js";
import { ChangelogModal } from "./ChangelogModal.jsx";
import { InstallBanner } from "./InstallBanner.jsx";
import { ShoppingListTab } from "../tabs/ShoppingListTab.jsx";
import { MealsTab } from "../tabs/MealsTab.jsx";
import { SettingsTab } from "../tabs/SettingsTab.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useDeployVersionCheck } from "../hooks/useDeployVersionCheck.js";
import { haptic } from "../lib/shoppingUtils.js";

const TITLES = { list: "Handleliste", meals: "Måltider", settings: "Innstillinger" };

export function AppShell() {
  const [tab, setTab] = useState("list");
  // Tabs are mounted once (on first visit) and then kept alive, hidden via
  // CSS, so switching panes never re-fetches from an empty state — see
  // src/tabs/ShoppingListTab.jsx and MealsTab.jsx's `active`-driven effects.
  const [visited, setVisited] = useState({ list: true });
  const [sync, setSync] = useState({ text: "", offline: false });
  const [showChangelog, setShowChangelog] = useState(false);
  const toast = useToast();
  const applyingPopRef = useRef(false);

  useDeployVersionCheck({ toast, onOpenChangelog: () => setShowChangelog(true) });

  // Tab switches each push a history entry so the hardware/browser back
  // button steps through them instead of exiting the installed PWA outright
  // — there's no other history to fall back to. (Modals don't participate
  // in this yet — see CLAUDE.md/PR notes.)
  useEffect(() => {
    history.replaceState({ tab: "list" }, "");
    function onPopState(e) {
      const state = e.state || { tab: "list" };
      applyingPopRef.current = true;
      setTab(state.tab);
      setVisited((prev) => (prev[state.tab] ? prev : { ...prev, [state.tab]: true }));
      applyingPopRef.current = false;
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function pushNav(nextTab) {
    if (applyingPopRef.current) return;
    history.pushState({ tab: nextTab }, "");
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
    haptic();
    setTab(t);
    setVisited((prev) => (prev[t] ? prev : { ...prev, [t]: true }));
    pushNav(t);
  }

  const title = TITLES[tab];

  return (
    <div id="app">
      <Header
        title={title}
        action={
          <span
            className={`sync${sync.offline ? " offline" : ""}`}
            style={{ fontSize: "var(--text-2xs)", color: sync.offline ? "var(--accent-primary)" : "var(--text-tertiary)" }}
          >
            {sync.text}
          </span>
        }
      />
      <InstallBanner />
      <main>
        {visited.list && (
          <div style={tab === "list" ? undefined : { visibility: "hidden", position: "absolute", inset: 0, pointerEvents: "none" }}>
            <ShoppingListTab active={tab === "list"} onSyncTick={onSyncTick} onOffline={onOffline} />
          </div>
        )}
        {visited.meals && (
          <div style={tab === "meals" ? undefined : { visibility: "hidden", position: "absolute", inset: 0, pointerEvents: "none" }}>
            <MealsTab active={tab === "meals"} onSyncTick={onSyncTick} onOffline={onOffline} />
          </div>
        )}
        {visited.settings && (
          <div style={{ display: tab === "settings" ? "block" : "none" }}>
            <SettingsTab />
          </div>
        )}
      </main>
      <TabBar
        tabs={[
          { key: "list", label: "Handleliste", icon: "shopping-cart-simple" },
          { key: "meals", label: "Måltider", icon: "cooking-pot" },
          { key: "settings", label: "Innstillinger", icon: "gear" },
        ]}
        active={tab}
        onChange={switchTab}
      />
      {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)} />}
    </div>
  );
}
