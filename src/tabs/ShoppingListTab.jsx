import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";
import { useToast } from "../context/ToastContext.jsx";
import { CATEGORIES, cap, parseItemInput, extractGF, matchCatalogue, haptic } from "../lib/shoppingUtils.js";
import { ItemCard } from "../components/ItemCard.jsx";
import { ItemGridCard } from "../components/ItemGridCard.jsx";
import { ItemEditModal } from "../components/ItemEditModal.jsx";
import { SuggestionsModal } from "../components/SuggestionsModal.jsx";
import { Input, IconButton, Card } from "../design-system/index.js";

const POLL_MS = 7000;

export function ShoppingListTab({ onSyncTick, onOffline }) {
  const toast = useToast();
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
  const [showSuggestModal, setShowSuggestModal] = useState(false);

  const pendingDeleteIds = useRef(new Set());
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
    const filtered = pendingDeleteIds.current.size
      ? fetched.filter((it) => !pendingDeleteIds.current.has(it.id))
      : fetched;
    setItems(filtered);
    try {
      setSuggestedItems(await api("/catalogue/suggestions"));
    } catch {
      setSuggestedItems([]);
    }
  }

  useEffect(() => {
    loadCatalogue().then(loadList);
    const timer = setInterval(() => {
      if (!document.hidden) loadList();
    }, POLL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  async function toggleItem(id) {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    haptic();
    const wasBought = it.bought;
    setItems((prev) =>
      prev.map((x) => (x.id === id ? { ...x, bought: wasBought ? 0 : 1 } : x))
    );
    try {
      await api(`/list/${id}/toggle`, { method: "POST" });
      loadList();
    } catch {
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, bought: wasBought } : x)));
      toast("Kunne ikke oppdatere – sjekk nettforbindelsen", { error: true });
    }
  }

  // Optimistic delete with a 5s undo window: the row disappears at once, but
  // the server DELETE only fires after the grace period unless "Angre" is hit.
  function deleteItem(id) {
    const item = items.find((x) => x.id === id);
    if (!item) return;
    setItems((prev) => prev.filter((x) => x.id !== id));
    pendingDeleteIds.current.add(id);
    haptic();
    const timer = setTimeout(() => commitDelete(id), 5000);
    toast(`«${cap(item.name)}» slettet`, {
      undoFn: () => {
        clearTimeout(timer);
        pendingDeleteIds.current.delete(id);
        setItems((prev) => [...prev, item]);
      },
    });
  }

  async function commitDelete(id) {
    if (!pendingDeleteIds.current.has(id)) return;
    try {
      await api(`/list/${id}`, { method: "DELETE" });
    } catch {
      toast("Kunne ikke slette – prøv igjen", { error: true });
      loadList();
    } finally {
      pendingDeleteIds.current.delete(id);
    }
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

  function onFabClick() {
    if (suggestedItems.length) setShowSuggestModal(true);
    else focusAddInput();
  }

  const unbought = items.filter((it) => !it.bought);
  const bought = items
    .filter((it) => it.bought)
    .sort((a, b) => (b.bought_at || "").localeCompare(a.bought_at || ""));
  const groups = {};
  for (const it of unbought) (groups[it.category] = groups[it.category] || []).push(it);
  const summary = unbought.length
    ? `${unbought.length} ${unbought.length === 1 ? "vare" : "varer"} igjen`
    : items.length
      ? "Alt er handlet 🎉"
      : "";
  const editingItem = editingId != null ? items.find((it) => it.id === editingId) : null;

  return (
    <section>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, position: "relative" }}>
        <div style={{ flex: 1 }}>
          <Input
            ref={addInputRef}
            placeholder="Legg til vare – f.eks. «2 melk»"
            autoComplete="off"
            icon="carrot"
            value={addValue}
            onChange={(e) => onAddInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addItem(addValue);
            }}
          />
        </div>
        <IconButton icon="plus" variant="filled" label="Legg til vare" onClick={() => addItem(addValue)} />
        {suggestions.length > 0 || addValue.trim() ? (
          <div
            style={{
              position: "absolute",
              top: 52,
              left: 0,
              right: 52,
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
            style={viewToggleBtnStyle(viewMode === "list")}
          >
            <i className="ph ph-list-bullets" />
          </button>
          <button
            onClick={() => setView("grid")}
            aria-label="Rutenettvisning"
            title="Rutenettvisning"
            style={viewToggleBtnStyle(viewMode === "grid")}
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
            {CATEGORIES.filter((c) => groups[c]).map((cat, i) => (
              <CatSection
                key={cat}
                catKey={cat}
                items={groups[cat]}
                collapsed={!!collapsedCats[cat]}
                viewMode={viewMode}
                first={i === 0}
                onToggleCat={toggleCat}
                onToggleItem={toggleItem}
                onEditItem={setEditingId}
                onDeleteItem={deleteItem}
              />
            ))}
          </div>
          {bought.length > 0 && (
            <div style={{ marginTop: 28, paddingTop: 16, borderTop: "2px solid var(--border-default)" }}>
              <CatSection
                catKey="Nylig kjøpt"
                items={bought.slice(0, 30)}
                collapsed={!!collapsedCats["Nylig kjøpt"]}
                viewMode={viewMode}
                first
                onToggleCat={toggleCat}
                onToggleItem={toggleItem}
                onEditItem={setEditingId}
                onDeleteItem={deleteItem}
              />
            </div>
          )}
        </>
      )}

      <button
        aria-label="Legg til vare"
        onClick={onFabClick}
        style={{
          position: "fixed",
          bottom: "calc(84px + env(safe-area-inset-bottom))",
          right: "max(16px, calc(50vw - 224px))",
          width: 56,
          height: 56,
          borderRadius: "var(--radius-pill)",
          background: "var(--accent-primary)",
          color: "var(--text-on-accent)",
          border: "none",
          boxShadow: "var(--shadow-raised)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 26,
          cursor: "pointer",
          zIndex: 11,
        }}
      >
        {suggestedItems.length > 0 && (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              minWidth: 20,
              height: 20,
              padding: "0 5px",
              borderRadius: "var(--radius-pill)",
              background: "var(--accent-primary-press)",
              color: "var(--text-on-accent)",
              fontSize: 11,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
          >
            {suggestedItems.length}
          </span>
        )}
        <i className="ph ph-plus" />
      </button>

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

      {showSuggestModal && (
        <SuggestionsModal
          suggestions={suggestedItems}
          onAdd={(it) => addSuggestedItem(it)}
          onClose={() => setShowSuggestModal(false)}
          onFocusAdd={focusAddInput}
        />
      )}
    </section>
  );
}

