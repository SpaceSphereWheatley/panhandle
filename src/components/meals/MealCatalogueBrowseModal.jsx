import { useEffect, useMemo, useState } from "react";
import { Modal } from "../Modal.jsx";
import { Button, IconButton, LoadingState, EmptyState } from "../../design-system/index.js";
import { api } from "../../lib/api.js";
import { parseIngredients } from "../../lib/mealUtils.js";
import { useLanguage, useTranslation } from "../../context/LanguageContext.jsx";
import { dateLocale } from "../../lib/i18n/dateLocale.js";

// Browse of every saved meal (meal_catalogue), with usage stats and a
// client-side name + label filter — there's no server-side search endpoint
// since the whole catalogue is already fetched by GET /meals for the
// planner's dropdown. Clicking a row opens it in the editor; the calendar
// icon (U26, "cook again") re-plans it onto the next open day instead.
export function MealCatalogueBrowseModal({ onClose, onOpenEdit, onPlanAgain }) {
  const t = useTranslation();
  const { lang } = useLanguage();
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
    <Modal onClose={onClose} title={t("meals.allMeals")}>
      <button className="meal-browse-add" onClick={() => onOpenEdit(null)}>+ {t("meals.fab.newMeal")}</button>
      <input placeholder={t("meals.browse.searchPlaceholder")} value={filter} onChange={(e) => setFilter(e.target.value)} />
      {labels.length > 0 && (
        <select value={labelFilter} onChange={(e) => setLabelFilter(e.target.value)} id="mealBrowseLabelSelect">
          <option value="">{t("meals.browse.allLabels")}</option>
          {labels.map((l) => (
            <option value={l} key={l}>{l}</option>
          ))}
        </select>
      )}
      <div style={{ marginTop: 10, maxHeight: "50vh", overflowY: "auto" }}>
        {meals === null ? (
          <LoadingState />
        ) : rows.length === 0 ? (
          <EmptyState
            description={t(filter.trim() || labelFilter ? "meals.browse.emptyFiltered" : "meals.browse.empty")}
          />
        ) : (
          rows.map((m) => {
            const count = parseIngredients(m.ingredients).length;
            const labels = parseIngredients(m.labels);
            const last = m.last_planned
              ? new Date(m.last_planned).toLocaleDateString(dateLocale(lang), { day: "numeric", month: "short", year: "numeric" })
              : t("meals.browse.never");
            return (
              <div className="meal-browse-row" key={m.id}>
                <button type="button" className="meal-browse-row-main" onClick={() => onOpenEdit(m.id)}>
                  <span className="info">
                    <span className="name">{m.name}</span>
                    <span className="stats">{t("meals.browse.stats", { planned: m.times_planned, last, ingredients: count })}</span>
                    {labels.length > 0 && (
                      <span className="labels">
                        {labels.map((l) => (
                          <span className="label-chip" key={l}>{l}</span>
                        ))}
                      </span>
                    )}
                  </span>
                </button>
                <IconButton
                  icon="calendar-plus"
                  size="md"
                  variant="subtle"
                  label={t("meals.browse.planAgain", { name: m.name })}
                  onClick={() => onPlanAgain(m)}
                />
              </div>
            );
          })
        )}
      </div>
      <div className="actions">
        <Button variant="primary" onClick={onClose}>{t("common.close")}</Button>
      </div>
    </Modal>
  );
}
