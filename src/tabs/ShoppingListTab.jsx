import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "../lib/api.js";
import { useToast } from "../context/ToastContext.jsx";
import { CATEGORIES, cap, parseItemInput, extractGF, matchCatalogue, haptic } from "../lib/shoppingUtils.js";
import { clusterFor } from "../lib/categoryClusters.js";
import { useDesignIntensity } from "../hooks/useDesignIntensity.js";
import { useMotionConfig } from "../hooks/useMotionConfig.js";
import { ItemCard } from "../components/ItemCard.jsx";
import { ItemGridCard } from "../components/ItemGridCard.jsx";
import { ItemEditModal } from "../components/ItemEditModal.jsx";
import { SuggestionsModal } from "../components/SuggestionsModal.jsx";
import { WeekIngredientsModal } from "../components/meals/WeekIngredientsModal.jsx";
import { Input, FabMenu } from "../design-system/index.js";

const POLL_MS = 7000;

export function ShoppingListTab({ onSyncTick, onOffline, active }) {
  const toast = useToast();
  const intensity = useDesignIntensity();
  const [catalogue, setCatalogue] = useState([]);
  const [items, setItems] = useState([]);
  const [viewMode, setViewMode] = useState(() => (localStorage.getItem("ph_view") === "grid" ? "grid" : "list"));
  const [collapsedCats, setCollapsedCats] = useState(() => {
    const stored = JSON.parse(localStorage.getItem("ph_collapsed") || "{}");
    // "Nylig kjøpt" starts collapsed unless the user has chosen otherwise —
    // it's a re-add palette, not something to scroll past every time.
    if (!("Nylig kjøpt" in stored)) stored["Nylig kjøpt"] = true;
    return stored;
  });
  const [addValue, setAddValue] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [suggestedItems, setSuggestedItems] = useState([]);
  const [editingId, setEditingId] = useState(null);
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

  useEffect(() => {
    if (!active) return;
    loadCatalogue().then(loadList);
    const timer = setInterval(() => {
      if (!document.hidden) loadList();
    }, POLL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  function toggleCat(key) {
    const next = { ...collapsedCats, [key]: !collapsedCats[key] };
    setCollapsedCats(next);
    localStorage.setItem("ph_collapsed", JSON.stringify(next));
  }

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

  // Total resolve window ≈ 150ms strike-through delay + 200ms fade + buffer.
  const RESOLVE_MS = 400;

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
        }, RESOLVE_MS)
      );
    }
    try {
      await api(`/list/${id}/toggle`, { method: "POST" });
      loadList();
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

  // A just-checked item stays in its category (struck through, fading) until
  // its resolve timer fires — only then does it move to "Nylig kjøpt".
  const unbought = items.filter((it) => !it.bought || resolvingIds.has(it.id));
  const bought = items
    .filter((it) => it.bought && !resolvingIds.has(it.id))
    .sort((a, b) => (b.bought_at || "").localeCompare(a.bought_at || ""));
  const groups = {};
  for (const it of unbought) (groups[it.category] = groups[it.category] || []).push(it);
  // Count genuinely-remaining items (a resolving item is on its way out, so it
  // shouldn't hold the counter up even though it's still rendered in place).
  const remaining = items.filter((it) => !it.bought).length;
  const summary = remaining
    ? `${remaining} ${remaining === 1 ? "vare" : "varer"} igjen`
    : items.length
      ? "Alt er handlet"
      : "";
  const editingItem = editingId != null ? items.find((it) => it.id === editingId) : null;
  // Classic intensity flattens the density down to a plain linear list,
  // regardless of the user's stored grid/list preference — ph_view stays
  // untouched so switching back to muted/expressive restores it exactly.
  const effectiveViewMode = intensity === "classic" ? "list" : viewMode;

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
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", minHeight: 16 }}>{summary}</div>
        <div style={{ display: "flex", gap: 4, background: "var(--surface-sunken)", borderRadius: "var(--radius-pill)", padding: 3 }}>
          <button
            onClick={() => setView("list")}
            aria-label="Listevisning"
            title="Listevisning"
            disabled={intensity === "classic"}
            style={viewToggleBtnStyle(effectiveViewMode === "list", intensity === "classic")}
          >
            <i className="ph ph-list-bullets" />
          </button>
          <button
            onClick={() => setView("grid")}
            aria-label="Rutenettvisning"
            title={intensity === "classic" ? "Rutenettvisning er slått av i klassisk visning" : "Rutenettvisning"}
            disabled={intensity === "classic"}
            style={viewToggleBtnStyle(effectiveViewMode === "grid", intensity === "classic")}
          >
            <i className="ph ph-squares-four" />
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--text-tertiary)", padding: "48px 16px", fontSize: "var(--text-sm)" }}>
          Ingen varer på listen.
          <br />
          Legg til en vare over for å komme i gang.
        </div>
      ) : (
        <>
          <div>
            <AnimatePresence initial={false}>
              {CATEGORIES.filter((c) => groups[c]).map((cat) => (
                <CatSection
                  key={cat}
                  catKey={cat}
                  items={groups[cat]}
                  collapsed={!!collapsedCats[cat]}
                  viewMode={effectiveViewMode}
                  resolvingIds={resolvingIds}
                  onToggleCat={toggleCat}
                  onToggleItem={toggleItem}
                  onEditItem={setEditingId}
                />
              ))}
            </AnimatePresence>
          </div>
          {bought.length > 0 && (
            <div style={{ marginTop: 28 }}>
              <CatSection
                catKey="Nylig kjøpt"
                items={bought.slice(0, 30)}
                collapsed={!!collapsedCats["Nylig kjøpt"]}
                viewMode={effectiveViewMode}
                resolvingIds={resolvingIds}
                onToggleCat={toggleCat}
                onToggleItem={toggleItem}
                onEditItem={setEditingId}
              />
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

function viewToggleBtnStyle(active, disabled) {
  return {
    border: "none",
    background: active ? "var(--accent-primary)" : "transparent",
    color: active ? "var(--text-on-accent)" : "var(--text-tertiary)",
    borderRadius: "var(--radius-pill)",
    fontSize: 16,
    padding: "6px 10px",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.4 : 1,
    display: "flex",
    alignItems: "center",
  };
}

// Each category renders as a physical "store aisle" cluster: a colored,
// muted backdrop container (unique per category, see categoryClusters.js)
// holding that category's items. "Nylig kjøpt" isn't a real category — it
// falls through to the neutral "other" cluster.
function CatSection({ catKey, items, collapsed, viewMode, resolvingIds, onToggleCat, onToggleItem, onEditItem }) {
  const { bg, on } = clusterFor(catKey);
  const { shouldAnimate, transition } = useMotionConfig();
  const Wrapper = shouldAnimate ? motion.div : "div";
  const motionProps = shouldAnimate ? { layout: true, transition } : {};
  return (
    <Wrapper {...motionProps} style={{ marginBottom: 12, background: bg, borderRadius: "var(--radius-card)", padding: 12 }}>
      <button
        onClick={() => onToggleCat(catKey)}
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
          color: on,
          textTransform: "uppercase",
          letterSpacing: "var(--tracking-wide)",
          padding: 0,
          marginBottom: collapsed ? 0 : 8,
        }}
      >
        <span>{catKey}</span>
        <i
          className="ph ph-caret-down"
          style={{
            fontSize: 13,
            transition: "transform var(--duration-fast) var(--ease-out)",
            transform: collapsed ? "rotate(-90deg)" : "none",
          }}
        />
      </button>
      {!collapsed && (
        viewMode === "grid" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
            <AnimatePresence initial={false}>
              {items.map((it) => (
                <ItemGridCard
                  key={it.id}
                  item={it}
                  clusterOn={on}
                  resolving={!!resolvingIds?.has(it.id)}
                  onToggle={onToggleItem}
                  onEdit={onEditItem}
                />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <AnimatePresence initial={false}>
              {items.map((it) => (
                <ItemCard
                  key={it.id}
                  item={it}
                  clusterOn={on}
                  resolving={!!resolvingIds?.has(it.id)}
                  onToggle={onToggleItem}
                  onEdit={onEditItem}
                />
              ))}
            </AnimatePresence>
          </div>
        )
      )}
    </Wrapper>
  );
}
