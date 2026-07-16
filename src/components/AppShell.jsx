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

// Settings subpage titles, keyed by the joined settingsPath (e.g.
// "admin/statistikk") — drives the single shared Header when a Settings
// subpage is open, so subpages never render their own second header.
const SETTINGS_SUBPAGE_TITLES = {
  konto: "Konto",
  varsler: "Varsler",
  hjem: "Vårt hjem",
  admin: "Administrasjon",
  "admin/statistikk": "Statistikk",
};

export function AppShell() {
  const [tab, setTab] = useState("list");
  // Tabs are mounted once (on first visit) and then kept alive, hidden via
  // CSS, so switching panes never re-fetches from an empty state — see
  // src/tabs/ShoppingListTab.jsx and MealsTab.jsx's `active`-driven effects.
  const [visited, setVisited] = useState({ list: true });
  const [sync, setSync] = useState({ text: "", offline: false });
  const [showChangelog, setShowChangelog] = useState(false);
  // Nav stack for the Settings tab only (e.g. [], ["konto"],
  // ["admin","statistikk"]) — lives here rather than in SettingsTab so it
  // shares the one history/popstate mechanism below instead of a second one.
  // Not reset on tab switch, so returning to Settings resumes where you left off.
  const [settingsPath, setSettingsPath] = useState([]);
  const toast = useToast();
  const applyingPopRef = useRef(false);

  useDeployVersionCheck({ toast, onOpenChangelog: () => setShowChangelog(true) });

  // Tab switches (and Settings subpage navigations) each push a history
  // entry so the hardware/browser back button steps through them instead of
  // exiting the installed PWA outright — there's no other history to fall
  // back to. (Modals don't participate in this yet — see CLAUDE.md/PR notes.)
  useEffect(() => {
    history.replaceState({ tab: "list", settingsPath: [] }, "");
    function onPopState(e) {
      const state = e.state || { tab: "list", settingsPath: [] };
      applyingPopRef.current = true;
      setTab(state.tab);
      setSettingsPath(state.settingsPath || []);
      setVisited((prev) => (prev[state.tab] ? prev : { ...prev, [state.tab]: true }));
      applyingPopRef.current = false;
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function pushNav(nextTab) {
    if (applyingPopRef.current) return;
    history.pushState({ tab: nextTab, settingsPath }, "");
  }

  // Pushes a new Settings subpage (e.g. ["konto"], ["admin","statistikk"]).
  // Back navigation — hardware/browser back or a subpage's Header back
  // arrow — always goes through history.back(), which lands on onPopState
  // above, so both back mechanisms share one code path and can't drift.
  function pushSettingsPath(path) {
    if (applyingPopRef.current) return;
    setSettingsPath(path);
    history.pushState({ tab: "settings", settingsPath: path }, "");
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

  const settingsSubpageTitle = tab === "settings" && settingsPath.length > 0
    ? SETTINGS_SUBPAGE_TITLES[settingsPath.join("/")]
    : null;
  const title = settingsSubpageTitle || TITLES[tab];

  return (
    <div id="app">
      <Header
        title={title}
        onBack={settingsSubpageTitle ? () => history.back() : undefined}
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
          <div style={{ display: tab === "list" ? "block" : "none" }}>
            <ShoppingListTab active={tab === "list"} onSyncTick={onSyncTick} onOffline={onOffline} />
          </div>
        )}
        {visited.meals && (
          <div style={{ display: tab === "meals" ? "block" : "none" }}>
            <MealsTab active={tab === "meals"} onSyncTick={onSyncTick} onOffline={onOffline} />
          </div>
        )}
        {visited.settings && (
          <div style={{ display: tab === "settings" ? "block" : "none" }}>
            <SettingsTab settingsPath={settingsPath} onNavigate={pushSettingsPath} />
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
