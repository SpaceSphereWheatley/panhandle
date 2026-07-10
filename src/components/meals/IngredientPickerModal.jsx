import { useEffect, useState } from "react";
import { Modal } from "../Modal.jsx";
import { api } from "../../lib/api.js";
import { matchCatalogue, cap } from "../../lib/shoppingUtils.js";
import { useToast } from "../../context/ToastContext.jsx";

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
      const seen = new Set();
      const built = [];
      for (const raw of ingredients) {
        const match = matchCatalogue(raw, catalogue)[0];
        const name = match ? match.name : raw;
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        built.push({ name, category: match ? match.category : "Annet", already: onList.has(key), checked: !onList.has(key) });
      }
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
      <div className="ing-list">
        {(rows || []).map((r, i) => (
          <label className="ing-row" key={r.name}>
            <input type="checkbox" checked={r.checked} onChange={() => toggleRow(i)} />
            <span className="ing-name">{cap(r.name)}</span>
            {r.already && <span className="ing-tag">allerede på listen</span>}
          </label>
        ))}
      </div>
      <div className="actions">
        <button className="cancel" onClick={onClose}>Avbryt</button>
        <button className="save" onClick={confirmAdd}>Legg til valgte</button>
      </div>
    </Modal>
  );
}
