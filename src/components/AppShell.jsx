import { useEffect, useRef, useState } from "react";
import { Header, TabBar } from "../design-system/index.js";
import { ChangelogModal } from "./ChangelogModal.jsx";
import { ImportantInfoModal } from "./ImportantInfoModal.jsx";
import { InstallBanner } from "./InstallBanner.jsx";
import { ShoppingListTab } from "../tabs/ShoppingListTab.jsx";
import { MealsTab } from "../tabs/MealsTab.jsx";
import { SettingsTab } from "../tabs/SettingsTab.jsx";
import { StorageTab } from "../tabs/StorageTab.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useLanguage, useTranslation } from "../context/LanguageContext.jsx";
import { dateLocale } from "../lib/i18n/dateLocale.js";
import { settingsTitleKey } from "../lib/settingsNav.js";
import { useDeployVersionCheck } from "../hooks/useDeployVersionCheck.js";
import { useIsDesktop } from "../hooks/useIsDesktop.js";
import { useStorageModuleEnabled } from "../hooks/useStorageModuleEnabled.js";
import { STORAGE_TAB_USER } from "../lib/storageModule.js";
import { haptic } from "../lib/shoppingUtils.js";
import logoMark from "../design-system/assets/logo/panhandle-mark.svg";

// Settings stays the rightmost/last tab always (it's the one users reach
// for regardless of which other tabs exist), so Storage — see
// src/tabs/StorageTab.jsx, a personal-only experiment gated on
// STORAGE_TAB_USER plus the Settings → Appearance on/off toggle, not a real
// household feature yet — slots in just before it rather than after.
const TITLE_KEYS = { list: "shell.tab.list", meals: "shell.tab.meals", storage: "shell.tab.storage", settings: "shell.tab.settings" };
const TAB_ORDER = ["list", "meals", "storage", "settings"];

// Same star path ItemCard's importance badge/swipe-reveal draws — app.html
// only loads Phosphor's "regular" icon weight (not "fill"), so a filled star
// here has to be a plain inline SVG rather than UiIcon's ph-fill class.
const STAR_PATH = "M12 2.5l2.9 6.2 6.6.8-4.9 4.5 1.3 6.6-5.9-3.3-5.9 3.3 1.3-6.6-4.9-4.5 6.6-.8z";

// Sync/offline text — shared by every tab's header, and also the fallback
// shown on the Shopping List tab whenever sync.offline overrides the
// importance legend below. `sync` carries a kind + a timestamp rather than a
// finished string so the label (and the clock format) follow the current
// language, instead of being frozen in whichever one was active at the tick.
function SyncStatus({ sync }) {
  const t = useTranslation();
  const { lang } = useLanguage();
  let text = "";
  if (sync.kind === "updated") {
    const time = new Date(sync.at).toLocaleTimeString(dateLocale(lang), { hour: "2-digit", minute: "2-digit" });
    text = t("shell.sync.updated", { time });
  } else if (sync.kind) {
    text = t(sync.kind === "offline" ? "shell.sync.offline" : "shell.sync.failed");
  }
  return (
    <span
      className={`sync${sync.offline ? " offline" : ""}`}
      style={{ fontSize: "var(--text-2xs)", color: sync.offline ? "var(--accent-primary)" : "var(--text-tertiary)" }}
    >
      {text}
    </span>
  );
}

