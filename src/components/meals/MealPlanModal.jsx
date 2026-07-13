import { useEffect, useRef, useState } from "react";
import { Modal } from "../Modal.jsx";
import { UiIcon } from "../UiIcon.jsx";
import { Button } from "../../design-system/components/forms/Button.jsx";
import { api } from "../../lib/api.js";
import { parseIngredients } from "../../lib/mealUtils.js";
import { useListUsers } from "../../context/ListUsersContext.jsx";
import { useRecurring } from "../../context/RecurringContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";

// Plans/edits a single day: meal name (with a dropdown of known meals),
// ingredients, and a responsible person (list member, or free-text "Annet").
export function MealPlanModal({ iso, onClose, onSaved, onOpenIngredientPicker }) {
  const { people } = useListUsers();
  const { schedule, ensureLoaded } = useRecurring();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [mealCatalogue, setMealCatalogue] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [current, setCurrent] = useState({});
  const [mealName, setMealName] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [respSelect, setRespSelect] = useState("");
  const [respOther, setRespOther] = useState("");
  const fieldRef = useRef(null);

  useEffect(() => {
    (async () => {
      await ensureLoaded();
      let meals, plan, sugg;
      try {
        [meals, plan, sugg] = await Promise.all([
          api("/meals"),
          api(`/plan?from=${iso}&to=${iso}`),
          api("/meals/suggestions").catch(() => []),
        ]);
      } catch {
        toast("Kunne ikke laste – sjekk nettforbindelsen", { error: true });
        onClose();
        return;
      }
      setMealCatalogue(meals);
      setSuggestions(sugg);
      const cur = plan[0] || {};
      setCurrent(cur);
      setMealName(cur.meal_name || "");
      setIngredients(parseIngredients(cur.ingredients).join(", "));
      const dow = (new Date(iso).getDay() + 6) % 7;
      const def = !cur.responsible ? schedule[dow] || "" : "";
      const resp = cur.responsible || "";
      const knownPeople = people;
      const isOther = resp && !knownPeople.includes(resp);
      setRespSelect(isOther ? "__other__" : resp || (def ? def : ""));
      setRespOther(isOther ? resp : "");
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iso]);

  useEffect(() => {
    function onDocClick(e) {
      if (!fieldRef.current?.contains(e.target)) setShowDropdown(false);
    }
    // Capture phase: the Sheet content wrapper stops click propagation, so a
    // bubble-phase document listener never fires for clicks inside the modal
    // and the dropdown would stay open. Capture runs before that stopPropagation.
    document.addEventListener("click", onDocClick, true);
    return () => document.removeEventListener("click", onDocClick, true);
  }, []);

  function onMealNameChange(v) {
    setMealName(v);
    const match = mealCatalogue.find((m) => m.name.toLowerCase() === v.trim().toLowerCase());
    setIngredients(match ? parseIngredients(match.ingredients).join(", ") : ingredients);
    setShowDropdown(true);
  }

  function pickMeal(m) {
    setMealName(m.name);
    setIngredients(parseIngredients(m.ingredients).join(", "));
    setShowDropdown(false);
  }

  function getResp() {
    if (respSelect === "__other__") return respOther.trim() || "Annet";
    return respSelect;
  }

  async function savePlan() {
    const name = mealName.trim();
    const responsible = getResp();
    const ing = ingredients.split(",").map((s) => s.trim()).filter(Boolean);
    if (!name && !responsible) {
      onClose();
      return;
    }
    await api("/plan", {
      method: "POST",
      body: JSON.stringify({ plan_date: iso, meal_name: name || null, responsible, ingredients: ing }),
    });
    onSaved();
  }

  async function deletePlanDay() {
    await api(`/plan/${iso}`, { method: "DELETE" });
    onSaved();
  }

  // Persist the meal first so typed ingredients are remembered, then swap to
  // the ingredient picker.
  async function pickIngredients() {
    const name = mealName.trim();
    const rawIng = ingredients.split(",").map((s) => s.trim()).filter(Boolean);
    if (!rawIng.length) {
      toast("Legg inn ingredienser først");
      return;
    }
    if (name) {
      try {
        await api("/plan", {
          method: "POST",
          body: JSON.stringify({ plan_date: iso, meal_name: name, responsible: getResp(), ingredients: rawIng }),
        });
      } catch {
        toast("Kunne ikke lagre måltidet – sjekk nettforbindelsen", { error: true });
        return;
      }
    }
    onOpenIngredientPicker(rawIng, iso);
  }

  if (loading) {
    return (
      <Modal onClose={onClose}>
        <h3>Planlegg måltid</h3>
      </Modal>
    );
  }

  const dropdownMatches = mealCatalogue.filter(
    (m) => !mealName.trim() || m.name.toLowerCase().includes(mealName.trim().toLowerCase())
  );

  return (
    <Modal onClose={onClose}>
      <h3>Planlegg måltid</h3>
      {suggestions.length > 0 && (
        <>
          <label>Forslag (lenge siden, ofte brukt)</label>
          <div className="meal-suggestions">
            {suggestions.map((m) => (
              <button
                type="button"
                className="meal-chip"
                key={m.id}
                onClick={() => pickMeal(m)}
              >
                {m.name}
              </button>
            ))}
          </div>
        </>
      )}
      <label>Måltid (velg eller skriv nytt)</label>
      <div className="meal-name-field" ref={fieldRef}>
        <input
          autoComplete="off"
          value={mealName}
          onChange={(e) => onMealNameChange(e.target.value)}
          onFocus={() => setShowDropdown(true)}
          placeholder="F.eks. Taco"
        />
        <button
          type="button"
          className="meal-name-arrow"
          onClick={() => setShowDropdown((v) => !v)}
          aria-label="Vis lagrede måltider"
        >
          <UiIcon name="chevronDown" size={14} />
        </button>
        <div className={`meal-name-dropdown${showDropdown ? "" : " hidden"}`}>
          {dropdownMatches.length ? (
            dropdownMatches.map((m) => (
              <div className="meal-name-option" key={m.id} onClick={() => pickMeal(m)}>
                {m.name}
              </div>
            ))
          ) : (
            <div className="meal-name-option meal-name-empty">
              Ingen lagrede måltider{mealName.trim() ? " som matcher" : ""}
            </div>
          )}
        </div>
      </div>
      <label>Ingredienser (kommaseparert)</label>
      <input
        value={ingredients}
        onChange={(e) => setIngredients(e.target.value)}
        placeholder="F.eks. Kjøttdeig, Tortilla, Ost"
      />
      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
        Ingredienser huskes per måltid og deles for alle dager med samme navn.
      </div>
      <button type="button" className="ing-add-btn" onClick={pickIngredients}>
        + Legg ingredienser på handlelisten
      </button>
      <label>Ansvarlig</label>
      <select value={respSelect} onChange={(e) => setRespSelect(e.target.value)}>
        <option value="">Ingen</option>
        {people.map((p) => (
          <option value={p} key={p}>{p}</option>
        ))}
        <option value="__other__">Annet...</option>
      </select>
      {respSelect === "__other__" && (
        <input
          type="text"
          placeholder="Beskriv (f.eks. Ute og spiser)"
          style={{ marginTop: 8, width: "100%", padding: 10, fontSize: 16, borderRadius: 10, border: "1px solid var(--border-default)", background: "var(--surface-sunken)", color: "var(--text-primary)" }}
          value={respOther}
          onChange={(e) => setRespOther(e.target.value)}
        />
      )}
      <div className="actions">
        <button className="cancel" onClick={onClose}>Avbryt</button>
        <button className="save" onClick={savePlan}>Lagre</button>
      </div>
      {(current.meal_name || current.responsible) && (
        <Button variant="danger" icon="trash" onClick={deletePlanDay} style={{ width: "100%", marginTop: 8 }}>
          Fjern måltid for denne dagen
        </Button>
      )}
    </Modal>
  );
}
