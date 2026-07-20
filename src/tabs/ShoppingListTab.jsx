import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { api } from "../lib/api.js";
import { useToast } from "../context/ToastContext.jsx";
import { useListUsers } from "../context/ListUsersContext.jsx";
import { CATEGORIES, cap, parseItemInput, extractGF, matchCatalogue, haptic } from "../lib/shoppingUtils.js";
import { clusterFor } from "../lib/categoryClusters.js";
import { avatarColorFor } from "../lib/avatarColor.js";
import { useDesignIntensity } from "../hooks/useDesignIntensity.js";
import { useMotionConfig } from "../hooks/useMotionConfig.js";
import { ItemCard } from "../components/ItemCard.jsx";
import { ItemEditModal } from "../components/ItemEditModal.jsx";
import { SuggestionsModal } from "../components/SuggestionsModal.jsx";
import { UiIcon } from "../components/UiIcon.jsx";
import { WeekIngredientsModal } from "../components/meals/WeekIngredientsModal.jsx";
import { Input, Avatar, FabMenu, Skeleton, EmptyState } from "../design-system/index.js";
import { readCache, writeCache } from "../lib/localCache.js";

const POLL_MS = 7000;
// Last-fetched list, hydrated on mount so a returning user sees real items
// instantly instead of a skeleton/spinner on every cold open — see
// loadList()/CLAUDE.md's loading-UI notes.
const ITEMS_CACHE_KEY = "ph_cache_items_v1";
// Fallback hold before a checked-off item re-sorts into "Nylig kjøpt" when
// Framer's animation is off (reduced motion, or "classic" intensity) — there's
// no pop animation to key off in that case, so this is a deliberately fixed,
// standalone pause, not tied to any animation's duration. When Framer IS
// animating the card (see ItemCard's onAnimationComplete), the resolve fires
// off the real animation finishing instead of this constant.
const FALLBACK_RESOLVE_MS = 400;

// Cap track width at 1/3 of the row (minus the two 8px gaps) so auto-fit
// never lays out more than 3 columns, while still stretching a short last
// row to fill the width — plain minmax(140px, 1fr) only ever fit 2 columns
// on typical phone widths.
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(140px, (100% - 16px) / 3), 1fr))", gap: 8 };
const listStyle = { display: "flex", flexDirection: "column", gap: 8 };

// Same star path ItemCard's importance badge/swipe-reveal draws — kept as a
// literal here too (not imported), same self-contained-illustration reasoning
// as ImportantInfoModal's copy: this is the pinImportant toggle chip's icon,
// not a real item row.
const STAR_PATH = "M12 2.5l2.9 6.2 6.6.8-4.9 4.5 1.3 6.6-5.9-3.3-5.9 3.3 1.3-6.6-4.9-4.5 6.6-.8z";

