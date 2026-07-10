import { useEffect, useMemo, useState } from "react";
import { Modal } from "../Modal.jsx";
import { api } from "../../lib/api.js";
import { parseIngredients } from "../../lib/mealUtils.js";

// Add (id=null) or edit (id given) a meal_catalogue entry directly, outside
// of planning a specific day. Reachable from the Måltider tab's FAB and from
// each row of "Alle måltider".
export function MealEditModal({ id, onClose, onSaved }) {
  const [catalogue, setCatalogue] = useState([]);
  const [name, setName] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [labels, setLabels] = useState("");
  const [msg, setMsg] = useState("");
  const [similarNote, setSimilarNote] = useState({ text: "", danger: false });

  useEffect(() => {
    (async () => {
      const rows = await api("/meals");
      const sorted = [...rows].sort((a, b) => b.times_planned - a.times_planned || a.name.localeCompare(b.name));
      setCatalogue(sorted);
      const meal = id ? sorted.find((m) => m.id === id) : null;
      if (meal) {
        setName(meal.name);
        setIngredients(parseIngredients(meal.ingredients).join(", "));
        setLabels(parseIngredients(meal.labels).join(", "));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const knownLabels = useMemo(() => {
    const set = new Set();
    for (const m of catalogue) for (const l of parseIngredients(m.labels)) set.add(l);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [catalogue]);

  // Live feedback while typing a meal name: an exact (case-insensitive) match
  // against another meal is a hard block (mirrors the server's duplicate
  // check), a substring match is just a heads-up.
  function checkSimilar(value) {
    const n = value.trim().toLowerCase();
    if (!n) {
      setSimilarNote({ text: "", danger: false });
      return;
    }
    const others = catalogue.filter((m) => m.id !== id);
    const exact = others.find((m) => m.name.toLowerCase() === n);
    if (exact) {
      setSimilarNote({ text: `«${exact.name}» finnes allerede – navnet må være forskjellig.`, danger: true });
      return;
    }
    const similar = others.filter((m) => {
      const on = m.name.toLowerCase();
      return on.includes(n) || n.includes(on);
    });
    setSimilarNote(
      similar.length
        ? { text: `Ligner på: ${similar.slice(0, 3).map((m) => m.name).join(", ")}`, danger: false }
        : { text: "", danger: false }
    );
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      setMsg("Tomt navn");
      return;
    }
    const ing = ingredients.split(",").map((s) => s.trim()).filter(Boolean);
    const lbl = labels.split(",").map((s) => s.trim()).filter(Boolean);
    const res = id
      ? await api(`/meals/${id}`, { method: "PATCH", body: JSON.stringify({ name: trimmed, ingredients: ing, labels: lbl }) })
      : await api("/meals", { method: "POST", body: JSON.stringify({ name: trimmed, ingredients: ing, labels: lbl }) });
    if (res.error) {
      setMsg(res.error);
      return;
    }
    onSaved();
  }

  // Removes the meal from the catalogue entirely — cascades to meal_plan, so
  // any day currently assigned this meal reverts to unplanned.
  async function deleteEntry() {
    const meal = catalogue.find((m) => m.id === id);
    if (!meal) return;
    if (!confirm(`Slette «${meal.name}» fra måltidskatalogen? Dager den er planlagt på blir tomme.`)) return;
    await api(`/meals/${id}`, { method: "DELETE" });
    onSaved();
  }

  return (
    <Modal onClose={onClose}>
      <h3>{id ? "Rediger måltid" : "Nytt måltid"}</h3>
      <label>Navn</label>
      <input
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          checkSimilar(e.target.value);
        }}
        placeholder="F.eks. Taco"
      />
      <div style={{ fontSize: 12, marginTop: 4, minHeight: 14, color: similarNote.danger ? "var(--danger)" : "var(--muted)" }}>
        {similarNote.text}
      </div>
      <label>Ingredienser (kommaseparert)</label>
      <input value={ingredients} onChange={(e) => setIngredients(e.target.value)} placeholder="F.eks. Kjøttdeig, Tortilla, Ost" />
      <label>Etiketter (kommaseparert)</label>
      <input list="mealLabelOptions" value={labels} onChange={(e) => setLabels(e.target.value)} placeholder="F.eks. Middag, Vegetar" />
      <datalist id="mealLabelOptions">
        {knownLabels.map((l) => (
          <option value={l} key={l} />
        ))}
      </datalist>
      <div style={{ fontSize: 13, marginTop: 8, minHeight: 16, color: "var(--danger)" }}>{msg}</div>
      <div className="actions">
        <button className="cancel" onClick={onClose}>Avbryt</button>
        <button className="save" onClick={save}>Lagre</button>
      </div>
      {id && (
        <button className="cancel" style={{ width: "100%", marginTop: 8, color: "var(--danger)" }} onClick={deleteEntry}>
          Slett måltid fra katalog
        </button>
      )}
    </Modal>
  );
}
