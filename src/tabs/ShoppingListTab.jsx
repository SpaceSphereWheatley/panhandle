import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { api } from "../lib/api.js";
import { useToast } from "../context/ToastContext.jsx";
import { useListUsers } from "../context/ListUsersContext.jsx";
import { cap, parseItemInput, extractGF, matchCatalogue, matchWithDescriptor, buildItemNotes, haptic } from "../lib/shoppingUtils.js";
import { clusterFor } from "../lib/categoryClusters.js";
import { useCategoryOrder } from "../context/CategoryOrderContext.jsx";
import { useConfirm } from "../context/ConfirmContext.jsx";
import { useIsDesktop } from "../hooks/useIsDesktop.js";
import { useMotionConfig } from "../hooks/useMotionConfig.js";
import { ItemCard } from "../components/ItemCard.jsx";
import { ItemEditModal } from "../components/ItemEditModal.jsx";
import { SuggestionsModal } from "../components/SuggestionsModal.jsx";
import { UiIcon } from "../components/UiIcon.jsx";
import { WeekIngredientsModal } from "../components/meals/WeekIngredientsModal.jsx";
import { Input, Avatar, FabMenu, Skeleton, EmptyState, BaseButton } from "../design-system/index.js";
import { readCache, writeCache } from "../lib/localCache.js";
import { enqueue, flushQueue, queueLength, newTempId } from "../lib/writeQueue.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage, useTranslation } from "../context/LanguageContext.jsx";
import { translateItemName } from "../lib/i18n/itemNames.js";
import { apiErrorMessage } from "../lib/apiError.js";

const POLL_MS = 7000;
// Last-fetched list, hydrated on mount so a returning user sees real items
// instantly instead of a skeleton/spinner on every cold open — see
// loadList()/CLAUDE.md's loading-UI notes.
const ITEMS_CACHE_KEY = "ph_cache_items_v1";
// Fallback hold before a checked-off item re-sorts into "Recently bought" when
// Framer's animation is off (reduced motion, or "classic" intensity) — there's
// no pop animation to key off in that case, so this is a deliberately fixed,
// standalone pause, not tied to any animation's duration. When Framer IS
// animating the card (see ItemCard's onAnimationComplete), the resolve fires
// off the real animation finishing instead of this constant.
const FALLBACK_RESOLVE_MS = 400;
// Fallback duration for a "Recently bought" row's fade-out when it's pushed
// past BOUGHT_CAP by a newer arrival and Framer isn't animating (reduced
// motion / "classic" intensity) — mirrors FALLBACK_RESOLVE_MS's role, just
// for the opposite transition. Kept in lockstep with ItemCard's `evicting`
// animation duration (EVICT_ANIM_S, 0.22s) so the non-animated fallback
// removes the row at roughly the pace a Framer user sees it finish fading.
const EVICT_MS = 220;

// Cap track width at 1/3 of the row (minus the two 8px gaps) so auto-fit
// never lays out more than 3 columns, while still stretching a short last
// row to fill the width — plain minmax(140px, 1fr) only ever fit 2 columns
// on typical phone widths.
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(140px, (100% - 16px) / 3), 1fr))", gap: 8 };
const listStyle = { display: "flex", flexDirection: "column", gap: 8 };

// Desktop equivalents. The 3-column clamp above is a *cap*, not a minimum —
// its min track grows with the container, so on a 960px column it would lay
// out 3 enormous tiles rather than more of them; dropped here in favour of a
// plain minimum track. auto-FILL rather than auto-fit is load-bearing: the
// "Important" section routinely holds one or two items, which auto-fit would
// stretch across the full width instead of leaving them item-sized.
// List view becomes 2-up, since one grocery item per 960px row is worse than
// the grid it replaced — applies in every intensity, including classic.
const desktopGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 };
const desktopListStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 8 };

// Same star path ItemCard's importance badge/swipe-reveal draws — kept as a
// literal here too (not imported), same self-contained-illustration reasoning
// as ImportantInfoModal's copy: this is the pinImportant toggle chip's icon,
// not a real item row.
const STAR_PATH = "M12 2.5l2.9 6.2 6.6.8-4.9 4.5 1.3 6.6-5.9-3.3-5.9 3.3 1.3-6.6-4.9-4.5 6.6-.8z";

const IMPORTANT_CHIP_PRESS_STYLE = { transform: "scale(var(--press-scale))" };

const VIEW_TOGGLE_STYLE = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 4,
  background: "var(--surface-sunken)",
  border: "none",
  borderRadius: "var(--radius-pill)",
  padding: 3,
  margin: 0,
  font: "inherit",
};

