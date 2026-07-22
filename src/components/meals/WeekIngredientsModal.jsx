import { useEffect, useState } from "react";
import { Modal } from "../Modal.jsx";
import { Button, LoadingState, EmptyState } from "../../design-system/index.js";
import { api } from "../../lib/api.js";
import { buildIngredientRows, parseIngredients, localIso, mondayOf } from "../../lib/mealUtils.js";
import { useToast } from "../../context/ToastContext.jsx";
import { IngredientChecklist } from "./IngredientChecklist.jsx";

// The shopping tab's FAB primary action: pull every ingredient from this (or
// next) week's planned meals into a checkable "add to shopping list" list.
// Monday–Thursday looks at the current week; Friday–Sunday looks ahead to
// next week, since that's the week you're actually about to shop for.
export function WeekIngredientsModal({ onClose, onAdded }) {
  const toast = useToast();
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
        toast("Kunne ikke hente middagsplanen – sjekk nettforbindelsen", { error: true });
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
    if (failed) toast(`${added} lagt til, ${failed} feilet – sjekk nettforbindelsen`, { error: true });
    else if (added === 0 && merged > 0) toast("Alle valgte lå allerede på listen");
    else toast(`${added} ${added === 1 ? "ingrediens" : "ingredienser"} lagt til på handlelisten`);
  }

  const weekLabel = nextWeek ? "Neste uke" : "Denne uken";
  const dateRange = `${monday.toLocaleDateString("no-NO", { day: "numeric", month: "short" })} – ${sunday.toLocaleDateString("no-NO", { day: "numeric", month: "short" })}`;

  return (
    <Modal onClose={onClose} title="Fra middagsplanen">
      <p className="cred-note">
        {weekLabel} ({dateRange}) · velg hvilke ingredienser som skal på listen.
      </p>
      {rows === null ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState description="Ingen ingredienser planlagt denne perioden." />
      ) : (
        <IngredientChecklist rows={rows} onToggle={toggleRow} />
      )}
      <div className="actions">
        <Button variant="outline" onClick={onClose}>Avbryt</Button>
        <Button variant="primary" onClick={confirmAdd}>Legg til valgte</Button>
      </div>
    </Modal>
  );
}
