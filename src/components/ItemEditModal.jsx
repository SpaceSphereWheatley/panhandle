import { useState } from "react";
import { Modal } from "./Modal.jsx";
import { Button, Input } from "../design-system/index.js";
import { CATEGORIES, cap } from "../lib/shoppingUtils.js";
import { api } from "../lib/api.js";
import { useConfirm } from "../context/ConfirmContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useListUsers } from "../context/ListUsersContext.jsx";
import { useLanguage, useTranslation } from "../context/LanguageContext.jsx";
import { translateItemName } from "../lib/i18n/itemNames.js";
import { translateCategoryName } from "../lib/i18n/categoryNames.js";
import { apiErrorMessage } from "../lib/apiError.js";

export function ItemEditModal({ item, onClose, onSaved, onDeletedFromCatalogue }) {
  const confirm = useConfirm();
  const toast = useToast();
  const { nameFor } = useListUsers();
  const { lang } = useLanguage();
  const t = useTranslation();
  // The edit input always operates on the canonical (Norwegian) stored name
  // — translation is a display concern (see itemNames.js), not something a
  // rename should rewrite. The modal title/confirm dialog below are
  // read-only, so those DO show the translated name for recognition.
  const [name, setName] = useState(cap(item.name));
  const [category, setCategory] = useState(item.category);
  const [qty, setQty] = useState(item.qty || 1);
  const [notes, setNotes] = useState(item.notes || "");
  const displayName = cap(translateItemName(item.name, lang));

  return (
    <Modal onClose={onClose} title={displayName}>
      {(requestClose) => {
        async function save() {
          const trimmed = name.trim();
          if (!trimmed) {
            toast(t("itemEdit.emptyName"), { error: true });
            return;
          }
          const res = await api(`/list/${item.id}`, {
            method: "PATCH",
            body: JSON.stringify({ name: trimmed, category, qty: parseInt(qty, 10) || 1, notes: notes.trim() }),
          });
          if (res.error) {
            toast(apiErrorMessage(res, t), { error: true });
            return;
          }
          requestClose(onSaved);
        }

        // Removes just this line from the shopping list. The catalogue entry
        // (name/category/purchase-history stats) is untouched, so the item is
        // still remembered and auto-suggested next time — this is the common
        // "I don't want this on my list anymore" action. Confirmed but
        // deliberately not alarming (danger: false) since it's easily reversible.
        async function removeFromList() {
          if (
            !(await confirm(t("itemEdit.confirmRemove.body", { name: displayName }), {
              title: t("itemEdit.confirmRemove.title"),
              confirmLabel: t("itemEdit.confirmRemove.confirmLabel"),
              danger: false,
            }))
          )
            return;
          await api(`/list/${item.id}`, { method: "DELETE" });
          requestClose(onSaved);
        }

        // Advanced: forgets this list's catalogue entry for the item entirely
        // (scoped to the user's list_id server-side) — cascades to delete every
        // list_items row referencing it, so past "Recently bought" entries
        // disappear too, not just future suggestions/stats. Other lists'
        // catalogues are unaffected.
        async function deleteFromCatalogue() {
          if (
            !(await confirm(t("itemEdit.confirmForget.body", { name: displayName }), {
              title: t("itemEdit.confirmForget.title"),
              confirmLabel: t("itemEdit.confirmForget.confirmLabel"),
            }))
          )
            return;
          await api(`/list/${item.id}/catalogue`, { method: "DELETE" });
          requestClose(onDeletedFromCatalogue);
        }

        return (
          <>
            <div className="meta">{t("itemEdit.addedBy", { name: nameFor(item.added_by) })}</div>
            <label htmlFor="item-edit-name">{t("itemEdit.nameLabel")}</label>
            <Input id="item-edit-name" value={name} onChange={(e) => setName(e.target.value)} />
            <label htmlFor="item-edit-category">{t("itemEdit.categoryLabel")}</label>
            {/* An explicit `value` is load-bearing now: without it an <option>'s
                value falls back to its text content, so a translated label would be
                what gets POSTed as the item's category. The value stays canonical;
                only the label is translated. */}
            <select id="item-edit-category" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{translateCategoryName(c, lang)}</option>
              ))}
            </select>
            <label htmlFor="item-edit-qty">{t("itemEdit.qtyLabel")}</label>
            <Input id="item-edit-qty" type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
            <label htmlFor="item-edit-notes">{t("itemEdit.notesLabel")}</label>
            <Input
              id="item-edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("itemEdit.notesPlaceholder")}
            />
            <div className="actions">
              <Button variant="outline" onClick={() => requestClose()}>{t("itemEdit.cancel")}</Button>
              <Button variant="primary" onClick={save}>{t("itemEdit.save")}</Button>
            </div>
            <Button variant="outline" icon="trash" onClick={removeFromList} style={{ width: "100%", marginTop: 8 }}>
              {t("itemEdit.removeFromList")}
            </Button>
            <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
              <Button variant="danger" size="sm" onClick={deleteFromCatalogue}>
                {t("itemEdit.forgetCompletely")}
              </Button>
            </div>
          </>
        );
      }}
    </Modal>
  );
}
