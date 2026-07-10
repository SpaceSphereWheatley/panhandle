import { useState } from "react";
import { Modal } from "./Modal.jsx";
import { CATEGORIES, cap } from "../lib/shoppingUtils.js";
import { api } from "../lib/api.js";

export function ItemEditModal({ item, onClose, onSaved, onDeletedFromCatalogue }) {
  const [name, setName] = useState(cap(item.name));
  const [category, setCategory] = useState(item.category);
  const [qty, setQty] = useState(item.qty || 1);
  const [notes, setNotes] = useState(item.notes || "");
  const [msg, setMsg] = useState("");

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      setMsg("Tomt navn");
      return;
    }
    const res = await api(`/list/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: trimmed, category, qty: parseInt(qty, 10) || 1, notes: notes.trim() }),
    });
    if (res.error) {
      setMsg(res.error);
      return;
    }
    onSaved();
  }

  // Deletes this list's catalogue entry for the item (scoped to the user's
  // list_id server-side) — the name is forgotten for this list, so it stops
  // being suggested by autocomplete. Other lists' catalogues are unaffected.
  async function deleteFromCatalogue() {
    if (
      !confirm(
        `Fjerne «${cap(item.name)}» helt fra listens lagrede varer? Den slettes fra handlelisten og blir ikke lenger foreslått automatisk. (Påvirker bare denne listen.)`
      )
    )
      return;
    await api(`/list/${item.id}/catalogue`, { method: "DELETE" });
    onDeletedFromCatalogue();
  }

  return (
    <Modal onClose={onClose}>
      <h3>{cap(item.name)}</h3>
      <div className="meta">Lagt til av {item.added_by}</div>
      <label>Navn</label>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <label>Kategori</label>
      <select value={category} onChange={(e) => setCategory(e.target.value)}>
        {CATEGORIES.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
      <label>Antall</label>
      <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
      <label>Notat (mengde, beskrivelse o.l.)</label>
      <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="F.eks. 2 liter" />
      <div style={{ fontSize: 13, marginTop: 8, minHeight: 16, color: "var(--status-danger)" }}>{msg}</div>
      <div className="actions">
        <button className="cancel" onClick={onClose}>Avbryt</button>
        <button className="save" onClick={save}>Lagre</button>
      </div>
      <button
        className="cancel"
        style={{ width: "100%", marginTop: 8, color: "var(--status-danger)" }}
        onClick={deleteFromCatalogue}
      >
        Slett vare fra katalog
      </button>
    </Modal>
  );
}