// Cold-load placeholder, shaped like a couple of categories worth of items —
// a category label bar plus a handful of item-card-shaped blocks — so first
// paint reserves roughly the real layout instead of a spinner with nothing
// underneath it.
function ShoppingListSkeleton({ viewMode, containerStyle }) {
  const groups = [3, 2];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {groups.map((count, i) => (
        <div key={i}>
          <Skeleton width={100} height={11} radius={4} style={{ marginBottom: 8 }} />
          {/* Same container style as the real list, or the cold-load
              placeholder is 3-up while the list it stands in for is 6-up. */}
          <div style={containerStyle}>
            {Array.from({ length: count }).map((_, j) => (
              <Skeleton key={j} height={viewMode === "grid" ? 64 : 44} radius={12} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Empty-list illustration — a basket with a couple of items about to drop
// in, drawn in the same line-weight/rounded-stroke/category-dot language as
// onboarding/illustrations.jsx (inline SVG on design tokens, so it needs no
// dark-mode variant and stays cheap to redraw if the UI changes).
function EmptyListIllustration() {
  return (
    <svg width="140" height="112" viewBox="0 0 140 112" fill="none" aria-hidden="true">
      <path
        d="M38 46h64l-7 46a8 8 0 0 1-8 7H53a8 8 0 0 1-8-7l-7-46z"
        fill="var(--surface-sunken)"
        stroke="var(--border-strong)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M52 46c0-12 8-20 18-20s18 8 18 20"
        stroke="var(--border-strong)"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M45 60h50M48 74h44" stroke="var(--border-default)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="27" cy="24" r="7" fill="var(--accent-primary-subtle)" stroke="var(--accent-primary)" strokeWidth="2" />
      <circle cx="107" cy="18" r="6" fill="var(--accent-tertiary-subtle)" stroke="var(--accent-tertiary)" strokeWidth="2" />
      <circle cx="112" cy="40" r="4.5" fill="var(--accent-secondary)" />
      <path d="M23 24h8M27 20v8" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// How long the "just finished" window stays open after the last item's card
// has actually finished leaving the screen (see handleListExitComplete) —
// long enough for ph-allbought-pop/-tick (see motion.css) to finish, after
// which `celebrate` resets so a later trip's last item gets its own fresh
// play instead of this one lingering "on".
const CELEBRATE_MS = 500;

// Small checkmark-in-circle mark, reused by both the summary pill and the
// compact "nothing left to buy" block below. `animate` gates the checkmark's
// draw-in; the container it sits in (see both call sites) separately gates
// its own pop entrance with the same flag, so the two play together. Only
// true for the specific render where the last item's resolve just finished
// — every other render (mount, poll tick, another device's write) renders
// the same rest state with no animation attribute at all, so it can't
// replay on its own. See CELEBRATE_MS / the `celebrate` state below.
function AllBoughtMark({ size, animate }) {
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={size / 2 - 1} fill="var(--accent-secondary-subtle)" />
      <path
        d={`M${size * 0.31} ${size * 0.52}l${size * 0.19} ${size * 0.19} ${size * 0.38}-${size * 0.42}`}
        stroke="var(--status-success)"
        strokeWidth={Math.max(1.6, size * 0.05)}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={size}
        strokeDashoffset={0}
        style={animate ? { animation: `ph-allbought-tick var(--duration-base) var(--ease-out) 120ms both` } : undefined}
      />
    </svg>
  );
}

export function ShoppingListTab({ onSyncTick, onOffline, active }) {
  const toast = useToast();
  const isDesktop = useIsDesktop();
  const { shouldAnimate } = useMotionConfig();
  const { nameFor, colorFor } = useListUsers();
  const { order: categoryOrder } = useCategoryOrder();
  const confirm = useConfirm();
  const { user: currentUser } = useAuth();
  const t = useTranslation();
  const { lang } = useLanguage();
  const [catalogue, setCatalogue] = useState([]);
  const [items, setItems] = useState(() => readCache(ITEMS_CACHE_KEY, []));
  // Other members who've polled the list in the last ~20s (see POST
  // /presence) — usernames, resolved to display names/colors for the avatar
  // row below the summary line.
  const [presentUsers, setPresentUsers] = useState([]);
  // Only true for a genuine cold load with nothing cached yet — once
  // hydrated from ITEMS_CACHE_KEY, subsequent fetches are silent background
  // refreshes rather than a loading state.
  const [loading, setLoading] = useState(() => readCache(ITEMS_CACHE_KEY, null) === null);
  const [viewMode, setViewMode] = useState(() => (localStorage.getItem("ph_view") === "grid" ? "grid" : "list"));
  const [addValue, setAddValue] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  // -1 = nothing arrow-key-highlighted in the suggestions dropdown (Enter
  // falls back to submitting addValue as typed, same as before this existed).
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [suggestedItems, setSuggestedItems] = useState([]);
  const [editingId, setEditingId] = useState(null);
  // "Recently bought" starts collapsed — it's a re-add palette, not something to
  // scroll past every time.
  const [boughtCollapsed, setBoughtCollapsed] = useState(() => localStorage.getItem("ph_bought_collapsed") !== "false");
  // Single active modal for the FAB menu's two destinations:
  // { type: "suggestions" | "weekIngredients" } | null
  const [modal, setModal] = useState(null);
  // Items mid "checked-off" animation: still rendered in their category, struck
  // through and fading out, before they re-sort into "Recently bought".
  const [resolvingIds, setResolvingIds] = useState(() => new Set());
  // "Recently bought" rows that just fell out of BOUGHT_CAP (see below) and
  // are mid synced-fade-out rather than having simply vanished — see the
  // cappedIdsKey effect and ItemCard's `evicting` prop.
  const [evictingIds, setEvictingIds] = useState(() => new Set());
  // Stale-item marker threshold (days), a per-list preference — see
  // /notification-settings and NotificationsSubpage.jsx. Falls back to the app
  // default until the first fetch resolves.
  const [staleItemDays, setStaleItemDays] = useState(7);
  // Pulls important, unbought items into their own "Important" section above the
  // normal aisle list instead of hiding the rest — useful for a trip where
  // you're not buying everything on the list. Not persisted: it's a
  // per-visit lens on the list, not a standing preference like ph_view.
  const [pinImportant, setPinImportant] = useState(false);
  // Count of offline writes waiting to be replayed (see src/lib/writeQueue.js
  // and TODO #113). Drives the "usendte" pill so a mid-shop add/toggle made
  // with no signal reads as saved-and-pending, not lost. Seeded from any
  // queue that survived an app close.
  const [pendingWrites, setPendingWrites] = useState(() => queueLength());
  // True only for the render right after the last unbought item's card has
  // actually finished leaving the screen — gates the "all bought" pop/tick
  // animation (see AllBoughtMark/CELEBRATE_MS above) so it plays once per
  // genuine "just finished shopping" transition, never on a render that
  // simply finds the list already fully bought (mount, the 7s poll, another
  // device's write, reopening the tab).
  const [celebrate, setCelebrate] = useState(false);

  const resolveTimers = useRef(new Map());
  const evictTimers = useRef(new Map());
  // Ids that were inside the capped "Recently bought" window on the last
  // render this was checked — compared against on every render to notice an
  // item that just fell out of BOUGHT_CAP while still bought, so it can be
  // handed a synced fade-out (evictingIds) instead of silently vanishing.
  const prevCappedIdsRef = useRef(new Set());
  const addInputRef = useRef(null);
  const suggestionRefs = useRef([]);
  // Id of the item whose resolve completion should trigger `celebrate` —
  // set by toggleItem only when that item was the last unbought one, read
  // by the resolvingIds effect below once that id actually finishes
  // resolving (not before: the pop should follow the row leaving, not
  // precede it).
  const pendingCelebrateId = useRef(null);
  const celebrateTimer = useRef(null);
  // Set once the resolvingIds effect confirms a genuine "just finished
  // shopping" transition, but — unlike the old direct setCelebrate(true) —
  // not acted on yet: the departing card has only just left React state at
  // that point, which is when its Framer `exit` animation *starts*, not
  // when it's actually gone from the screen. Firing the pop/EmptyState here
  // would show them overlapping the still-fading card, then jump up once it
  // really leaves. handleListExitComplete (passed to the list's
  // AnimatePresence as onExitComplete) is the actual trigger, so the
  // celebration only appears once the card has visually finished leaving.
  // markAllBought also sets this directly (see its own comment) since it has
  // no per-item resolvingIds hold to wait through first.
  const awaitingExitRef = useRef(false);
  // Mirrors `items` for handleListExitComplete, which fires from a Framer
  // callback and needs the latest list, not whatever was in scope when the
  // AnimatePresence render that's completing was produced.
  const itemsRef = useRef(items);
  itemsRef.current = items;

  async function loadCatalogue() {
    setCatalogue(await api("/catalogue"));
  }

  async function loadList() {
    // Replay any queued offline writes first, so the fetch below already
    // reflects them (the queued add is replayed → its real row comes back in
    // the snapshot, replacing our temp-id optimistic item). If the flush
    // can't drain the queue we're still offline: keep the optimistic state
    // and skip the fetch rather than overwriting it with stale server data.
    if (queueLength() > 0) {
      const { drained } = await flushQueue(api);
      setPendingWrites(queueLength());
      if (!drained) {
        onOffline();
        return;
      }
    }
    let fetched;
    try {
      fetched = await api("/list");
      onSyncTick();
    } catch {
      onOffline();
      return;
    }
    setItems(fetched);
    try {
      setSuggestedItems(await api("/catalogue/suggestions"));
    } catch {
      setSuggestedItems([]);
    }
    try {
      setPresentUsers(await api("/presence", { method: "POST" }));
    } catch {
      /* non-critical, keep whatever we had */
    }
  }

  // Only fires on true unmount (logout), not on pane switches — the tab stays
  // mounted (hidden via CSS) once visited, see AppShell.jsx.
  useEffect(() => {
    const timers = resolveTimers.current;
    const evTimers = evictTimers.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
      evTimers.forEach((t) => clearTimeout(t));
      evTimers.clear();
      clearTimeout(celebrateTimer.current);
    };
  }, []);

  // Framer's exit/layout (FLIP) tracking for a card can get permanently
  // stuck — frozen in place, blocking reflow of the rest of the list — if a
  // card's checked-off hold resolves (leaves the array, triggering
  // AnimatePresence's exit) while its pane is hidden (`display: none` in
  // AppShell) and the pane is then shown again. Rather than trying to time
  // that transition around visibility, force a clean remount of the whole
  // animated list every time the pane goes from hidden back to active: a
  // fresh AnimatePresence instance has no stale exit/projection state to
  // get stuck on, and `initial={false}` (see renderItems below) means the
  // remount itself doesn't play a mount-in animation — items just reappear
  // already in their correct, settled position. `renderGeneration` is the
  // `key` passed to that list wrapper.
  const [renderGeneration, setRenderGeneration] = useState(0);
  const wasActive = useRef(active);
  useEffect(() => {
    if (active && !wasActive.current) setRenderGeneration((g) => g + 1);
    wasActive.current = active;
  }, [active]);

  useEffect(() => {
    if (!active) return;
    loadCatalogue().then(loadList).finally(() => setLoading(false));
    const timer = setInterval(() => {
      if (!document.hidden) loadList();
    }, POLL_MS);
    // Replay queued offline writes the moment connectivity returns, rather
    // than waiting up to POLL_MS for the next tick (loadList flushes first).
    const onOnline = () => loadList();
    window.addEventListener("online", onOnline);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", onOnline);
    };
  }, [active]);

  // Persist the current (possibly optimistic) list on every change, not just
  // after a server fetch, so an offline-added/toggled item survives a reload
  // while still offline — its replay op lives in the write queue, and this
  // keeps the matching optimistic row on screen until that op syncs. Skips the
  // initial run so a cold open with nothing cached doesn't write an empty
  // array over the "no cache yet" signal `loading` reads on the next open.
  const didHydrate = useRef(false);
  useEffect(() => {
    if (!didHydrate.current) {
      didHydrate.current = true;
      return;
    }
    writeCache(ITEMS_CACHE_KEY, items);
  }, [items]);

  useEffect(() => {
    if (!active) return;
    api("/notification-settings").then((res) => {
      if (!res.error) setStaleItemDays(res.stale_item_days);
    });
  }, [active]);

  function setView(mode) {
    setViewMode(mode);
    localStorage.setItem("ph_view", mode);
  }

  // Shared by addItem/addSuggestedItem's offline paths: persist the add to the
  // write queue for replay, and drop a matching optimistic row on the list
  // (with a temp id — see writeQueue.newTempId) so it shows immediately and
  // survives a reload while still offline.
  function queueOfflineAdd({ name, category, notes, qty, exact }) {
    const tempId = newTempId();
    enqueue({ kind: "add", tempId, body: { name, qty: qty || 1, category, notes, exact } });
    const optimistic = {
      id: tempId,
      bought: 0,
      important: 0,
      added_by: currentUser,
      added_at: new Date().toISOString(),
      bought_at: null,
      qty: qty || 1,
      notes: notes ?? null,
      // The server capitalizes non-exact names; mirror that so the optimistic
      // row reads the same before and after it syncs.
      name: exact ? name : cap(name),
      category,
    };
    setItems((prev) => [...prev, optimistic]);
    setPendingWrites(queueLength());
  }

  async function addItem(rawText, { exact = false } = {}) {
    const typed = rawText;
    if (!typed.trim()) return;
    let name, category, notes, qty;
    if (exact) {
      name = typed.trim();
      category = "Other";
      qty = 1;
    } else {
      const { name: rawName, qty: parsedQty, unit } = parseItemInput(typed, catalogue);
      if (!rawName) return;
      const { name: baseName, gf } = extractGF(rawName);
      const { match, descriptor } = matchWithDescriptor(baseName, catalogue, lang);
      name = match ? match.name : baseName;
      category = match ? match.category : "Other";
      // Deliberately still Norwegian, unlike the canonical names/categories
      // around it: this is appended to list_items.notes, a free-text field
      // rendered raw with no translation layer. An English canonical value
      // here would surface untranslated in the Norwegian UI — same reasoning
      // that keeps meal names and typed ingredients as-is (CLAUDE.md's
      // Language support section). extractGF matches either language's marker.
      notes = buildItemNotes({ descriptor, unit, gf });
      qty = parsedQty;
    }
    setAddValue("");
    setSuggestions([]);
    setHighlightedIndex(-1);
    haptic();
    addInputRef.current?.focus();
    let res;
    try {
      res = await api("/list", {
        method: "POST",
        body: JSON.stringify({ name, qty: qty || 1, category, notes, exact }),
      });
    } catch (e) {
      if (e.message === "network") {
        queueOfflineAdd({ name, category, notes, qty, exact });
        toast(t("shoppingList.toast.savedOffline"));
        return;
      }
      setAddValue(typed);
      toast(t("shoppingList.toast.addFailed"), { error: true });
      return;
    }
    if (res?.error) {
      setAddValue(typed);
      toast(apiErrorMessage(res, t), { error: true });
      return;
    }
    if (res?.duplicate) {
      toast(t("shoppingList.toast.duplicateIncreased", { name: cap(translateItemName(name, lang)), qty: res.qty }));
    }
    await loadCatalogue();
    loadList();
  }

  async function addSuggestedItem(it) {
    setSuggestedItems((prev) => prev.filter((s) => s.id !== it.id));
    try {
      await api("/list", { method: "POST", body: JSON.stringify({ name: it.name, qty: 1, category: it.category }) });
    } catch (e) {
      if (e.message === "network") {
        queueOfflineAdd({ name: it.name, category: it.category, qty: 1 });
        toast(t("shoppingList.toast.savedOffline"));
        return;
      }
      toast(t("shoppingList.toast.addFailed"), { error: true });
      return;
    }
    await loadCatalogue();
    loadList();
  }

  // Starts the fallback timer that moves a checked-off item out of the array
  // when there's no Framer animation to key off (see FALLBACK_RESOLVE_MS).
  // When Framer is animating the card, ItemCard calls clearResolving itself
  // once the real pop animation completes, and this timer never fires.
  function scheduleResolve(id) {
    if (shouldAnimate) return;
    const existing = resolveTimers.current.get(id);
    if (existing) clearTimeout(existing);
    resolveTimers.current.set(
      id,
      setTimeout(() => {
        resolveTimers.current.delete(id);
        setResolvingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, FALLBACK_RESOLVE_MS)
    );
  }

  // scheduleResolve's counterpart for a "Recently bought" row that's just
  // been pushed past BOUGHT_CAP: starts the fallback timer that finally drops
  // it from evictingIds when there's no Framer animation to key off (see
  // EVICT_MS). When Framer is animating the card, ItemCard calls
  // clearEvicting itself once the real fade-out completes, same relationship
  // as scheduleResolve/clearResolving above.
  function scheduleEvict(id) {
    if (shouldAnimate) return;
    const existing = evictTimers.current.get(id);
    if (existing) clearTimeout(existing);
    evictTimers.current.set(
      id,
      setTimeout(() => {
        evictTimers.current.delete(id);
        setEvictingIds((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, EVICT_MS)
    );
  }

  async function toggleItem(id) {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    haptic();
    const wasBought = it.bought;
    const wasImportant = it.important;
    // Checking off the last unbought item on the list — flag it so the
    // celebration effect above plays once this item's own resolve finishes
    // (not immediately: see that effect's comment).
    if (!wasBought && items.every((x) => x.id === id || x.bought)) {
      pendingCelebrateId.current = id;
    }
    // Important is scoped to this trip, so checking an item off also clears
    // it (mirrored server-side in the /toggle handler) — undoing the bought
    // mark doesn't bring it back, same as the server.
    setItems((prev) =>
      prev.map((x) => (x.id === id ? { ...x, bought: wasBought ? 0 : 1, important: wasBought ? x.important : 0 } : x))
    );
    // Checking off (not un-checking): hold the row in place so the
    // strike-through + fade play before it re-sorts into "Recently bought". The
    // reorder is driven by this local timer, not by the network round-trip.
    if (!wasBought) {
      setResolvingIds((prev) => new Set(prev).add(id));
      scheduleResolve(id);
    }
    try {
      await api(`/list/${id}/toggle`, { method: "POST" });
    } catch (e) {
      if (e.message === "network") {
        // Keep the optimistic flip (and its "Recently bought" re-sort); queue the
        // toggle to replay on reconnect instead of reverting it.
        enqueue({ kind: "toggle", targetId: id });
        setPendingWrites(queueLength());
        return;
      }
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, bought: wasBought, important: wasImportant } : x)));
      clearResolving(id);
      toast(t("shoppingList.toast.updateFailed"), { error: true });
    }
  }

  async function toggleImportant(id) {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    haptic();
    const wasImportant = it.important;
    setItems((prev) =>
      prev.map((x) => (x.id === id ? { ...x, important: wasImportant ? 0 : 1 } : x))
    );
    try {
      await api(`/list/${id}`, { method: "PATCH", body: JSON.stringify({ important: !wasImportant }) });
    } catch (e) {
      if (e.message === "network") {
        enqueue({ kind: "important", targetId: id, important: !wasImportant });
        setPendingWrites(queueLength());
        return;
      }
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, important: wasImportant } : x)));
      toast(t("shoppingList.toast.updateFailed"), { error: true });
    }
  }

  // On-demand "get the other person's attention" ping (TODO #7 phase 2) —
  // pushes to every other subscribed device on the list. The backend
  // enforces a 2-minute per-list cooldown (429), surfaced here as a toast
  // rather than disabling the button, since there's no cheap way to know
  // client-side whether the cooldown is currently active.
  async function pingHousehold() {
    haptic();
    try {
      const res = await api("/push/ping", { method: "POST" });
      if (res.error) {
        toast(apiErrorMessage(res, t), { error: true });
        return;
      }
      toast(t("shoppingList.toast.pingSent"));
    } catch {
      toast(t("shoppingList.toast.genericError"), { error: true });
    }
  }

  function clearResolving(id) {
    const t = resolveTimers.current.get(id);
    if (t) {
      clearTimeout(t);
      resolveTimers.current.delete(id);
    }
    setResolvingIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  // clearResolving's counterpart for a "Recently bought" row that just
  // finished its synced fade-out — passed to renderItems as the bought
  // section's onEvicted, called by ItemCard's onAnimationComplete once the
  // real `evicting` animation is done.
  function clearEvicting(id) {
    const t = evictTimers.current.get(id);
    if (t) {
      clearTimeout(t);
      evictTimers.current.delete(id);
    }
    setEvictingIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function onAddInputChange(v) {
    setAddValue(v);
    setHighlightedIndex(-1);
    if (!v.trim()) {
      setSuggestions([]);
      return;
    }
    const { name: query } = parseItemInput(v, catalogue);
    const { name: base } = extractGF(query);
    setSuggestions(matchCatalogue(base, catalogue, lang).slice(0, 6));
  }

  useEffect(() => {
    if (highlightedIndex === -1) return;
    suggestionRefs.current[highlightedIndex]?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex]);

  function focusAddInput() {
    addInputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    addInputRef.current?.focus();
  }

  function toggleBoughtCollapsed() {
    setBoughtCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("ph_bought_collapsed", String(next));
      return next;
    });
  }

  // End-of-trip sweep: marks every still-unbought item bought in one shot
  // instead of one at a time. Confirmed first since it's a bulk mutation
  // visible to the whole household; online-only (not part of the offline
  // write queue, which is scoped to add/toggle/important).
  async function markAllBought() {
    if (
      !(await confirm(t("shoppingList.confirm.markAllBought.body"), {
        title: t("shoppingList.confirm.markAllBought.title"),
        confirmLabel: t("shoppingList.confirm.markAllBought.confirmLabel"),
      }))
    )
      return;
    const snapshot = items;
    haptic();
    // Unlike toggleItem's last-item case, there's no per-item resolve delay
    // to wait for here — every item flips at once, so there's no
    // pendingCelebrateId/resolvingIds dance to go through first. But the
    // departing cards still need their own Framer exit animation to finish
    // before the celebration appears (see handleListExitComplete/
    // awaitingExitRef above), same as the single-toggle path.
    if (items.some((it) => !it.bought)) {
      awaitingExitRef.current = true;
    }
    const boughtAt = new Date().toISOString();
    setItems((prev) => prev.map((it) => (it.bought ? it : { ...it, bought: 1, bought_at: boughtAt, important: 0 })));
    try {
      await api("/list/mark-all-bought", { method: "POST" });
    } catch {
      setItems(snapshot);
      awaitingExitRef.current = false;
      setCelebrate(false);
      clearTimeout(celebrateTimer.current);
      toast(t("shoppingList.toast.markAllBoughtFailed"), { error: true });
      return;
    }
    loadList();
  }

  // A just-checked item stays in its category (struck through, fading) until
  // its resolve timer fires — only then does it move to "Recently bought".
  const unbought = items.filter((it) => !it.bought || resolvingIds.has(it.id));
  const bought = items
    .filter((it) => it.bought && !resolvingIds.has(it.id))
    .sort((a, b) => (b.bought_at || "").localeCompare(a.bought_at || ""));
  // Important-item count driving the pinImportant chip — bought items don't
  // count, since they're no longer something to look out for on this trip.
  const importantUnbought = unbought.filter((it) => it.important);
  // Disarm the "Important" lens once nothing important remains unbought, so it
  // doesn't silently re-engage the next time an item is starred while the chip
  // is gone (#97). No render-generation bump needed: with the important list
  // empty, the pinned/unpinned layouts are identical, so nothing visibly moves.
  useEffect(() => {
    if (pinImportant && importantUnbought.length === 0) setPinImportant(false);
  }, [pinImportant, importantUnbought.length]);

  // Flags the row toggleItem marked as "the last one" once it's actually
  // finished resolving (left resolvingIds) — that's when it drops out of
  // displayItems and starts its Framer exit animation, so this only arms
  // awaitingExitRef rather than celebrating yet (see that ref's comment).
  // Re-checks the list is genuinely all bought first: a reverted/failed
  // toggle also clears resolvingIds, and that shouldn't arm the celebration.
  useEffect(() => {
    const id = pendingCelebrateId.current;
    if (id == null || resolvingIds.has(id)) return;
    pendingCelebrateId.current = null;
    if (items.length > 0 && items.every((it) => it.bought)) {
      awaitingExitRef.current = true;
    }
  }, [resolvingIds, items]);

  // The actual celebration trigger — passed to the unbought list's
  // AnimatePresence as onExitComplete, so it fires once the departing card(s)
  // have visually finished leaving, not merely left React state (see
  // awaitingExitRef above). Re-checks all-bought again since more time has
  // passed since awaitingExitRef was armed.
  function handleListExitComplete() {
    if (!awaitingExitRef.current) return;
    awaitingExitRef.current = false;
    if (itemsRef.current.length > 0 && itemsRef.current.every((it) => it.bought)) {
      setCelebrate(true);
      clearTimeout(celebrateTimer.current);
      celebrateTimer.current = setTimeout(() => setCelebrate(false), CELEBRATE_MS);
    }
  }
  const pinnedIds = pinImportant ? new Set(importantUnbought.map((it) => it.id)) : null;
  const groups = {};
  for (const it of unbought) {
    if (pinnedIds?.has(it.id)) continue; // pulled into importantDisplayItems instead
    (groups[it.category] = groups[it.category] || []).push(it);
  }
  // One flat, aisle-sorted list: unbought items ordered by the list's custom
  // aisle order (TODO #105, from CategoryOrderContext — falls back to the
  // canonical CATEGORIES order until loaded). Recently bought items (capped,
  // re-add palette) render as their own section below instead of being folded
  // into the aisle list — see boughtDisplayItems. When pinImportant is on,
  // important items are pulled out above into their own "Important" section (see
  // importantDisplayItems) instead of appearing here too — same "own section,
  // not a duplicate" split as bought items.
  const displayItems = categoryOrder.filter((c) => groups[c]).flatMap((c) =>
    groups[c].map((it) => ({ item: it, clusterKey: it.category }))
  );
  const importantDisplayItems = pinImportant
    ? importantUnbought.map((it) => ({ item: it, clusterKey: "Important" }))
    : [];
  // Classic intensity only turns off motion (see useMotionConfig) — it no
  // longer overrides the user's stored grid/list preference, so this just
  // mirrors viewMode directly.
  const effectiveViewMode = viewMode;
  // Desktop widens both views into multi-column grids/rows, in every
  // intensity — classic just renders them without the reflow animation.
  // On phone these resolve to the exact same two style objects as before.
  const containerStyle = effectiveViewMode === "grid"
    ? (isDesktop ? desktopGridStyle : gridStyle)
    : (isDesktop ? desktopListStyle : listStyle);
  // Fixed regardless of view mode so toggling grid/list only changes layout,
  // not which items show — a view-dependent cap (previously 9 in grid vs. 3
  // in list, to fill 3 grid rows vs. 3 list rows) made items appear/disappear
  // on toggle, which read as a bug rather than an intentional density choice.
  const BOUGHT_CAP = 9;
  const cappedBought = bought.slice(0, BOUGHT_CAP);
  const cappedIds = new Set(cappedBought.map((it) => it.id));
  // Still-bought rows that fell out of the cap but are mid synced-fade (see
  // the effect below) — appended after the capped ones so a freshly-evicted
  // row keeps its trailing position while it fades out, instead of the array
  // silently dropping it a frame before its own animation gets to play.
  const evictingBought = bought.filter((it) => evictingIds.has(it.id) && !cappedIds.has(it.id));
  const boughtDisplayItems = [...cappedBought, ...evictingBought].map((it) => ({
    item: it,
    clusterKey: "Recently bought",
    evicting: !cappedIds.has(it.id),
  }));
  // Notices an item that was inside the BOUGHT_CAP window on the previous
  // render but has just been pushed out by a newer arrival, and hands it a
  // synced fade-out (evictingIds) instead of letting it vanish silently —
  // previously a plain slice(0, BOUGHT_CAP) cutoff, which let the section
  // balloon to BOUGHT_CAP+1 rows for however long the evicted card's default
  // exit animation took before it noticed the item was gone. A layout effect
  // (not a plain effect) so the corrected render — re-including the
  // freshly-evicted item, now flagged `evicting` — commits before the browser
  // paints, instead of the row flashing away for a frame first. Guarded on
  // `bought` still containing the id: an item leaving because the user
  // un-toggled it (not because of the cap) isn't in `bought` at all anymore,
  // and keeps its normal AnimatePresence exit instead of this synced one.
  const cappedIdsKey = [...cappedIds].join(",");
  useLayoutEffect(() => {
    const boughtIds = new Set(bought.map((it) => it.id));
    prevCappedIdsRef.current.forEach((id) => {
      if (!cappedIds.has(id) && boughtIds.has(id) && !evictingIds.has(id)) {
        setEvictingIds((prev) => new Set(prev).add(id));
        scheduleEvict(id);
      }
    });
    prevCappedIdsRef.current = cappedIds;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cappedIdsKey]);
  // Count genuinely-remaining items (a resolving item is on its way out, so it
  // shouldn't hold the counter up even though it's still rendered in place).
  const remaining = items.filter((it) => !it.bought).length;
  const summary = remaining
    ? t("shoppingList.summary.itemsLeft", { count: remaining })
    : items.length
      ? t("shoppingList.summary.allBought")
      : "";
  // Distinct from a truly empty list (items.length === 0, handled by
  // EmptyState below) — this is "had items, all of them are bought now",
  // which "Recently bought" being collapsed-not-gone means can sit around
  // indefinitely until either a new item's added or bought items are
  // cleared. See AllBoughtMark/celebrate above for the animated vs. static
  // distinction.
  const allBought = remaining === 0 && items.length > 0;
  // remaining flips to 0 the instant the last item's optimistically marked
  // bought — before its own strike-through/fade finishes (it stays in
  // `unbought`/`displayItems` via resolvingIds until then), and even once
  // that's done, the card still needs its own Framer exit animation to
  // finish leaving the screen. Showing the celebratory pill/marker/block
  // before either of those has actually settled would overlap the still-
  // departing card and then jump as it left. So the upgraded UI waits for
  // both pendingCelebrateId to clear (the strike-through/fade is done) and
  // awaitingExitRef to clear (the card has visually left, via
  // handleListExitComplete) — during a genuine toggle/markAllBought that's
  // exactly when both have happened; on every other render (mount, poll,
  // another device's write) neither was ever set, so this is true
  // immediately. Until then, the summary falls back to the plain-text "All
  // done" it always showed, unchanged.
  const allBoughtSettled = allBought && pendingCelebrateId.current == null && !awaitingExitRef.current;
  const editingItem = editingId != null ? items.find((it) => it.id === editingId) : null;
  const importantChipLabel = t(
    pinImportant ? "shoppingList.importantChip.showAll" : "shoppingList.importantChip.showImportantFirst"
  );
  // Label names the action the press performs (like a play/pause button),
  // not the current state — there's only one hit target now, so "which view
  // is this" isn't a separate question from "what does pressing it do."
  const viewToggleLabel = t(effectiveViewMode === "list" ? "shoppingList.viewToggle.switchToGrid" : "shoppingList.viewToggle.switchToList");

  return (
    <section>
      <div style={{ marginBottom: 16, position: "relative" }}>
        <Input
          ref={addInputRef}
          placeholder={t("shoppingList.addInput.placeholder")}
          autoComplete="off"
          icon="carrot"
          value={addValue}
          onChange={(e) => onAddInputChange(e.target.value)}
          onKeyDown={(e) => {
            const exactOptionShown = Boolean(addValue.trim());
            const optionCount = suggestions.length + (exactOptionShown ? 1 : 0);
            if (e.key === "ArrowDown") {
              if (!optionCount) return;
              e.preventDefault();
              setHighlightedIndex((i) => (i + 1) % optionCount);
              return;
            }
            if (e.key === "ArrowUp") {
              if (!optionCount) return;
              e.preventDefault();
              setHighlightedIndex((i) => (i <= 0 ? optionCount - 1 : i - 1));
              return;
            }
            if (e.key === "Escape") {
              if (highlightedIndex === -1) return;
              e.preventDefault();
              setHighlightedIndex(-1);
              return;
            }
            if (e.key === "Enter") {
              e.preventDefault();
              if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
                const m = suggestions[highlightedIndex];
                const { gf } = extractGF(parseItemInput(addValue, catalogue).name);
                addItem(cap(translateItemName(m.name, lang)) + (gf ? " GF" : ""));
              } else if (highlightedIndex === suggestions.length && exactOptionShown) {
                addItem(addValue, { exact: true });
              } else {
                addItem(addValue);
              }
            }
          }}
        />
        {suggestions.length > 0 || addValue.trim() ? (
          <div
            style={{
              position: "absolute",
              top: 52,
              left: 0,
              right: 0,
              background: "var(--surface-card)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-md)",
              zIndex: 20,
              maxHeight: 220,
              overflowY: "auto",
              boxShadow: "var(--shadow-raised)",
            }}
          >
            {suggestions.map((m, i) => {
              const { gf } = extractGF(parseItemInput(addValue, catalogue).name);
              const label = cap(translateItemName(m.name, lang)) + (gf ? " GF" : "");
              // Adding a name that's already an unbought line on the list
              // merges into that line's qty server-side (see /list POST's
              // duplicate-merge) rather than creating a second row — flag it
              // here so that's a visible choice, not a surprise qty bump.
              const onList = items.some((it) => !it.bought && it.name === m.name);
              return (
                <div
                  key={m.id}
                  ref={(el) => (suggestionRefs.current[i] = el)}
                  style={{
                    padding: "12px 14px",
                    cursor: "pointer",
                    color: "var(--text-primary)",
                    background: highlightedIndex === i ? "var(--surface-sunken)" : undefined,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                  onMouseEnter={() => setHighlightedIndex(i)}
                  onClick={() => addItem(label)}
                >
                  <span>{label}</span>
                  {onList && (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 12,
                        color: "var(--text-tertiary)",
                        flexShrink: 0,
                      }}
                    >
                      <UiIcon name="check" size={12} />
                      {t("shoppingList.addInput.alreadyOnList")}
                    </span>
                  )}
                </div>
              );
            })}
            {addValue.trim() && (
              <div
                ref={(el) => (suggestionRefs.current[suggestions.length] = el)}
                style={{
                  padding: "12px 14px",
                  cursor: "pointer",
                  fontStyle: "italic",
                  color: "var(--text-tertiary)",
                  background: highlightedIndex === suggestions.length ? "var(--surface-sunken)" : undefined,
                }}
                onMouseEnter={() => setHighlightedIndex(suggestions.length)}
                onClick={() => addItem(addValue, { exact: true })}
              >
                {t("shoppingList.addInput.exactOption", { value: addValue.trim() })}
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 16 }}>
          {allBoughtSettled ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: "var(--text-xs)",
                fontWeight: 700,
                color: "var(--status-success)",
                background: "var(--accent-secondary-subtle)",
                borderRadius: "var(--radius-pill)",
                padding: "4px 10px 4px 8px",
                ...(celebrate && shouldAnimate
                  ? { animation: "ph-allbought-pop var(--spring-duration-soft) var(--ease-spring-soft)" }
                  : null),
              }}
            >
              <AllBoughtMark size={14} animate={celebrate && shouldAnimate} />
              {summary}
            </span>
          ) : (
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>{summary}</span>
          )}
          {pendingWrites > 0 && (
            <span
              title={t("shoppingList.pendingWrites.tooltip")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 3,
                borderRadius: "var(--radius-pill)",
                padding: "3px 8px",
                fontSize: "var(--text-2xs)",
                fontWeight: "var(--weight-semibold)",
                background: "var(--surface-sunken)",
                color: "var(--text-tertiary)",
              }}
            >
              <UiIcon name="cloud-slash" size={12} />
              {pendingWrites}
            </span>
          )}
          {importantUnbought.length > 0 && (
            <BaseButton
              onClick={() => {
                // Same "force a clean remount" move as the active-pane
                // effect above: an item moving between this section and the
                // main list reuses its id as AnimatePresence's key, and
                // toggling that key's membership across two renders of the
                // *same* AnimatePresence instance left it stuck invisible
                // after re-entering — a fresh instance (initial={false}, so
                // no mount-in animation) sidesteps that instead of chasing
                // Framer's internal exit-tracking.
                setRenderGeneration((g) => g + 1);
                setPinImportant((prev) => !prev);
              }}
              aria-pressed={pinImportant}
              aria-label={importantChipLabel}
              title={importantChipLabel}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                border: "none",
                borderRadius: "var(--radius-pill)",
                padding: "3px 8px",
                fontSize: "var(--text-2xs)",
                fontWeight: "var(--weight-semibold)",
                background: pinImportant ? "var(--accent-tertiary)" : "var(--accent-tertiary-subtle)",
                color: pinImportant ? "var(--text-on-accent)" : "var(--accent-tertiary)",
              }}
              pressStyle={IMPORTANT_CHIP_PRESS_STYLE}
            >
              <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={STAR_PATH} />
              </svg>
              {importantUnbought.length}
            </BaseButton>
          )}
          {presentUsers.length > 0 && (
            <div
              style={{ display: "flex", alignItems: "center" }}
              title={t("shoppingList.presence.alsoHere", { names: presentUsers.map(nameFor).join(", ") })}
            >
              {presentUsers.map((u, i) => (
                <div key={u} style={{ marginLeft: i === 0 ? 0 : -8, border: "2px solid var(--surface-page)", borderRadius: "50%" }}>
                  <Avatar name={nameFor(u)} color={colorFor(u)} size={20} />
                </div>
              ))}
            </div>
          )}
        </div>
        <BaseButton
          onClick={() => setView(effectiveViewMode === "list" ? "grid" : "list")}
          aria-label={viewToggleLabel}
          title={viewToggleLabel}
          style={VIEW_TOGGLE_STYLE}
        >
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              zIndex: 0,
              top: 3,
              bottom: 3,
              left: 3,
              width: "calc(50% - 5px)",
              background: "var(--accent-primary)",
              borderRadius: "var(--radius-pill)",
              transform: effectiveViewMode === "grid" ? "translateX(calc(100% + 4px))" : "translateX(0)",
              transition: "transform var(--spring-duration-soft) var(--ease-spring-soft)",
            }}
          />
          <span style={viewToggleIconStyle(effectiveViewMode === "list")}>
            <UiIcon name="list" size={16} />
          </span>
          <span style={viewToggleIconStyle(effectiveViewMode === "grid")}>
            <UiIcon name="grid" size={16} />
          </span>
        </BaseButton>
      </div>

      {loading ? (
        <ShoppingListSkeleton viewMode={effectiveViewMode} containerStyle={containerStyle} />
      ) : items.length === 0 ? (
        <EmptyState
          illustration={<EmptyListIllustration />}
          title={t("shoppingList.empty.title")}
          description={t("shoppingList.empty.description")}
        />
      ) : (
        <>
          {importantDisplayItems.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: "var(--text-2xs)",
                  fontWeight: 700,
                  color: clusterFor("Important").on,
                  textTransform: "uppercase",
                  letterSpacing: "var(--tracking-wide)",
                  marginBottom: 8,
                }}
              >
                {t("shoppingList.section.important")}
              </div>
              {renderItems(importantDisplayItems, effectiveViewMode, containerStyle, resolvingIds, toggleItem, toggleImportant, setEditingId, renderGeneration, clearResolving, staleItemDays, handleListExitComplete)}
            </div>
          )}
          {renderItems(displayItems, effectiveViewMode, containerStyle, resolvingIds, toggleItem, toggleImportant, setEditingId, renderGeneration, clearResolving, staleItemDays, handleListExitComplete)}

          {allBoughtSettled && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 4px 16px",
                ...(celebrate && shouldAnimate
                  ? { animation: "ph-allbought-pop var(--spring-duration-soft) var(--ease-spring-soft)" }
                  : null),
              }}
            >
              <AllBoughtMark size={32} animate={celebrate && shouldAnimate} />
              <div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-secondary)" }}>
                  {t("shoppingList.allBought.title")}
                </div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
                  {t("shoppingList.allBought.description")}
                </div>
              </div>
            </div>
          )}

          {boughtDisplayItems.length > 0 && (
            <div style={{ marginTop: 28 }}>
              <BaseButton
                onClick={toggleBoughtCollapsed}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "none",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  fontFamily: "var(--font-sans)",
                  fontSize: "var(--text-2xs)",
                  fontWeight: 700,
                  color: clusterFor("Recently bought").on,
                  textTransform: "uppercase",
                  letterSpacing: "var(--tracking-wide)",
                  padding: "4px 6px",
                  marginLeft: -6,
                  marginBottom: boughtCollapsed ? 0 : 8,
                }}
              >
                <span>{t("shoppingList.section.recentlyBought")}</span>
                <UiIcon
                  name="chevronDown"
                  size={14}
                  style={{
                    transition: "transform var(--duration-fast) var(--ease-out)",
                    transform: boughtCollapsed ? "rotate(-90deg)" : "none",
                  }}
                />
              </BaseButton>
              {/* No onToggleImportant here: a bought item's important flag is
                  always cleared server-side (see toggleItem/worker's /toggle
                  handler), so marking one important here would have nothing
                  to persist — ItemCard hides the badge and swipe gesture
                  entirely when this is undefined. */}
              {/* staleItemDays/onExitComplete (positions 10-11) stay undefined here: the
                  stale marker never applies to a bought item, and the celebration effect
                  only cares about the unbought section's exit — see clearEvicting as
                  onEvicted (position 12) for this section's own cap-eviction fade. */}
              {!boughtCollapsed && renderItems(boughtDisplayItems, effectiveViewMode, containerStyle, resolvingIds, toggleItem, undefined, setEditingId, renderGeneration, clearResolving, undefined, undefined, clearEvicting)}
            </div>
          )}
        </>
      )}

      <FabMenu
        label={t("shoppingList.fab.label")}
        haptic={haptic}
        actions={[
          {
            icon: "cooking-pot",
            label: t("shoppingList.fab.fromMealPlan"),
            onClick: () => setModal({ type: "weekIngredients" }),
          },
          {
            icon: "sparkle",
            label: t("shoppingList.fab.suggestions"),
            badge: suggestedItems.length || null,
            onClick: () => setModal({ type: "suggestions" }),
          },
          {
            icon: "bell-ringing",
            label: t("shoppingList.fab.notifyHousehold"),
            onClick: pingHousehold,
          },
          // Only offered while there's something left to mark — an
          // all-bought list has nothing for this action to do.
          ...(unbought.length > 0
            ? [
                {
                  icon: "checks",
                  label: t("shoppingList.fab.markAllBought"),
                  onClick: markAllBought,
                },
              ]
            : []),
        ]}
        badge={
          suggestedItems.length > 0 ? (
            <span
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                minWidth: 20,
                height: 20,
                padding: "0 5px",
                borderRadius: "var(--radius-pill)",
                background: "var(--warm-900)",
                color: "var(--text-on-accent)",
                fontSize: 11,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 1,
                boxShadow: "var(--shadow-sm)",
              }}
            >
              {suggestedItems.length}
            </span>
          ) : null
        }
      />

      {editingItem && (
        <ItemEditModal
          // Keyed on the item id so switching straight from one item's editor
          // to another's (e.g. a long-press on a different card while the
          // first one is still mid-close-animation, see Modal.jsx/Sheet.jsx)
          // forces a clean remount instead of reusing a Modal instance whose
          // internal `open`/close state belongs to the previous item — which
          // left the sheet stuck mid-close, its full-screen backdrop still
          // swallowing every tap/scroll.
          key={editingId}
          item={editingItem}
          onClose={() => setEditingId(null)}
          onSaved={async () => {
            setEditingId(null);
            await loadCatalogue();
            loadList();
          }}
          onDeletedFromCatalogue={async () => {
            setEditingId(null);
            await loadCatalogue();
            loadList();
          }}
        />
      )}

      {modal?.type === "suggestions" && (
        <SuggestionsModal
          suggestions={suggestedItems}
          onAdd={(it) => addSuggestedItem(it)}
          onClose={() => setModal(null)}
          onFocusAdd={focusAddInput}
        />
      )}

      {modal?.type === "weekIngredients" && (
        <WeekIngredientsModal
          onClose={() => setModal(null)}
          onAdded={async () => {
            await loadCatalogue();
            loadList();
          }}
        />
      )}
    </section>
  );
}

