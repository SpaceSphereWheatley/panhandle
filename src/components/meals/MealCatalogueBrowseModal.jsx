import { useEffect, useMemo, useState } from "react";
import { Modal } from "../Modal.jsx";
import { api } from "../../lib/api.js";
import { parseIngredients } from "../../lib/mealUtils.js";

// Browse of every saved meal (meal_catalogue), with usage stats and a
// client-side name + label filter — there's no server-side search endpoint
// since the whole catalogue is already fetched by GET /meals for the
// planner's dropdown. Clicking a row opens it in the editor.
export function MealCatalogueBrowseModal({ onClose, onOpenEdit }) {
  const [meals, setMeals] = useState(null);
  const [filter, setFilter] = useState("");
  const [labelFilter, setLabelFilter] = useState("");

  useEffect(() => {
    (async () => {
      const rows = await api("/meals");
      setMeals([...rows].sort((a, b) => b.times_planned - a.times_planned || a.name.localeCompare(b.name)));
    })();
  }, []);

  const labels = useMemo(() => {
    if (!meals) return [];
    const set = new Set();
    for (const m of meals) for (const l of parseIngredients(m.labels)) set.add(l);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [meals]);

  const rows = useMemo(() => {
    if (!meals) return [];
    const f = filter.trim().toLowerCase();
    const lf = labelFilter.toLowerCase();
    return meals.filter((m) => {
      const nameMatch = !f || m.name.toLowerCase().includes(f);
      const labelMatch = !lf || parseIngredients(m.labels).some((l) => l.toLowerCase() === lf);
      return nameMatch && labelMatch;
    });
  }, [meals, filter, labelFilter]);

  return (
    <Modal onClose={onClose}>
      <h3>Alle måltider</h3>
      <button className="meal-browse-add" onClick={() => onOpenEdit(null)}>+ Nytt måltid</button>
      <input placeholder="Søk..." value={filter} onChange={(e) => setFilter(e.target.value)} />
      {labels.length > 0 && (
        <select value={labelFilter} onChange={(e) => setLabelFilter(e.target.value)} id="mealBrowseLabelSelect">
          <option value="">Alle etiketter</option>
          {labels.map((l) => (
            <option value={l} key={l}>{l}</option>
          ))}
        </select>
      )}
      <div style={{ marginTop: 10, maxHeight: "50vh", overflowY: "auto" }}>
        {meals === null ? null : rows.length === 0 ? (
          <p className="cred-note">
            Ingen lagrede måltider{filter.trim() || labelFilter ? " som matcher søket" : " ennå"}.
          </p>
        ) : (
          rows.map((m) => {
            const count = parseIngredients(m.ingredients).length;
            const labels = parseIngredients(m.labels);
            const last = m.last_planned
              ? new Date(m.last_planned).toLocaleDateString("no-NO", { day: "numeric", month: "short", year: "numeric" })
              : "Aldri";
            return (
              <button type="button" className="meal-browse-row" key={m.id} onClick={() => onOpenEdit(m.id)}>
                <span className="info">
                  <span className="name">{m.name}</span>
                  <span className="stats">{m.times_planned}× planlagt · sist {last} · {count} ingredienser</span>
                  {labels.length > 0 && (
                    <span className="labels">
                      {labels.map((l) => (
                        <span className="label-chip" key={l}>{l}</span>
                      ))}
                    </span>
                  )}
                </span>
              </button>
            );
          })
        )}
      </div>
      <div className="actions">
        <button className="cancel" onClick={onClose}>Lukk</button>
      </div>
    </Modal>
  );
}
