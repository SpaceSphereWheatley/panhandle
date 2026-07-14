import { useEffect, useState } from "react";
import { Modal } from "../Modal.jsx";
import { Button, LoadingState } from "../../design-system/index.js";
import { api } from "../../lib/api.js";
import { buildIngredientRows } from "../../lib/mealUtils.js";
import { useToast } from "../../context/ToastContext.jsx";
import { IngredientChecklist } from "./IngredientChecklist.jsx";

// From the meal modal's "+ Legg ingredienser på handlelisten": pick which of
// this meal's ingredients to add to the shopping list. Ingredients already on
// the active list are shown but left unchecked.
export function IngredientPickerModal({ ingredients, onClose }) {
  const toast = useToast();
  const [rows, setRows] = useState(null);

  useEffect(() => {
    (async () => {
      let onList = new Set();
      try {
        const items = await api("/list");
        onList = new Set(items.filter((it) => !it.bought).map((it) => it.name.toLowerCase()));
      } catch {
        /* offline — show everything checked */
      }
      const catalogue = await api("/catalogue").catch(() => []);
      const built = buildIngredientRows(ingredients, catalogue, onList).map((r) => ({ ...r, checked: !r.already }));
      setRows(built);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      failed = 0;
    for (const r of checked) {
      try {
        await api("/list", { method: "POST", body: JSON.stringify({ name: r.name, qty: 1, category: r.category }) });
        added++;
      } catch {
        failed++;
      }
    }
    onClose();
    if (failed) toast(`${added} lagt til, ${failed} feilet – sjekk nettforbindelsen`, { error: true });
    else toast(`${added} ${added === 1 ? "ingrediens" : "ingredienser"} lagt til på handlelisten`);
  }

  return (
    <Modal onClose={onClose}>
      <h3>Legg til på handlelisten</h3>
      <p className="cred-note">Velg hvilke ingredienser som skal på listen.</p>
      {rows === null ? <LoadingState /> : <IngredientChecklist rows={rows} onToggle={toggleRow} />}
      <div className="actions">
        <Button variant="outline" onClick={onClose}>Avbryt</Button>
        <Button variant="primary" onClick={confirmAdd}>Legg til valgte</Button>
      </div>
    </Modal>
  );
}