function viewToggleBtnStyle(active) {
  return {
    border: "none",
    background: active ? "var(--accent-primary)" : "transparent",
    color: active ? "var(--text-on-accent)" : "var(--text-tertiary)",
    borderRadius: "var(--radius-pill)",
    fontSize: 16,
    padding: "6px 10px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
  };
}

function CatSection({ catKey, items, collapsed, viewMode, first = false, onToggleCat, onToggleItem, onEditItem, onDeleteItem }) {
  return (
    <div style={{ marginBottom: 4 }}>
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
          fontWeight: 600,
          color: "var(--text-tertiary)",
          textTransform: "uppercase",
          letterSpacing: "var(--tracking-wide)",
          margin: first ? "0 0 8px" : "18px 0 8px",
          padding: first ? "0 4px 0" : "14px 4px 0",
          borderTop: first ? "none" : "1px solid var(--border-default)",
        }}
      >
        <span>{catKey}</span>
        <i
          className="ph ph-caret-down"
          style={{
            fontSize: 13,
            color: "var(--accent-primary)",
            transition: "transform .15s ease",
            transform: collapsed ? "rotate(-90deg)" : "none",
          }}
        />
      </button>
      {!collapsed && (
        viewMode === "grid" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {items.map((it) => (
              <ItemGridCard key={it.id} item={it} onToggle={onToggleItem} />
            ))}
          </div>
        ) : (
          <Card padding="sm">
            {items.map((it) => (
              <ItemCard
                key={it.id}
                item={it}
                onToggle={onToggleItem}
                onEdit={onEditItem}
                onDelete={onDeleteItem}
              />
            ))}
          </Card>
        )
      )}
    </div>
  );
}
