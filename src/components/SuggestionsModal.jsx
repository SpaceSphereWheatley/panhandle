import { useState } from "react";
import { Modal } from "./Modal.jsx";
import { Button, IconButton, EmptyState } from "../design-system/index.js";
import { api } from "../lib/api.js";
import { cap } from "../lib/shoppingUtils.js";
import { useLanguage, useTranslation } from "../context/LanguageContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { translateItemName } from "../lib/i18n/itemNames.js";
import { apiErrorMessage } from "../lib/apiError.js";

// The full "probably out of" list. Each row can be added, snoozed for a week,
// or hidden for good ("Don't suggest"); hidden items are listed in a
// collapsed section at the bottom so they can be restored. Snooze/hide go
// through the parent (shared with the shopping list's "Due soon" strip) so
// both surfaces stay in sync; restore lives here since nothing else shows
// hidden items.
export function SuggestionsModal({ suggestions, onAdd, onSnooze, onHide, onRestored, onClose, onFocusAdd }) {
  const { lang } = useLanguage();
  const t = useTranslation();
  const toast = useToast();
  // null = not loaded (section collapsed); [] once loaded.
  const [hidden, setHidden] = useState(null);
  const [hiddenLoading, setHiddenLoading] = useState(false);

  async function toggleHidden() {
    if (hidden !== null) {
      setHidden(null);
      return;
    }
    setHiddenLoading(true);
    try {
      const res = await api("/catalogue/suggestions/hidden");
      if (!Array.isArray(res)) throw new Error("bad_response");
      setHidden(res);
    } catch {
      toast(t("shoppingList.toast.genericError"), { error: true });
    } finally {
      setHiddenLoading(false);
    }
  }

  async function restore(it) {
    setHidden((prev) => (prev || []).filter((h) => h.id !== it.id));
    try {
      const res = await api(`/catalogue/${it.id}/suggestion`, {
        method: "PATCH",
        body: JSON.stringify({ muted: false }),
      });
      if (res?.error) {
        toast(apiErrorMessage(res, t), { error: true });
        return;
      }
      toast(t("suggestions.toast.restored", { name: cap(translateItemName(it.name, lang)) }));
      onRestored?.();
    } catch {
      toast(t("shoppingList.toast.genericError"), { error: true });
    }
  }

  return (
    <Modal onClose={onClose} title={t("suggestions.title")}>
      {(requestClose) => (
        <>
          <div>
            {suggestions.length === 0 ? (
              <EmptyState description={t("suggestions.empty")} />
            ) : (
              suggestions.map((it) => {
                const name = cap(translateItemName(it.name, lang));
                return (
                  <div className="meal-browse-row suggest-row" key={it.id}>
                    <span className="info">
                      <span className="name">{name}</span>
                      <span className="stats">
                        {t("suggestions.daysSinceAvg", {
                          days: Math.round(it.days_since),
                          avgDays: Math.round(it.avg_interval_days),
                        })}
                      </span>
                    </span>
                    <IconButton
                      icon="clock"
                      size="md"
                      label={t("suggestions.snoozeLabel", { name })}
                      onClick={() => onSnooze(it)}
                    />
                    <IconButton
                      icon="eye-slash"
                      size="md"
                      label={t("suggestions.hideLabel", { name })}
                      onClick={() => onHide(it)}
                    />
                    <IconButton
                      icon="plus"
                      size="lg"
                      variant="filled"
                      label={t("suggestions.addLabel", { name })}
                      onClick={() => onAdd(it)}
                    />
                  </div>
                );
              })
            )}
            {suggestions.length > 0 && <p className="suggest-hint">{t("suggestions.actionsHint")}</p>}

            <button
              type="button"
              className="suggest-hidden-toggle"
              aria-expanded={hidden !== null}
              onClick={toggleHidden}
              disabled={hiddenLoading}
            >
              {t(hidden !== null ? "suggestions.hidden.collapse" : "suggestions.hidden.expand")}
            </button>
            {hidden !== null &&
              (hidden.length === 0 ? (
                <p className="suggest-hint">{t("suggestions.hidden.empty")}</p>
              ) : (
                hidden.map((it) => {
                  const name = cap(translateItemName(it.name, lang));
                  return (
                    <div className="meal-browse-row suggest-row" key={it.id}>
                      <span className="info">
                        <span className="name">{name}</span>
                      </span>
                      <Button variant="outline" size="sm" onClick={() => restore(it)}>
                        {t("suggestions.hidden.restore")}
                      </Button>
                    </div>
                  );
                })
              ))}
          </div>
          <div className="actions">
            <Button variant="outline" onClick={requestClose}>
              {t("common.close")}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                onFocusAdd();
                requestClose();
              }}
            >
              {t("suggestions.addOther")}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