// Replaces "Oppdatert HH:MM" on the Shopping List tab (only) with a small
// legend explaining what the star marker means — tapping it opens
// ImportantInfoModal. Meals/Settings keep the plain SyncStatus text, since
// importance is a shopping-list-only concept.
function ImportantLegendTrigger({ onClick }) {
  const t = useTranslation();
  return (
    <button
      onClick={onClick}
      aria-label={t("shell.important.legendAria")}
      style={{ background: "none", border: "none", padding: 4, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
    >
      <svg
        viewBox="0 0 24 24"
        width="13"
        height="13"
        fill="var(--accent-tertiary)"
        stroke="var(--accent-tertiary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={STAR_PATH} />
      </svg>
      <span style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>{t("shell.important.legend")}</span>
    </button>
  );
}

export function AppShell() {
  const [tab, setTab] = useState("list");
  // Tabs are mounted once (on first visit) and then kept alive, hidden via
  // CSS, so switching panes never re-fetches from an empty state — see
  // src/tabs/ShoppingListTab.jsx and MealsTab.jsx's `active`-driven effects.
  // Handleliste and Måltider both mount at app open (not just the active
  // one) so Måltider's data is already loading by the time the user
  // switches to it, instead of only starting then — Settings stays lazy,
  // there's no equivalent "check it right away" need for it.
  const [visited, setVisited] = useState({ list: true, meals: true });
  const [sync, setSync] = useState({ kind: null, at: 0, offline: false });
  const [showChangelog, setShowChangelog] = useState(false);
  const [showImportantInfo, setShowImportantInfo] = useState(false);
  // Nav stack for the Settings tab only (e.g. [], ["account"],
  // ["admin","stats"]) — lives here rather than in SettingsTab so it
  // shares the one history/popstate mechanism below instead of a second one.
  // Not reset on tab switch, so returning to Settings resumes where you left off
  // — see pushNav below for how that stays compatible with back navigation.
  const [settingsPath, setSettingsPath] = useState([]);
  const toast = useToast();
  const t = useTranslation();
  const isDesktop = useIsDesktop();
  const { user } = useAuth();
  const storageModuleEnabled = useStorageModuleEnabled();
  const showStorageTab = user === STORAGE_TAB_USER && storageModuleEnabled;
  const applyingPopRef = useRef(false);
  // Direction-aware "enter" animation for whichever pane just became active
  // (tab-bar tap or hardware back/forward — both just change `tab`, so this
  // watches the value rather than hooking into individual entry points).
  // Deliberately animates only the incoming pane, not a true two-pane
  // shared-axis: panes have independent, variable heights and the page
  // itself scrolls (no fixed viewport to clip), so animating an outgoing
  // pane out at the same time would need the container's height pinned for
  // the duration — real risk of a layout jump for very little payoff, since
  // the outgoing pane is gone in well under 100ms anyway. Restarts the CSS
  // animation via the standard reflow trick (set none, force layout, set
  // real value) rather than a React `key` remount, since remounting would
  // blow away ShoppingListTab/MealsTab's kept-alive state (see `visited`
  // above). Timing/easing come from --spring-duration-soft/--ease-spring-soft
  // (design-intensity.css), so "muted"/"classic" and prefers-reduced-motion
  // all collapse this the same way they already collapse TabBar's own
  // indicator — no extra branching needed here. The animation itself
  // (index.css's ph-pane-enter) slides via `left`, not `transform`, and each
  // pane below is `position: relative` to give that `left` an effect —
  // ShoppingListTab/MealsTab each render a `position: fixed` FabMenu, and a
  // `transform` on this wrapper would hijack it into being positioned
  // relative to the pane instead of the viewport for the animation's
  // duration, visibly mispositioning the FAB on every tab switch.
  const paneRefs = useRef({});
  const prevTabRef = useRef(tab);
  useEffect(() => {
    const prev = prevTabRef.current;
    prevTabRef.current = tab;
    if (prev === tab) return;
    const el = paneRefs.current[tab];
    if (!el) return;
    const dir = TAB_ORDER.indexOf(tab) > TAB_ORDER.indexOf(prev) ? 1 : -1;
    el.style.setProperty("--pane-dir", String(dir));
    el.style.animation = "none";
    void el.offsetHeight; // force reflow so the next line restarts the animation
    el.style.animation = "ph-pane-enter var(--spring-duration-soft) var(--ease-spring-soft) both";
  }, [tab]);

  useDeployVersionCheck({ toast, onOpenChangelog: () => setShowChangelog(true), t });

  // Settings subpage navigations push a history entry so the hardware/browser
  // back button (and the subpage Header's back arrow) can step back out of
  // them. Plain tab switches deliberately do NOT push — see pushNav below —
  // so back navigation from inside a subpage always lands on Settings root
  // (or one level shallower) no matter how many other tabs were visited in
  // between. (Modals don't participate in this yet — see CLAUDE.md/PR notes.)
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

  // Replaces (not pushes) the current history entry for a plain tab switch.
  // settingsPath is sticky and carried along for the "resume where you left
  // off" behavior, but since this replaces rather than pushes, a chain of tab
  // hops never grows the stack — it just keeps overwriting the same
  // top-of-stack frame. That keeps the invariant pushSettingsPath below
  // relies on: whenever settingsPath is non-empty, the entry directly below
  // it on the real stack is always the state that was current at the moment
  // the user drilled in, regardless of any tab hops since.
  function pushNav(nextTab) {
    if (applyingPopRef.current) return;
    history.replaceState({ tab: nextTab, settingsPath }, "");
  }

  // Pushes a new Settings subpage (e.g. ["account"], ["admin","stats"]).
  // Back navigation — hardware/browser back or a subpage's Header back
  // arrow — always goes through history.back(), which lands on onPopState
  // above, so both back mechanisms share one code path and can't drift.
  function pushSettingsPath(path) {
    if (applyingPopRef.current) return;
    setSettingsPath(path);
    history.pushState({ tab: "settings", settingsPath: path }, "");
  }

  function onSyncTick() {
    setSync({ kind: "updated", at: Date.now(), offline: false });
  }
  function onOffline() {
    setSync({ kind: navigator.onLine === false ? "offline" : "failed", at: Date.now(), offline: true });
  }

  function switchTab(t) {
    if (t === tab) {
      // Tapping the already-active Settings tab icon while inside a subpage
      // is a direct escape hatch back to the Settings root list, matching
      // common bottom-nav convention (tap the current tab again → its root).
      if (t === "settings" && settingsPath.length > 0) {
        setSettingsPath([]);
        history.replaceState({ tab: "settings", settingsPath: [] }, "");
      }
      return;
    }
    haptic();
    setTab(t);
    setVisited((prev) => (prev[t] ? prev : { ...prev, [t]: true }));
    pushNav(t);
  }

  // Toggling the Storage module off (Settings → Appearance) while it's the
  // active tab would otherwise leave the nav with no matching item
  // highlighted and an empty pane, since the tab itself un-registers from
  // both the moment showStorageTab flips.
  useEffect(() => {
    if (tab === "storage" && !showStorageTab) {
      setTab("list");
      pushNav("list");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showStorageTab]);

  const subpageTitleKey = tab === "settings" && settingsPath.length > 0
    ? settingsTitleKey(settingsPath)
    : null;
  const settingsSubpageTitle = subpageTitleKey ? t(subpageTitleKey) : null;
  const title = settingsSubpageTitle || t(TITLE_KEYS[tab]);

  // One <TabBar> rendered into one of two slots: the desktop left rail is a
  // sibling *before* the header (so it reads first in the DOM, matching its
  // visual position), the phone bottom bar stays last exactly as before.
  const nav = (
    <TabBar
      tabs={[
        { key: "list", label: t("shell.tab.list"), icon: "shopping-cart-simple" },
        { key: "meals", label: t("shell.tab.meals"), icon: "cooking-pot" },
        showStorageTab ? { key: "storage", label: t("shell.tab.storage"), icon: "package" } : null,
        { key: "settings", label: t("shell.tab.settings"), icon: "gear" },
      ].filter(Boolean)}
      active={tab}
      onChange={switchTab}
      navLabel={t("shell.nav.primaryAria")}
      orientation={isDesktop ? "vertical" : "horizontal"}
      brand={
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 var(--space-4)" }}>
          <img src={logoMark} alt="" style={{ width: 28, height: 28 }} />
          <span style={{
            fontFamily: "var(--font-sans)",
            fontSize: "var(--md-title-medium-size)",
            fontWeight: 700,
            color: "var(--text-primary)",
          }}>Panhandle</span>
        </div>
      }
    />
  );

  return (
    <div id="app">
      {isDesktop ? nav : null}
      <Header
        title={title}
        onBack={settingsSubpageTitle ? () => history.back() : undefined}
        action={
          tab === "list" && !sync.offline
            ? <ImportantLegendTrigger onClick={() => setShowImportantInfo(true)} />
            : <SyncStatus sync={sync} />
        }
      />
      <InstallBanner />
      <main>
        {visited.list && (
          <div
            ref={(el) => { paneRefs.current.list = el; }}
            onAnimationEnd={(e) => { if (e.animationName === "ph-pane-enter") e.currentTarget.style.animation = ""; }}
            style={{ display: tab === "list" ? "block" : "none", position: "relative" }}
          >
            <ShoppingListTab active={tab === "list"} onSyncTick={onSyncTick} onOffline={onOffline} />
          </div>
        )}
        {visited.meals && (
          <div
            ref={(el) => { paneRefs.current.meals = el; }}
            onAnimationEnd={(e) => { if (e.animationName === "ph-pane-enter") e.currentTarget.style.animation = ""; }}
            style={{ display: tab === "meals" ? "block" : "none", position: "relative" }}
          >
            <MealsTab active={tab === "meals"} onSyncTick={onSyncTick} onOffline={onOffline} />
          </div>
        )}
        {showStorageTab && visited.storage && (
          <div
            ref={(el) => { paneRefs.current.storage = el; }}
            onAnimationEnd={(e) => { if (e.animationName === "ph-pane-enter") e.currentTarget.style.animation = ""; }}
            style={{ display: tab === "storage" ? "block" : "none", position: "relative" }}
          >
            <StorageTab active={tab === "storage"} />
          </div>
        )}
        {visited.settings && (
          <div
            ref={(el) => { paneRefs.current.settings = el; }}
            onAnimationEnd={(e) => { if (e.animationName === "ph-pane-enter") e.currentTarget.style.animation = ""; }}
            style={{ display: tab === "settings" ? "block" : "none", position: "relative" }}
          >
            <SettingsTab settingsPath={settingsPath} onNavigate={pushSettingsPath} />
          </div>
        )}
      </main>
      {isDesktop ? null : nav}
      {showChangelog && <ChangelogModal onClose={() => setShowChangelog(false)} />}
      {showImportantInfo && <ImportantInfoModal onClose={() => setShowImportantInfo(false)} />}
    </div>
  );
}
