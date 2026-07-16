import { useState } from "react";
import { Modal } from "./Modal.jsx";
import { Button, Input } from "../design-system/index.js";
import { CATEGORIES, cap } from "../lib/shoppingUtils.js";
import { api } from "../lib/api.js";
import { useConfirm } from "../context/ConfirmContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useListUsers } from "../context/ListUsersContext.jsx";

export function ItemEditModal({ item, onClose, onSaved, onDeletedFromCatalogue }) {
  const confirm = useConfirm();
  const toast = useToast();
  const { nameFor } = useListUsers();
  const [name, setName] = useState(cap(item.name));
  const [category, setCategory] = useState(item.category);
  const [qty, setQty] = useState(item.qty || 1);
  const [notes, setNotes] = useState(item.notes || "");

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast("Tomt navn", { error: true });
      return;
    }
    const res = await api(`/list/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: trimmed, category, qty: parseInt(qty, 10) || 1, notes: notes.trim() }),
    });
    if (res.error) {
      toast(res.error, { error: true });
      return;
    }
    onSaved();
  }

  // Removes just this line from the shopping list. The catalogue entry
  // (name/category/purchase-history stats) is untouched, so the item is
  // still remembered and auto-suggested next time — this is the common
  // "I don't want this on my list anymore" action.
  async function removeFromList() {
    await api(`/list/${item.id}`, { method: "DELETE" });
    onSaved();
  }

  // Advanced: forgets this list's catalogue entry for the item entirely
  // (scoped to the user's list_id server-side) — resets its purchase-history
  // stats (the "you're probably low on X" suggestions start from zero again)
  // and it stops being auto-suggested. Other lists' catalogues are unaffected.
  async function deleteFromCatalogue() {
    if (
      !(await confirm(
        `Glemme «${cap(item.name)}» helt fra listens lagrede varer? Kjøpshistorikken nullstilles, og den blir ikke lenger foreslått automatisk. (Påvirker bare denne listen.)`,
        { title: "Glemme vare?", confirmLabel: "Glem" }
      ))
    )
      return;
    await api(`/list/${item.id}/catalogue`, { method: "DELETE" });
    onDeletedFromCatalogue();
  }

  return (
    <Modal onClose={onClose} title={cap(item.name)}>
      <div className="meta">Lagt til av {nameFor(item.added_by)}</div>
      <label htmlFor="item-edit-name">Navn</label>
      <Input id="item-edit-name" value={name} onChange={(e) => setName(e.target.value)} />
      <label htmlFor="item-edit-category">Kategori</label>
      <select id="item-edit-category" value={category} onChange={(e) => setCategory(e.target.value)}>
        {CATEGORIES.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
      <label htmlFor="item-edit-qty">Antall</label>
      <Input id="item-edit-qty" type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
      <label htmlFor="item-edit-notes">Notat (mengde, beskrivelse o.l.)</label>
      <Input id="item-edit-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="F.eks. 2 liter" />
      <div className="actions">
        <Button variant="outline" onClick={onClose}>Avbryt</Button>
        <Button variant="primary" onClick={save}>Lagre</Button>
      </div>
      <Button variant="danger" icon="trash" onClick={removeFromList} style={{ width: "100%", marginTop: 8 }}>
        Fjern fra listen
      </Button>
      <button
        type="button"
        onClick={deleteFromCatalogue}
        style={{
          width: "100%",
          marginTop: 8,
          padding: "4px 0",
          background: "none",
          border: "none",
          color: "var(--text-tertiary)",
          fontSize: 12,
          textDecoration: "underline",
          cursor: "pointer",
        }}
      >
        Glem vare og kjøpshistorikk helt
      </button>
    </Modal>
  );
}
