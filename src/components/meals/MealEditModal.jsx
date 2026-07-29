import { useEffect, useMemo, useState } from "react";
import { Modal } from "../Modal.jsx";
import { Button, Input } from "../../design-system/index.js";
import { TokenInput } from "./TokenInput.jsx";
import { api } from "../../lib/api.js";
import { parseIngredients, sortMealsByUsage, collectLabels, findMealByName, findSimilarMeals } from "../../lib/mealUtils.js";
import { useConfirm } from "../../context/ConfirmContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useTranslation } from "../../context/LanguageContext.jsx";
import { apiErrorMessage } from "../../lib/apiError.js";

// Add (id=null) or edit (id given) a meal_catalogue entry directly, outside
// of planning a specific day. Reachable from the Måltider tab's FAB and from
// each row of "Alle måltider".
export function MealEditModal({ id, onClose, onSaved }) {
  const confirm = useConfirm();
  const toast = useToast();
  const t = useTranslation();
  const [catalogue, setCatalogue] = useState([]);
  const [itemNames, setItemNames] = useState([]);
  const [name, setName] = useState("");
  const [ingredients, setIngredients] = useState([]);
  const [labels, setLabels] = useState([]);
  // Held as structured data ({ kind, names }) rather than a finished string,
  // so the note re-renders in the new language on a switch instead of being
  // frozen in whichever language was active when it was last typed.
  const [similarNote, setSimilarNote] = useState({ kind: null, names: [] });
  const [recipeUrl, setRecipeUrl] = useState("");
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    (async () => {
      const [rows, items] = await Promise.all([api("/meals"), api("/catalogue").catch(() => [])]);
      const sorted = sortMealsByUsage(rows);
      setCatalogue(sorted);
      setItemNames(items.map((it) => it.name));
      const meal = id ? sorted.find((m) => m.id === id) : null;
      if (meal) {
        setName(meal.name);
        setIngredients(parseIngredients(meal.ingredients));
        setLabels(parseIngredients(meal.labels));
      }
    })();
  }, [id]);

  const knownLabels = useMemo(() => collectLabels(catalogue), [catalogue]);

  // Live feedback while typing a meal name: an exact (case-insensitive) match
  // against another meal is a hard block (mirrors the server's duplicate
  // check), a substring match is just a heads-up.
  function checkSimilar(value) {
    if (!value.trim()) {
      setSimilarNote({ kind: null, names: [] });
      return;
    }
    const others = catalogue.filter((m) => m.id !== id);
    const exact = findMealByName(others, value);
    if (exact) {
      setSimilarNote({ kind: "duplicate", names: [exact.name] });
      return;
    }
    const similar = findSimilarMeals(others, value);
    setSimilarNote(
      similar.length
        ? { kind: "similar", names: similar.slice(0, 3).map((m) => m.name) }
        : { kind: null, names: [] }
    );
  }

  // Prefills name/ingredients from a pasted recipe URL's schema.org Recipe
  // JSON-LD (see POST /recipe-import) — the user still reviews/edits both
  // fields and saves via the normal flow below, same as typing them by hand.
  async function importFromUrl() {
    const url = recipeUrl.trim();
    if (!url || importing) return;
    setImporting(true);
    try {
      const res = await api("/recipe-import", { method: "POST", body: JSON.stringify({ url }) });
      if (res.error) {
        toast(apiErrorMessage(res, t), { error: true });
        return;
      }
      setName(res.name);
      checkSimilar(res.name);
      setIngredients(res.ingredients);
      setRecipeUrl("");
    } finally {
      setImporting(false);
    }
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast(t("meals.toast.emptyName"), { error: true });
      return;
    }
    const res = id
      ? await api(`/meals/${id}`, { method: "PATCH", body: JSON.stringify({ name: trimmed, ingredients, labels }) })
      : await api("/meals", { method: "POST", body: JSON.stringify({ name: trimmed, ingredients, labels }) });
    if (res.error) {
      toast(apiErrorMessage(res, t), { error: true });
      return;
    }
    onSaved();
  }

  // Removes the meal from the catalogue entirely — cascades to meal_plan, so
  // any day currently assigned this meal reverts to unplanned.
  async function deleteEntry() {
    const meal = catalogue.find((m) => m.id === id);
    if (!meal) return;
    if (
      !(await confirm(t("meals.confirm.deleteMeal.body", { name: meal.name }), {
        title: t("meals.confirm.deleteMeal.title"),
        confirmLabel: t("meals.confirm.deleteMeal.confirmLabel"),
      }))
    )
      return;
    await api(`/meals/${id}`, { method: "DELETE" });
    onSaved();
  }

  const isDuplicate = similarNote.kind === "duplicate";
  const similarText = !similarNote.kind
    ? ""
    : isDuplicate
      ? t("meals.edit.duplicateName", { name: similarNote.names[0] })
      : t("meals.edit.similarTo", { names: similarNote.names.join(", ") });

  return (
    <Modal onClose={onClose} title={t(id ? "meals.edit.title" : "meals.edit.newTitle")}>
      <label htmlFor="meal-edit-recipe-url">{t("meals.edit.importUrlLabel")}</label>
      <div style={{ display: "flex", gap: 8 }}>
        <Input
          id="meal-edit-recipe-url"
          value={recipeUrl}
          onChange={(e) => setRecipeUrl(e.target.value)}
          placeholder={t("meals.edit.importUrlPlaceholder")}
          style={{ flex: 1 }}
        />
        <Button variant="outline" onClick={importFromUrl} disabled={!recipeUrl.trim() || importing}>
          {t(importing ? "meals.edit.importingButton" : "meals.edit.importButton")}
        </Button>
      </div>
      <label htmlFor="meal-edit-name">{t("meals.edit.nameLabel")}</label>
      <Input
        id="meal-edit-name"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          checkSimilar(e.target.value);
        }}
        placeholder={t("meals.mealNamePlaceholder")}
      />
      <div style={{ fontSize: 12, marginTop: 4, minHeight: 14, color: isDuplicate ? "var(--status-danger)" : "var(--text-tertiary)" }}>
        {similarText}
      </div>
      <label htmlFor="meal-edit-ingredients">{t("meals.ingredientsLabel")}</label>
      {/* Canonical (untranslated) suggestions on purpose — see MealPlanModal. */}
      <TokenInput
        id="meal-edit-ingredients"
        value={ingredients}
        onChange={setIngredients}
        suggestions={itemNames}
        placeholder={t("meals.ingredientsPlaceholder")}
      />
      <label htmlFor="meal-edit-labels">{t("meals.edit.labelsLabel")}</label>
      <TokenInput
        id="meal-edit-labels"
        value={labels}
        onChange={setLabels}
        suggestions={knownLabels}
        placeholder={t("meals.edit.labelsPlaceholder")}
      />
      <div className="actions">
        <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="primary" onClick={save}>{t("common.save")}</Button>
      </div>
      {id && (
        <Button variant="danger" icon="trash" onClick={deleteEntry} style={{ width: "100%", marginTop: 8 }}>
          {t("meals.edit.deleteFromCatalogue")}
        </Button>
      )}
    </Modal>
  );
}