// Cold-load placeholder, shaped like a couple of categories worth of items —
// a category label bar plus a handful of item-card-shaped blocks — so first
// paint reserves roughly the real layout instead of a spinner with nothing
// underneath it.
function ShoppingListSkeleton({ viewMode }) {
  const groups = [3, 2];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {groups.map((count, i) => (
        <div key={i}>
          <Skeleton width={100} height={11} radius={4} style={{ marginBottom: 8 }} />
          <div style={viewMode === "grid" ? gridStyle : listStyle}>
            {Array.from({ length: count }).map((_, j) => (
              <Skeleton key={j} height={viewMode === "grid" ? 64 : 44} radius={12} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ShoppingListTab({ onSyncTick, onOffline, active }) {
  const toast = useToast();
  const intensity = useDesignIntensity();
  const { shouldAnimate } = useMotionConfig();
  const { nameFor } = useListUsers();
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
  const [suggestedItems, setSuggestedItems] = useState([]);
  const [editingId, setEditingId] = useState(null);
  // "Nylig kjøpt" starts collapsed — it's a re-add palette, not something to
  // scroll past every time.
  const [boughtCollapsed, setBoughtCollapsed] = useState(() => localStorage.getItem("ph_bought_collapsed") !== "false");
  // Single active modal for the FAB menu's two destinations:
  // { type: "suggestions" | "weekIngredients" } | null
  const [modal, setModal] = useState(null);
  // Items mid "checked-off" animation: still rendered in their category, struck
  // through and fading out, before they re-sort into "Nylig kjøpt".
  const [resolvingIds, setResolvingIds] = useState(() => new Set());
  // Stale-item marker threshold (days), a per-list preference — see
  // /notification-settings and VarslerSubpage.jsx. Falls back to the app
  // default until the first fetch resolves.
  const [staleItemDays, setStaleItemDays] = useState(7);
  // Pulls important, unbought items into their own "Viktig" section above the
  // normal aisle list instead of hiding the rest — useful for a trip where
  // you're not buying everything on the list. Not persisted: it's a
  // per-visit lens on the list, not a standing preference like ph_view.
  const [pinImportant, setPinImportant] = useState(false);

  const resolveTimers = useRef(new Map());
  const addInputRef = useRef(null);

  async function loadCatalogue() {
    setCatalogue(await api("/catalogue"));
  }

  async function loadList() {
    let fetched;
    try {
      fetched = await api("/list");
      onSyncTick();
    } catch {
      onOffline();
      return;
    }
    setItems(fetched);
    writeCache(ITEMS_CACHE_KEY, fetched);
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
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
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
    return () => clearInterval(timer);
  }, [active]);

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

  async function addItem(rawText, { exact = false } = {}) {
    const typed = rawText;
    if (!typed.trim()) return;
    let name, category, notes, qty;
    if (exact) {
      name = typed.trim();
      category = "Annet";
      qty = 1;
    } else {
      const { name: rawName, qty: parsedQty, unit } = parseItemInput(typed, catalogue);
      if (!rawName) return;
      const { name: baseName, gf } = extractGF(rawName);
      const match = matchCatalogue(baseName, catalogue)[0];
      name = match ? match.name : baseName;
      category = match ? match.category : "Annet";
      const noteParts = [unit, gf ? "Glutenfri" : null].filter(Boolean);
      notes = noteParts.length ? noteParts.join(", ") : undefined;
      qty = parsedQty;
    }
    setAddValue("");
    setSuggestions([]);
    haptic();
    addInputRef.current?.focus();
    let res;
    try {
      res = await api("/list", {
        method: "POST",
        body: JSON.stringify({ name, qty: qty || 1, category, notes, exact }),
      });
    } catch {
      setAddValue(typed);
      toast("Kunne ikke legge til – sjekk nettforbindelsen", { error: true });
      return;
    }
    if (res?.error) {
      setAddValue(typed);
      toast(res.error, { error: true });
      return;
    }
    if (res?.duplicate) {
      toast(`«${cap(name)}» var alt på listen – antall økt til ${res.qty}`);
    }
    await loadCatalogue();
    loadList();
  }

  async function addSuggestedItem(it) {
    setSuggestedItems((prev) => prev.filter((s) => s.id !== it.id));
    try {
      await api("/list", { method: "POST", body: JSON.stringify({ name: it.name, qty: 1, category: it.category }) });
    } catch {
      toast("Kunne ikke legge til – sjekk nettforbindelsen", { error: true });
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

  async function toggleItem(id) {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    haptic();
    const wasBought = it.bought;
    const wasImportant = it.important;
    // Important is scoped to this trip, so checking an item off also clears
    // it (mirrored server-side in the /toggle handler) — undoing the bought
    // mark doesn't bring it back, same as the server.
    setItems((prev) =>
      prev.map((x) => (x.id === id ? { ...x, bought: wasBought ? 0 : 1, important: wasBought ? x.important : 0 } : x))
    );
    // Checking off (not un-checking): hold the row in place so the
    // strike-through + fade play before it re-sorts into "Nylig kjøpt". The
    // reorder is driven by this local timer, not by the network round-trip.
    if (!wasBought) {
      setResolvingIds((prev) => new Set(prev).add(id));
      scheduleResolve(id);
    }
    try {
      await api(`/list/${id}/toggle`, { method: "POST" });
    } catch {
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, bought: wasBought, important: wasImportant } : x)));
      clearResolving(id);
      toast("Kunne ikke oppdatere – sjekk nettforbindelsen", { error: true });
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
    } catch {
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, important: wasImportant } : x)));
      toast("Kunne ikke oppdatere – sjekk nettforbindelsen", { error: true });
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
        toast(res.error, { error: true });
        return;
      }
      toast("Varsel sendt.");
    } catch {
      toast("Noe gikk galt", { error: true });
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

  function onAddInputChange(v) {
    setAddValue(v);
    if (!v.trim()) {
      setSuggestions([]);
      return;
    }
    const { name: query } = parseItemInput(v, catalogue);
    const { name: base } = extractGF(query);
    setSuggestions(matchCatalogue(base, catalogue).slice(0, 6));
  }

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

  // A just-checked item stays in its category (struck through, fading) until
  // its resolve timer fires — only then does it move to "Nylig kjøpt".
  const unbought = items.filter((it) => !it.bought || resolvingIds.has(it.id));
  const bought = items
    .filter((it) => it.bought && !resolvingIds.has(it.id))
    .sort((a, b) => (b.bought_at || "").localeCompare(a.bought_at || ""));
  // Important-item count driving the pinImportant chip — bought items don't
  // count, since they're no longer something to look out for on this trip.
  const importantUnbought = unbought.filter((it) => it.important);
  const pinnedIds = pinImportant ? new Set(importantUnbought.map((it) => it.id)) : null;
  const groups = {};
  for (const it of unbought) {
    if (pinnedIds?.has(it.id)) continue; // pulled into importantDisplayItems instead
    (groups[it.category] = groups[it.category] || []).push(it);
  }
  // One flat, aisle-sorted list: unbought items ordered by CATEGORIES. Recently
  // bought items (capped, re-add palette) render as their own section below
  // instead of being folded into the aisle list — see boughtDisplayItems.
  // When pinImportant is on, important items are pulled out above into their
  // own "Viktig" section (see importantDisplayItems) instead of appearing
  // here too — same "own section, not a duplicate" split as bought items.
  const displayItems = CATEGORIES.filter((c) => groups[c]).flatMap((c) =>
    groups[c].map((it) => ({ item: it, clusterKey: it.category }))
  );
  const importantDisplayItems = pinImportant
    ? importantUnbought.map((it) => ({ item: it, clusterKey: "Viktig" }))
    : [];
  // Classic intensity flattens the density down to a plain linear list,
  // regardless of the user's stored grid/list preference — ph_view stays
  // untouched so switching back to muted/expressive restores it exactly.
  const effectiveViewMode = intensity === "classic" ? "list" : viewMode;
  // Fixed regardless of view mode so toggling grid/list only changes layout,
  // not which items show — a view-dependent cap (previously 9 in grid vs. 3
  // in list, to fill 3 grid rows vs. 3 list rows) made items appear/disappear
  // on toggle, which read as a bug rather than an intentional density choice.
  const BOUGHT_CAP = 9;
  const boughtDisplayItems = bought.slice(0, BOUGHT_CAP).map((it) => ({ item: it, clusterKey: "Nylig kjøpt" }));
  // Count genuinely-remaining items (a resolving item is on its way out, so it
  // shouldn't hold the counter up even though it's still rendered in place).
  const remaining = items.filter((it) => !it.bought).length;
  const summary = remaining
    ? `${remaining} ${remaining === 1 ? "vare" : "varer"} igjen`
    : items.length
      ? "Alt er handlet"
      : "";
  const editingItem = editingId != null ? items.find((it) => it.id === editingId) : null;

  return (
    <section>
      <div style={{ marginBottom: 16, position: "relative" }}>
        <Input
          ref={addInputRef}
          placeholder="Legg til vare – f.eks. «2 melk»"
          autoComplete="off"
          icon="carrot"
          value={addValue}
          onChange={(e) => onAddInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addItem(addValue);
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
            {suggestions.map((m) => {
              const { gf } = extractGF(parseItemInput(addValue, catalogue).name);
              const label = cap(m.name) + (gf ? " GF" : "");
              return (
                <div key={m.id} style={{ padding: "12px 14px", cursor: "pointer", color: "var(--text-primary)" }} onClick={() => addItem(label)}>
                  {label}
                </div>
              );
            })}
            {addValue.trim() && (
              <div
                style={{ padding: "12px 14px", cursor: "pointer", fontStyle: "italic", color: "var(--text-tertiary)" }}
                onClick={() => addItem(addValue, { exact: true })}
              >
                Legg til «{addValue.trim()}» nøyaktig som skrevet
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 16 }}>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>{summary}</span>
          {importantUnbought.length > 0 && (
            <button
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
              aria-label={pinImportant ? "Vis alle varer" : "Vis kun viktige varer først"}
              title={pinImportant ? "Vis alle varer" : "Vis kun viktige varer først"}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                border: "none",
                borderRadius: "var(--radius-pill)",
                padding: "3px 8px",
                fontSize: "var(--text-2xs)",
                fontWeight: "var(--weight-semibold)",
                cursor: "pointer",
                background: pinImportant ? "var(--accent-tertiary)" : "var(--accent-tertiary-subtle)",
                color: pinImportant ? "var(--text-on-accent)" : "var(--accent-tertiary)",
              }}
            >
              <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={STAR_PATH} />
              </svg>
              {importantUnbought.length}
            </button>
          )}
          {presentUsers.length > 0 && (
            <div
              style={{ display: "flex", alignItems: "center" }}
              title={`${presentUsers.map(nameFor).join(", ")} er også her akkurat nå`}
            >
              {presentUsers.map((u, i) => (
                <div key={u} style={{ marginLeft: i === 0 ? 0 : -8, border: "2px solid var(--surface-page)", borderRadius: "50%" }}>
                  <Avatar name={nameFor(u)} color={avatarColorFor(u)} size={20} />
                </div>
              ))}
            </div>
          )}
        </div>
        <div
          style={{
            position: "relative",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 4,
            background: "var(--surface-sunken)",
            borderRadius: "var(--radius-pill)",
            padding: 3,
          }}
        >
          <span
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
          <button
            onClick={() => setView("list")}
            aria-label="Listevisning"
            title="Listevisning"
            disabled={intensity === "classic"}
            style={viewToggleBtnStyle(effectiveViewMode === "list", intensity === "classic")}
          >
            <UiIcon name="list" size={16} />
          </button>
          <button
            onClick={() => setView("grid")}
            aria-label="Rutenettvisning"
            title={intensity === "classic" ? "Rutenettvisning er slått av i klassisk visning" : "Rutenettvisning"}
            disabled={intensity === "classic"}
            style={viewToggleBtnStyle(effectiveViewMode === "grid", intensity === "classic")}
          >
            <UiIcon name="grid" size={16} />
          </button>
        </div>
      </div>

      {loading ? (
        <ShoppingListSkeleton viewMode={effectiveViewMode} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="shopping-cart-simple"
          title="Ingen varer på listen"
          description="Legg til en vare over for å komme i gang."
        />
      ) : (
        <>
          {importantDisplayItems.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: "var(--text-2xs)",
                  fontWeight: 700,
                  color: clusterFor("Viktig").on,
                  textTransform: "uppercase",
                  letterSpacing: "var(--tracking-wide)",
                  marginBottom: 8,
                }}
              >
                Viktig
              </div>
              {renderItems(importantDisplayItems, effectiveViewMode, resolvingIds, toggleItem, toggleImportant, setEditingId, renderGeneration, clearResolving, staleItemDays)}
            </div>
          )}
          {renderItems(displayItems, effectiveViewMode, resolvingIds, toggleItem, toggleImportant, setEditingId, renderGeneration, clearResolving, staleItemDays)}

          {boughtDisplayItems.length > 0 && (
            <div style={{ marginTop: 28 }}>
              <button
                onClick={toggleBoughtCollapsed}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "none",
                  border: "none",
                  fontFamily: "var(--font-sans)",
                  cursor: "pointer",
                  fontSize: "var(--text-2xs)",
                  fontWeight: 700,
                  color: clusterFor("Nylig kjøpt").on,
                  textTransform: "uppercase",
                  letterSpacing: "var(--tracking-wide)",
                  padding: 0,
                  marginBottom: boughtCollapsed ? 0 : 8,
                }}
              >
                <span>Nylig kjøpt</span>
                <UiIcon
                  name="chevronDown"
                  size={14}
                  style={{
                    transition: "transform var(--duration-fast) var(--ease-out)",
                    transform: boughtCollapsed ? "rotate(-90deg)" : "none",
                  }}
                />
              </button>
              {/* No onToggleImportant here: a bought item's important flag is
                  always cleared server-side (see toggleItem/worker's /toggle
                  handler), so marking one important here would have nothing
                  to persist — ItemCard hides the badge and swipe gesture
                  entirely when this is undefined. */}
              {!boughtCollapsed && renderItems(boughtDisplayItems, effectiveViewMode, resolvingIds, toggleItem, undefined, setEditingId, renderGeneration, clearResolving)}
            </div>
          )}
        </>
      )}

      <FabMenu
        label="Legg til vare"
        haptic={haptic}
        actions={[
          {
            icon: "cooking-pot",
            label: "Fra middagsplanen",
            onClick: () => setModal({ type: "weekIngredients" }),
          },
          {
            icon: "sparkle",
            label: "Forslag",
            badge: suggestedItems.length || null,
            onClick: () => setModal({ type: "suggestions" }),
          },
          {
            icon: "bell-ringing",
            label: "Varsle husstanden",
            onClick: pingHousehold,
          },
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

function renderItems(displayItems, viewMode, resolvingIds, onToggle, onToggleImportant, onEdit, renderGeneration, onResolved, staleItemDays) {
  return (
    <div key={renderGeneration} style={viewMode === "grid" ? gridStyle : listStyle}>
      <AnimatePresence initial={false} mode="popLayout">
        {displayItems.map(({ item, clusterKey }, index) => {
          const { bg, on } = clusterFor(clusterKey);
          return (
            <ItemCard
              key={item.id}
              item={item}
              clusterOn={on}
              clusterBg={bg}
              resolving={!!resolvingIds?.has(item.id)}
              onToggle={onToggle}
              onToggleImportant={onToggleImportant}
              onEdit={onEdit}
              onResolved={onResolved}
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

function viewToggleBtnStyle(active, disabled) {
  return {
    position: "relative",
    zIndex: 1,
    border: "none",
    background: "transparent",
    color: active ? "var(--text-on-accent)" : "var(--text-tertiary)",
    borderRadius: "var(--radius-pill)",
    fontSize: 16,
    padding: "6px 10px",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.4 : 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "color 150ms var(--ease-out)",
  };
}
