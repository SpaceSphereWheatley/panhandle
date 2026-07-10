import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";
import { useToast } from "../context/ToastContext.jsx";
import { CATEGORIES, cap, parseItemInput, extractGF, matchCatalogue, haptic } from "../lib/shoppingUtils.js";
import { ItemCard } from "../components/ItemCard.jsx";
import { ItemGridCard } from "../components/ItemGridCard.jsx";
import { ItemEditModal } from "../components/ItemEditModal.jsx";
import { SuggestionsModal } from "../components/SuggestionsModal.jsx";
import { UiIcon } from "../components/UiIcon.jsx";

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
      <div className="addbar">
        <input
          ref={addInputRef}
          placeholder="Legg til vare – f.eks. «2 melk»"
          autoComplete="off"
          value={addValue}
          onChange={(e) => onAddInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addItem(addValue);
          }}
        />
        <button onClick={() => addItem(addValue)} aria-label="Legg til vare">+</button>
        {suggestions.length > 0 || addValue.trim() ? (
          <div className="suggestions">
            {suggestions.map((m) => {
              const { gf } = extractGF(parseItemInput(addValue, catalogue).name);
              const label = cap(m.name) + (gf ? " GF" : "");
              return (
                <div key={m.id} onClick={() => addItem(label)}>
                  {label}
                </div>
              );
            })}
            {addValue.trim() && (
              <div
                style={{ fontStyle: "italic", color: "var(--muted)" }}
                onClick={() => addItem(addValue, { exact: true })}
              >
                Legg til «{addValue.trim()}» nøyaktig som skrevet
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className="list-controls">
        <div className="list-summary">{summary}</div>
        <div className="view-toggle">
          <button
            className={viewMode === "list" ? "active" : ""}
            onClick={() => setView("list")}
            aria-label="Listevisning"
            title="Listevisning"
          >
            <UiIcon name="list" size={16} />
          </button>
          <button
            className={viewMode === "grid" ? "active" : ""}
            onClick={() => setView("grid")}
            aria-label="Rutenettvisning"
            title="Rutenettvisning"
          >
            <UiIcon name="grid" size={16} />
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          Ingen varer på listen.
          <br />
          Legg til en vare over for å komme i gang.
        </div>
      ) : (
        <>
          <div>
            {CATEGORIES.filter((c) => groups[c]).map((cat) => (
              <CatSection
                key={cat}
                catKey={cat}
                items={groups[cat]}
                collapsed={!!collapsedCats[cat]}
                viewMode={viewMode}
                onToggleCat={toggleCat}
                onToggleItem={toggleItem}
                onEditItem={setEditingId}
                onDeleteItem={deleteItem}
              />
            ))}
          </div>
          {bought.length > 0 && (
            <div style={{ marginTop: 28, paddingTop: 16, borderTop: "2px solid var(--border)" }}>
              <CatSection
                catKey="Nylig kjøpt"
                items={bought.slice(0, 30)}
                collapsed={!!collapsedCats["Nylig kjøpt"]}
                viewMode={viewMode}
                onToggleCat={toggleCat}
                onToggleItem={toggleItem}
                onEditItem={setEditingId}
                onDeleteItem={deleteItem}
              />
            </div>
          )}
        </>
      )}

      <button className="fab" aria-label="Legg til vare" onClick={onFabClick}>
        {suggestedItems.length > 0 && <span className="fab-badge">{suggestedItems.length}</span>}+
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

function CatSection({ catKey, items, collapsed, viewMode, onToggleCat, onToggleItem, onEditItem, onDeleteItem }) {
  return (
    <div className="cat-section">
      <button className="cat-label" onClick={() => onToggleCat(catKey)}>
        <span>{catKey}</span>
        <span className={`arrow${collapsed ? " collapsed" : ""}`}>
          <UiIcon name="chevronDown" size={14} />
        </span>
      </button>
      <div className={`cat-content${collapsed ? " collapsed" : ""}`}>
        {viewMode === "grid" ? (
          <div className="grid-wrap">
            {items.map((it) => (
              <ItemGridCard key={it.id} item={it} onToggle={onToggleItem} />
            ))}
          </div>
        ) : (
          items.map((it) => (
            <ItemCard
              key={it.id}
              item={it}
              onToggle={onToggleItem}
              onEdit={onEditItem}
              onDelete={onDeleteItem}
            />
          ))
        )}
      </div>
    </div>
  );
}