function renderItems(displayItems, viewMode, containerStyle, resolvingIds, onToggle, onToggleImportant, onEdit, renderGeneration, onResolved, staleItemDays, onExitComplete, onEvicted) {
  return (
    <div key={renderGeneration} style={containerStyle}>
      <AnimatePresence initial={false} mode="popLayout" onExitComplete={onExitComplete}>
        {displayItems.map(({ item, clusterKey, evicting }, index) => {
          const { bg, on } = clusterFor(clusterKey);
          return (
            <ItemCard
              key={item.id}
              item={item}
              clusterOn={on}
              clusterBg={bg}
              resolving={!!resolvingIds?.has(item.id)}
              evicting={!!evicting}
              onToggle={onToggle}
              onToggleImportant={onToggleImportant}
              onEdit={onEdit}
              onResolved={onResolved}
              onEvicted={onEvicted}
              viewMode={viewMode}
              index={index}
              staleItemDays={staleItemDays}
            />
          );
        })}
      </AnimatePresence>
    </div>
  );
}

// The two icons are inert labels riding on top of the single toggle button
// now (see the view-toggle button above), not separate click targets — a
// press anywhere on the pill flips effectiveViewMode regardless of which
// icon it lands on.
function viewToggleIconStyle(active) {
  return {
    position: "relative",
    zIndex: 1,
    color: active ? "var(--text-on-accent)" : "var(--text-tertiary)",
    padding: "6px 10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "color 150ms var(--ease-out)",
  };
}
