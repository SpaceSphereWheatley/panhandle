import { useEffect, useState } from "react";
import { Modal } from "../Modal.jsx";
import { Button, LoadingState } from "../../design-system/index.js";
import { api } from "../../lib/api.js";
import { buildIngredientRows, addRowsToList } from "../../lib/mealUtils.js";
import { useToast } from "../../context/ToastContext.jsx";
import { useTranslation } from "../../context/LanguageContext.jsx";
import { IngredientChecklist } from "./IngredientChecklist.jsx";

// From the meal modal's "+ Legg ingredienser på handlelisten": pick which of
// this meal's ingredients to add to the shopping list. Ingredients already on
// the active list are shown but left unchecked.
export function IngredientPickerModal({ ingredients, onClose }) {
  const toast = useToast();
  const t = useTranslation();
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
    const { added, merged, failed } = await addRowsToList(checked);
    onClose();
    if (failed) toast(t("meals.toast.addPartial", { added, failed }), { error: true });
    else if (added === 0 && merged > 0) toast(t("meals.toast.allAlreadyOnList"));
    else toast(t("meals.toast.ingredientsAdded", { count: added }));
  }

  return (
    <Modal onClose={onClose} title={t("meals.ingredientPicker.title")}>
      <p className="cred-note">{t("meals.ingredientPicker.intro")}</p>
      {rows === null ? <LoadingState /> : <IngredientChecklist rows={rows} onToggle={toggleRow} />}
      <div className="actions">
        <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="primary" onClick={confirmAdd}>{t("meals.addSelected")}</Button>
      </div>
    </Modal>
  );
}
