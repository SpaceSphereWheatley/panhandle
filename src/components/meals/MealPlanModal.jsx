import { useEffect, useRef, useState } from "react";
import { Modal } from "../Modal.jsx";
import { Button } from "../../design-system/components/forms/Button.jsx";
import { Input } from "../../design-system/components/forms/Input.jsx";
import { IconButton } from "../../design-system/components/forms/IconButton.jsx";
import { LoadingState } from "../../design-system/components/data-display/Spinner.jsx";
import { api } from "../../lib/api.js";
import { parseIngredients } from "../../lib/mealUtils.js";
import { useListUsers } from "../../context/ListUsersContext.jsx";
import { useRecurring } from "../../context/RecurringContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useConfirm } from "../../context/ConfirmContext.jsx";

// Plans/edits a single day: meal name (with a dropdown of known meals),
// ingredients, and a responsible person (list member, or free-text "Annet").
export function MealPlanModal({ iso, onClose, onSavePlan, onDeletePlanDay, onOpenIngredientPicker }) {
  const { people } = useListUsers();
  const { schedule, ensureLoaded } = useRecurring();
  const toast = useToast();
  const confirm = useConfirm();
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

  function savePlan() {
    const name = mealName.trim();
    const responsible = getResp();
    const ing = ingredients.split(",").map((s) => s.trim()).filter(Boolean);
    if (!name && !responsible) {
      onClose();
      return;
    }
    onClose();
    onSavePlan(iso, { meal_name: name || null, responsible, ingredients: ing });
  }

  async function deletePlanDay() {
    if (!(await confirm("Fjerne måltidet for denne dagen?", { title: "Fjerne måltid?", confirmLabel: "Fjern" })))
      return;
    onClose();
    onDeletePlanDay(iso);
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
        <LoadingState />
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
      <label htmlFor="meal-plan-name">Måltid (velg eller skriv nytt)</label>
      <div className="meal-name-field" ref={fieldRef}>
        <input
          id="meal-plan-name"
          autoComplete="off"
          value={mealName}
          onChange={(e) => onMealNameChange(e.target.value)}
          onFocus={() => setShowDropdown(true)}
          placeholder="F.eks. Taco"
        />
        <IconButton
          icon="caret-down"
          size="sm"
          variant="ghost"
          onClick={() => setShowDropdown((v) => !v)}
          label="Vis lagrede måltider"
          style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }}
        />
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
      <label htmlFor="meal-plan-ingredients">Ingredienser (kommaseparert)</label>
      <input
        id="meal-plan-ingredients"
        value={ingredients}
        onChange={(e) => setIngredients(e.target.value)}
        placeholder="F.eks. Kjøttdeig, Tortilla, Ost"
      />
      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
        Ingredienser huskes per måltid og deles for alle dager med samme navn.
      </div>
      <Button variant="outline" icon="shopping-cart-simple" onClick={pickIngredients} style={{ width: "100%", marginTop: 10 }}>
        Legg ingredienser på handlelisten
      </Button>
      <label htmlFor="meal-plan-resp">Ansvarlig</label>
      <select id="meal-plan-resp" value={respSelect} onChange={(e) => setRespSelect(e.target.value)}>
        <option value="">Ingen</option>
        {people.map((p) => (
          <option value={p} key={p}>{p}</option>
        ))}
        <option value="__other__">Annet...</option>
      </select>
      {respSelect === "__other__" && (
        <Input
          type="text"
          aria-label="Beskriv ansvarlig"
          placeholder="Beskriv (f.eks. Ute og spiser)"
          style={{ marginTop: 8 }}
          value={respOther}
          onChange={(e) => setRespOther(e.target.value)}
        />
      )}
      <div className="actions">
        <Button variant="outline" onClick={onClose}>Avbryt</Button>
        <Button variant="primary" onClick={savePlan}>Lagre</Button>
      </div>
      {(current.meal_name || current.responsible) && (
        <Button variant="danger" icon="trash" onClick={deletePlanDay} style={{ width: "100%", marginTop: 8 }}>
          Fjern måltid for denne dagen
        </Button>
      )}
    </Modal>
  );
}
