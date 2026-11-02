import { useEffect, useState } from "react";
import { Modal } from "./Modal.jsx";
import { Button, IconButton, Input, LoadingState, EmptyState } from "../design-system/index.js";
import { api } from "../lib/api.js";
import { buildIngredientRows, addRowsToList } from "../lib/mealUtils.js";
import { haptic } from "../lib/shoppingUtils.js";
import { useToast } from "../context/ToastContext.jsx";
import { useConfirm } from "../context/ConfirmContext.jsx";
import { useTranslation } from "../context/LanguageContext.jsx";
import { apiErrorMessage } from "../lib/apiError.js";
import { IngredientChecklist } from "./meals/IngredientChecklist.jsx";
import { TokenInput } from "./meals/TokenInput.jsx";

// Saved lists ("Cabin trip", "Taco night"): named sets of items the
// household adds to the shopping list in one go. One sheet, three views:
//   list → the household's saved lists (tap one to add it, pencil to edit)
//   add  → pick which of its items go on the list (the meal ingredient
//          checklist — items already on the list start unchecked)
//   edit → name + items (token input with catalogue suggestions), or a new one
// Items are free-typed names resolved against the catalogue only when added
// (buildIngredientRows), exactly like meal ingredients, so a saved list never
// goes stale when a catalogue item is renamed or forgotten.
export function SavedListsModal({ onClose, onAdded }) {
  const t = useTranslation();
  const toast = useToast();
  const confirm = useConfirm();
  const [templates, setTemplates] = useState(null);
  const [catalogue, setCatalogue] = useState([]);
  // { kind: "list" } | { kind: "add", template, rows } | { kind: "edit", template | null }
  const [view, setView] = useState({ kind: "list" });
  const [name, setName] = useState("");
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const res = await api("/templates");
      if (!Array.isArray(res)) throw new Error("bad_response");
      setTemplates(res);
    } catch {
      setTemplates([]);
      toast(t("shoppingList.toast.genericError"), { error: true });
    }
  }

  useEffect(() => {
    load();
    api("/catalogue").then((c) => Array.isArray(c) && setCatalogue(c)).catch(() => {});
  }, []);

  async function openAdd(template) {
    let onList = new Set();
    try {
      const listItems = await api("/list");
      onList = new Set(listItems.filter((it) => !it.bought).map((it) => it.name.toLowerCase()));
    } catch {
      /* offline: show everything checked */
    }
    const rows = buildIngredientRows(template.items, catalogue, onList).map((r) => ({ ...r, checked: !r.already }));
    setView({ kind: "add", template, rows });
  }

  function openEdit(template) {
    setName(template ? template.name : "");
    setItems(template ? template.items : []);
    setView({ kind: "edit", template });
  }

  function toggleRow(idx) {
    setView((v) => ({ ...v, rows: v.rows.map((r, i) => (i === idx ? { ...r, checked: !r.checked } : r)) }));
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast(t("savedLists.emptyName"), { error: true });
      return;
    }
    const editing = view.template;
    setBusy(true);
    let res;
    try {
      res = await api(editing ? `/templates/${editing.id}` : "/templates", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify({ name: trimmed, items }),
      });
    } catch {
      setBusy(false);
      toast(t("shoppingList.toast.genericError"), { error: true });
      return;
    }
    setBusy(false);
    if (res?.error) {
      toast(apiErrorMessage(res, t), { error: true });
      return;
    }
    haptic();
    await load();
    setView({ kind: "list" });
  }

  async function remove() {
    const template = view.template;
    if (
      !(await confirm(t("savedLists.confirmDelete.body", { name: template.name }), {
        title: t("savedLists.confirmDelete.title"),
        confirmLabel: t("savedLists.confirmDelete.confirmLabel"),
      }))
    )
      return;
    setBusy(true);
    let res;
    try {
      res = await api(`/templates/${template.id}`, { method: "DELETE" });
    } catch {
      setBusy(false);
      toast(t("shoppingList.toast.genericError"), { error: true });
      return;
    }
    setBusy(false);
    if (res?.error) {
      toast(apiErrorMessage(res, t), { error: true });
      return;
    }
    haptic();
    await load();
    setView({ kind: "list" });
  }

  const title =
    view.kind === "add"
      ? view.template.name
      : view.kind === "edit"
        ? t(view.template ? "savedLists.editTitle" : "savedLists.newTitle")
        : t("savedLists.title");

  return (
    <Modal onClose={onClose} title={title}>
      {(requestClose) => {
        async function confirmAdd() {
          const checked = view.rows.filter((r) => r.checked);
          if (!checked.length) {
            setView({ kind: "list" });
            return;
          }
          setBusy(true);
          haptic();
          const { added, merged, failed } = await addRowsToList(checked);
          setBusy(false);
          requestClose(onAdded);
          if (failed) toast(t("meals.toast.addPartial", { added, failed }), { error: true });
          else if (added === 0 && merged > 0) toast(t("meals.toast.allAlreadyOnList"));
          else toast(t("savedLists.toast.added", { count: added, name: view.template.name }));
        }

        if (view.kind === "add") {
          return (
            <>
              {view.rows.length === 0 ? (
                <EmptyState description={t("savedLists.emptyItems")} />
              ) : (
                <>
                  <p className="cred-note">{t("savedLists.addIntro")}</p>
                  <IngredientChecklist rows={view.rows} onToggle={toggleRow} />
                </>
              )}
              <div className="actions">
                <Button variant="outline" disabled={busy} onClick={() => setView({ kind: "list" })}>
                  {t("savedLists.back")}
                </Button>
                <Button variant="primary" disabled={busy || view.rows.length === 0} onClick={confirmAdd}>
                  {t(busy ? "common.loading" : "meals.addSelected")}
                </Button>
              </div>
            </>
          );
        }

        if (view.kind === "edit") {
          return (
            <>
              <label htmlFor="saved-list-name">{t("savedLists.nameLabel")}</label>
              <Input
                id="saved-list-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("savedLists.namePlaceholder")}
              />
              <label htmlFor="saved-list-items">{t("savedLists.itemsLabel")}</label>
              {/* Canonical (untranslated) suggestions on purpose — same as meal
                  ingredients: the stored value is what gets name-matched later. */}
              <TokenInput
                id="saved-list-items"
                value={items}
                onChange={setItems}
                suggestions={catalogue.map((c) => c.name)}
                placeholder={t("savedLists.itemsPlaceholder")}
              />
              <div className="actions">
                <Button variant="outline" disabled={busy} onClick={() => setView({ kind: "list" })}>
                  {t("common.cancel")}
                </Button>
                <Button variant="primary" disabled={busy} onClick={save}>
                  {t(busy ? "common.loading" : "savedLists.save")}
                </Button>
              </div>
              {view.template && (
                <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
                  <Button variant="danger" size="sm" disabled={busy} onClick={remove}>
                    {t("savedLists.delete")}
                  </Button>
                </div>
              )}
            </>
          );
        }

        return (
          <>
            {templates === null ? (
              <LoadingState />
            ) : templates.length === 0 ? (
              <EmptyState description={t("savedLists.empty")} />
            ) : (
              <div>
                {templates.map((tpl) => (
                  <div className="meal-browse-row" key={tpl.id}>
                    <button type="button" className="meal-browse-row-main" onClick={() => openAdd(tpl)}>
                      <span className="info">
                        <span className="name" style={{ display: "block" }}>{tpl.name}</span>
                        <span className="stats" style={{ display: "block" }}>
                          {t("savedLists.itemCount", { count: tpl.items.length })}
                        </span>
                      </span>
                    </button>
                    <IconButton icon="pencil-simple" size="md" label={t("savedLists.editLabel", { name: tpl.name })} onClick={() => openEdit(tpl)} />
                  </div>
                ))}
              </div>
            )}
            <div className="actions">
              <Button variant="outline" onClick={() => requestClose()}>{t("common.close")}</Button>
              <Button variant="primary" icon="plus" onClick={() => openEdit(null)}>{t("savedLists.new")}</Button>
            </div>
          </>
        );
      }}
    </Modal>
  );
}
