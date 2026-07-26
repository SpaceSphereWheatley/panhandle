import { useEffect, useRef, useState } from "react";
import { Modal } from "../Modal.jsx";
import { Button } from "../../design-system/components/forms/Button.jsx";
import { Input } from "../../design-system/components/forms/Input.jsx";
import { IconButton } from "../../design-system/components/forms/IconButton.jsx";
import { LoadingState } from "../../design-system/components/data-display/Spinner.jsx";
import { TokenInput } from "./TokenInput.jsx";
import { api } from "../../lib/api.js";
import { parseIngredients } from "../../lib/mealUtils.js";
import { useListUsers } from "../../context/ListUsersContext.jsx";
import { useRecurring } from "../../context/RecurringContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useConfirm } from "../../context/ConfirmContext.jsx";
import { useTranslation } from "../../context/LanguageContext.jsx";

// Plans/edits a single day: meal name (with a dropdown of known meals),
// ingredients, and a responsible person (list member, or free-text "Annet").
export function MealPlanModal({ iso, onClose, onSavePlan, onDeletePlanDay, onOpenIngredientPicker }) {
  const { people, nameFor } = useListUsers();
  const { schedule, ensureLoaded } = useRecurring();
  const toast = useToast();
  const confirm = useConfirm();
  const t = useTranslation();
  const [loading, setLoading] = useState(true);
  const [mealCatalogue, setMealCatalogue] = useState([]);
  const [itemNames, setItemNames] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [current, setCurrent] = useState({});
  const [mealName, setMealName] = useState("");
  const [ingredients, setIngredients] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [respSelect, setRespSelect] = useState("");
  const [respOther, setRespOther] = useState("");
  const fieldRef = useRef(null);

  useEffect(() => {
    (async () => {
      await ensureLoaded();
      let meals, plan, sugg, items;
      try {
        [meals, plan, sugg, items] = await Promise.all([
          api("/meals"),
          api(`/plan?from=${iso}&to=${iso}`),
          api("/meals/suggestions").catch(() => []),
          api("/catalogue").catch(() => []),
        ]);
      } catch {
        toast(t("meals.toast.loadFailed"), { error: true });
        onClose();
        return;
      }
      setMealCatalogue(meals);
      setItemNames(items.map((it) => it.name));
      setSuggestions(sugg);
      const cur = plan[0] || {};
      setCurrent(cur);
      setMealName(cur.meal_name || "");
      setIngredients(parseIngredients(cur.ingredients));
      const dow = (new Date(iso).getDay() + 6) % 7;
      const def = !cur.responsible ? schedule[dow] || "" : "";
      const resp = cur.responsible || "";
      const knownPeople = people;
      const isOther = resp && !knownPeople.includes(resp);
      setRespSelect(isOther ? "__other__" : resp || (def ? def : ""));
      setRespOther(isOther ? resp : "");
      setLoading(false);
    })();
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
    if (match) setIngredients(parseIngredients(match.ingredients));
    setShowDropdown(true);
  }

  function pickMeal(m) {
    setMealName(m.name);
    setIngredients(parseIngredients(m.ingredients));
    setShowDropdown(false);
  }

  function getResp() {
    // "Annet" here is a *stored* value (meal_plan.responsible), not display
    // text — it's written to the DB and read back by every other device
    // regardless of that device's language, so it stays canonical Norwegian.
    // Only the picker's own option label above is translated.
    if (respSelect === "__other__") return respOther.trim() || "Annet";
    return respSelect;
  }

  function savePlan() {
    const name = mealName.trim();
    const responsible = getResp();
    if (!name && !responsible) {
      onClose();
      return;
    }
    onClose();
    onSavePlan(iso, { meal_name: name || null, responsible, ingredients });
  }

  async function deletePlanDay() {
    if (
      !(await confirm(t("meals.confirm.deleteDay.body"), {
        title: t("meals.confirm.deleteDay.title"),
        confirmLabel: t("meals.confirm.deleteDay.confirmLabel"),
      }))
    )
      return;
    onClose();
    onDeletePlanDay(iso);
  }

  // Persist the meal first so typed ingredients are remembered, then swap to
  // the ingredient picker.
  async function pickIngredients() {
    const name = mealName.trim();
    if (!ingredients.length) {
      toast(t("meals.toast.ingredientsFirst"));
      return;
    }
    if (name) {
      try {
        await api("/plan", {
          method: "POST",
          body: JSON.stringify({ plan_date: iso, meal_name: name, responsible: getResp(), ingredients }),
        });
      } catch {
        toast(t("meals.toast.saveFailed"), { error: true });
        return;
      }
    }
    onOpenIngredientPicker(ingredients, iso);
  }

  if (loading) {
    return (
      <Modal onClose={onClose} title={t("meals.plan.title")}>
        <LoadingState />
      </Modal>
    );
  }

  const dropdownMatches = mealCatalogue.filter(
    (m) => !mealName.trim() || m.name.toLowerCase().includes(mealName.trim().toLowerCase())
  );

  return (
    <Modal onClose={onClose} title={t("meals.plan.title")}>
      {suggestions.length > 0 && (
        <>
          <label>{t("meals.plan.suggestionsLabel")}</label>
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
      <label htmlFor="meal-plan-name">{t("meals.plan.mealLabel")}</label>
      <div className="meal-name-field" ref={fieldRef}>
        <input
          id="meal-plan-name"
          autoComplete="off"
          value={mealName}
          onChange={(e) => onMealNameChange(e.target.value)}
          onFocus={() => setShowDropdown(true)}
          placeholder={t("meals.mealNamePlaceholder")}
        />
        <IconButton
          icon="caret-down"
          size="md"
          variant="ghost"
          onClick={() => setShowDropdown((v) => !v)}
          label={t("meals.plan.showSaved")}
          style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }}
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
              {t(mealName.trim() ? "meals.plan.noSavedMealsMatching" : "meals.plan.noSavedMeals")}
            </div>
          )}
        </div>
      </div>
      <label htmlFor="meal-plan-ingredients">{t("meals.ingredientsLabel")}</label>
      {/* `suggestions` stay canonical (untranslated) on purpose: a committed
          token is *stored* in meal_catalogue.ingredients and later matched
          back against item_catalogue by name (buildIngredientRows), so
          offering an English name here would persist one. */}
      <TokenInput
        id="meal-plan-ingredients"
        value={ingredients}
        onChange={setIngredients}
        suggestions={itemNames}
        placeholder={t("meals.ingredientsPlaceholder")}
      />
      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
        {t("meals.plan.ingredientsHint")}
      </div>
      <Button variant="outline" icon="shopping-cart-simple" onClick={pickIngredients} style={{ width: "100%", marginTop: 10 }}>
        {t("meals.plan.addIngredientsToList")}
      </Button>
      <label htmlFor="meal-plan-resp">{t("meals.responsibleLabel")}</label>
      <select id="meal-plan-resp" value={respSelect} onChange={(e) => setRespSelect(e.target.value)}>
        <option value="">{t("meals.responsible.none")}</option>
        {people.map((p) => (
          <option value={p} key={p}>{nameFor(p)}</option>
        ))}
        <option value="__other__">{t("meals.responsible.other")}</option>
      </select>
      {respSelect === "__other__" && (
        <Input
          type="text"
          aria-label={t("meals.responsible.describeAria")}
          placeholder={t("meals.responsible.describePlaceholder")}
          style={{ marginTop: 8 }}
          value={respOther}
          onChange={(e) => setRespOther(e.target.value)}
        />
      )}
      <div className="actions">
        <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="primary" onClick={savePlan}>{t("common.save")}</Button>
      </div>
      {(current.meal_name || current.responsible) && (
        <Button variant="danger" icon="trash" onClick={deletePlanDay} style={{ width: "100%", marginTop: 8 }}>
          {t("meals.plan.removeDay")}
        </Button>
      )}
    </Modal>
  );
}
