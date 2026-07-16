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
import { Input, Avatar, FabMenu, LoadingState, EmptyState } from "../design-system/index.js";

const POLL_MS = 7000;
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

export function ShoppingListTab({ onSyncTick, onOffline, active }) {
  const toast = useToast();
  const intensity = useDesignIntensity();
  const { shouldAnimate } = useMotionConfig();
  const { nameFor } = useListUsers();
  const [catalogue, setCatalogue] = useState([]);
  const [items, setItems] = useState([]);
  // Other members who've polled the list in the last ~20s (see POST
  // /presence) — usernames, resolved to display names/colors for the avatar
  // row below the summary line.
  const [presentUsers, setPresentUsers] = useState([]);
  const [loading, setLoading] = useState(true);
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
      const { name: rawName, qty: parsedQty } = parseItemInput(typed, catalogue);
      if (!rawName) return;
      const { name: baseName, gf } = extractGF(rawName);
      const match = matchCatalogue(baseName, catalogue)[0];
      name = match ? match.name : baseName;
      category = match ? match.category : "Annet";
      notes = gf ? "Glutenfri" : undefined;
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
        body: JSON.stringify({ name, qty: qty || 1, category, notes }),
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
    setItems((prev) =>
      prev.map((x) => (x.id === id ? { ...x, bought: wasBought ? 0 : 1 } : x))
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
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, bought: wasBought } : x)));
      clearResolving(id);
      toast("Kunne ikke oppdatere – sjekk nettforbindelsen", { error: true });
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
  const groups = {};
  for (const it of unbought) (groups[it.category] = groups[it.category] || []).push(it);
  // One flat, aisle-sorted list: unbought items ordered by CATEGORIES. Recently
  // bought items (capped, re-add palette) render as their own section below
  // instead of being folded into the aisle list — see boughtDisplayItems.
  const displayItems = CATEGORIES.filter((c) => groups[c]).flatMap((c) =>
    groups[c].map((it) => ({ item: it, clusterKey: it.category }))
  );
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
        <LoadingState label="Laster handleliste..." />
      ) : items.length === 0 ? (
        <EmptyState
          icon="shopping-cart-simple"
          title="Ingen varer på listen"
          description="Legg til en vare over for å komme i gang."
        />
      ) : (
        <>
          {renderItems(displayItems, effectiveViewMode, resolvingIds, toggleItem, setEditingId, renderGeneration, clearResolving)}

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
              {!boughtCollapsed && renderItems(boughtDisplayItems, effectiveViewMode, resolvingIds, toggleItem, setEditingId, renderGeneration, clearResolving)}
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

function renderItems(displayItems, viewMode, resolvingIds, onToggle, onEdit, renderGeneration, onResolved) {
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
              onEdit={onEdit}
              onResolved={onResolved}
              viewMode={viewMode}
              index={index}
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
