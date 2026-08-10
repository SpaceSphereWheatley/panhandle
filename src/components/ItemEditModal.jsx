import { useState } from "react";
import { Modal } from "./Modal.jsx";
import { Button, Input } from "../design-system/index.js";
import { CATEGORIES, cap, parseSqliteDatetime } from "../lib/shoppingUtils.js";
import { api } from "../lib/api.js";
import { useConfirm } from "../context/ConfirmContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useListUsers } from "../context/ListUsersContext.jsx";
import { useLanguage, useTranslation } from "../context/LanguageContext.jsx";
import { translateItemName } from "../lib/i18n/itemNames.js";
import { translateCategoryName } from "../lib/i18n/categoryNames.js";
import { dateLocale } from "../lib/i18n/dateLocale.js";
import { apiErrorMessage } from "../lib/apiError.js";

// Formats a SQLite "YYYY-MM-DD HH:MM:SS" (UTC) timestamp for the "who/when"
// line below — day/month/year plus a 24h time, in the active UI language.
function formatActionDate(sqliteDatetime, lang) {
  const d = parseSqliteDatetime(sqliteDatetime);
  const locale = dateLocale(lang);
  const date = d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  return `${date}, ${time}`;
}

export function ItemEditModal({ item, onClose, onSaved, onDeletedFromCatalogue }) {
  const confirm = useConfirm();
  const toast = useToast();
  const { nameFor } = useListUsers();
  const { lang } = useLanguage();
  const t = useTranslation();
  // Guards against a double-tap double-submit on a slow connection, same
  // pattern as BoxEditModal.jsx's saving/deleting. Three separate write
  // actions here, so three separate flags (only ever one true at a time in
  // practice) rather than one shared boolean, so each button's own label can
  // swap to "Loading..." independently.
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [deletingCatalogue, setDeletingCatalogue] = useState(false);
  const busy = saving || removing || deletingCatalogue;
  const displayName = cap(translateItemName(item.name, lang));
  // The edit input starts out showing the translated name (so a Norwegian
  // user long-pressing "Melk" doesn't land on "Milk"), but translation is
  // still a display concern, not something a rename should rewrite: if the
  // field is saved unchanged, `save()` below sends the original canonical
  // `item.name` rather than the translated text, so the catalogue row's
  // stored (English) name and its icon/duplicate-detection matching are
  // untouched. Only an actual edit is sent as typed, same as before.
  const [name, setName] = useState(displayName);
  const [category, setCategory] = useState(item.category);
  const [qty, setQty] = useState(item.qty || 1);
  const [notes, setNotes] = useState(item.notes || "");
  // Just the latest of the two actions is shown — an edit (via this modal's
  // save) is more recent than the original add whenever edited_at is set and
  // sorts >= added_at (both SQLite "YYYY-MM-DD HH:MM:SS" UTC strings, so a
  // plain string compare is enough).
  const isLatestEdit = Boolean(item.edited_at) && (!item.added_at || item.edited_at >= item.added_at);
  const latestActionKey = isLatestEdit ? "itemEdit.editedBy" : "itemEdit.addedBy";
  const latestActionBy = isLatestEdit ? item.edited_by : item.added_by;
  const latestActionAt = isLatestEdit ? item.edited_at : item.added_at;

  return (
    <Modal onClose={onClose} title={displayName}>
      {(requestClose) => {
        async function save() {
          const trimmed = name.trim();
          if (!trimmed) {
            toast(t("itemEdit.emptyName"), { error: true });
            return;
          }
          // Unedited (still showing the translated name from initial state)
          // resolves back to the canonical stored name rather than sending
          // the translated text as a literal rename.
          const finalName = trimmed.toLowerCase() === displayName.toLowerCase() ? item.name : trimmed;
          setSaving(true);
          let res;
          try {
            res = await api(`/list/${item.id}`, {
              method: "PATCH",
              body: JSON.stringify({ name: finalName, category, qty: parseInt(qty, 10) || 1, notes: notes.trim() }),
            });
          } catch {
            setSaving(false);
            toast(t("shoppingList.toast.genericError"), { error: true });
            return;
          }
          if (res.error) {
            setSaving(false);
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
          setRemoving(true);
          let res;
          try {
            res = await api(`/list/${item.id}`, { method: "DELETE" });
          } catch {
            setRemoving(false);
            toast(t("shoppingList.toast.genericError"), { error: true });
            return;
          }
          if (res.error) {
            setRemoving(false);
            toast(apiErrorMessage(res, t), { error: true });
            return;
          }
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
          setDeletingCatalogue(true);
          let res;
          try {
            res = await api(`/list/${item.id}/catalogue`, { method: "DELETE" });
          } catch {
            setDeletingCatalogue(false);
            toast(t("shoppingList.toast.genericError"), { error: true });
            return;
          }
          if (res.error) {
            setDeletingCatalogue(false);
            toast(apiErrorMessage(res, t), { error: true });
            return;
          }
          requestClose(onDeletedFromCatalogue);
        }

        return (
          <>
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
              <Button variant="outline" disabled={busy} onClick={() => requestClose()}>{t("itemEdit.cancel")}</Button>
              <Button variant="primary" disabled={busy} onClick={save}>{t(saving ? "common.loading" : "itemEdit.save")}</Button>
            </div>
            <Button variant="outline" icon="trash" disabled={busy} onClick={removeFromList} style={{ width: "100%", marginTop: 8 }}>
              {t(removing ? "common.loading" : "itemEdit.removeFromList")}
            </Button>
            <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
              <Button variant="danger" size="sm" disabled={busy} onClick={deleteFromCatalogue}>
                {t(deletingCatalogue ? "common.loading" : "itemEdit.forgetCompletely")}
              </Button>
            </div>
            <div className="meta" style={{ marginTop: 12, textAlign: "center" }}>
              {t(latestActionKey, { name: nameFor(latestActionBy), date: formatActionDate(latestActionAt, lang) })}
            </div>
          </>
        );
      }}
    </Modal>
  );
}
