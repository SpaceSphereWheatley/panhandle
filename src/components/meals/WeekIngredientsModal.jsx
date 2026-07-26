import { useEffect, useState } from "react";
import { Modal } from "../Modal.jsx";
import { Button, LoadingState, EmptyState } from "../../design-system/index.js";
import { api } from "../../lib/api.js";
import { buildIngredientRows, parseIngredients, localIso, mondayOf } from "../../lib/mealUtils.js";
import { useToast } from "../../context/ToastContext.jsx";
import { useLanguage, useTranslation } from "../../context/LanguageContext.jsx";
import { dateLocale } from "../../lib/i18n/dateLocale.js";
import { IngredientChecklist } from "./IngredientChecklist.jsx";

// The shopping tab's FAB primary action: pull every ingredient from this (or
// next) week's planned meals into a checkable "add to shopping list" list.
// Monday–Thursday looks at the current week; Friday–Sunday looks ahead to
// next week, since that's the week you're actually about to shop for.
export function WeekIngredientsModal({ onClose, onAdded }) {
  const toast = useToast();
  const t = useTranslation();
  const { lang } = useLanguage();
  const [rows, setRows] = useState(null);

  const today = new Date();
  const dow = (today.getDay() + 6) % 7; // 0 = Monday .. 6 = Sunday
  const nextWeek = dow >= 4; // Fri/Sat/Sun
  const monday = mondayOf(today);
  if (nextWeek) monday.setDate(monday.getDate() + 7);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);

  useEffect(() => {
    (async () => {
      let onList = new Set();
      try {
        const items = await api("/list");
        onList = new Set(items.filter((it) => !it.bought).map((it) => it.name.toLowerCase()));
      } catch {
        /* offline — show everything unmarked */
      }
      let plan = [];
      try {
        plan = await api(`/plan?from=${localIso(monday)}&to=${localIso(sunday)}`);
      } catch {
        toast(t("meals.toast.planLoadFailed"), { error: true });
      }
      const catalogue = await api("/catalogue").catch(() => []);
      const ingredients = plan.flatMap((p) => parseIngredients(p.ingredients));
      const built = buildIngredientRows(ingredients, catalogue, onList).map((r) => ({ ...r, checked: false }));
      setRows(built);
    })();
  }, []);

  function toggleRow(idx) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, checked: !r.checked } : r)));
  }

  async function confirmAdd() {
    const checked = (rows || []).filter((r) => r.checked);
    if (!checked.length) {
      onClose();
      return;
    }
    let added = 0,
      merged = 0,
      failed = 0;
    for (const r of checked) {
      try {
        const res = await api("/list", { method: "POST", body: JSON.stringify({ name: r.name, qty: 1, category: r.category }) });
        // A { duplicate: true } response means the qty was bumped on a line
        // already on the list — not a genuinely new ingredient, so don't count
        // it as one (it would otherwise overstate the "added" total).
        if (res?.duplicate) merged++;
        else added++;
      } catch {
        failed++;
      }
    }
    await onAdded?.();
    onClose();
    if (failed) toast(t("meals.toast.addPartial", { added, failed }), { error: true });
    else if (added === 0 && merged > 0) toast(t("meals.toast.allAlreadyOnList"));
    else toast(t("meals.toast.ingredientsAdded", { count: added }));
  }

  const weekLabel = t(nextWeek ? "meals.week.next" : "meals.week.this");
  const fmt = { day: "numeric", month: "short" };
  const dateRange = `${monday.toLocaleDateString(dateLocale(lang), fmt)} – ${sunday.toLocaleDateString(dateLocale(lang), fmt)}`;

  return (
    <Modal onClose={onClose} title={t("meals.weekIngredients.title")}>
      <p className="cred-note">{t("meals.weekIngredients.intro", { week: weekLabel, range: dateRange })}</p>
      {rows === null ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState description={t("meals.weekIngredients.empty")} />
      ) : (
        <IngredientChecklist rows={rows} onToggle={toggleRow} />
      )}
      <div className="actions">
        <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="primary" onClick={confirmAdd}>{t("meals.addSelected")}</Button>
      </div>
    </Modal>
  );
}
