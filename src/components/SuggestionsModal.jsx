import { useState } from "react";
import { Modal } from "./Modal.jsx";
import { Button, IconButton, EmptyState } from "../design-system/index.js";
import { api } from "../lib/api.js";
import { cap } from "../lib/shoppingUtils.js";
import { useLanguage, useTranslation } from "../context/LanguageContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { translateItemName } from "../lib/i18n/itemNames.js";
import { apiErrorMessage } from "../lib/apiError.js";
import { useLongPress } from "../hooks/useLongPress.js";
import { ItemIcon } from "./ItemIcon.jsx";
import { StockMark } from "./StockMark.jsx";
import { STOCK_ORDER, isLearning, stockStatusOf } from "../lib/stock.js";

// The full "probably out of" view: a grid of tiles tinted by stock level (red
// out, yellow running low, green fine for now), each with a shape mark so the
// colour is never the only cue. Tap a tile to add it; hold it (or right-click)
// for its details, where it can also be snoozed for a week or hidden for good
// ("Don't suggest"). Hidden items are listed in a
// collapsed section at the bottom so they can be restored. Snooze/hide go
// through the parent (shared with the shopping list's "Due soon" strip) so
// both surfaces stay in sync; restore lives here since nothing else shows
// hidden items.
function SuggestionTile({ item, onAdd, onDetails }) {
  const { lang } = useLanguage();
  const t = useTranslation();
  const longPress = useLongPress(() => onDetails(item));
  const status = stockStatusOf(item);
  const name = cap(translateItemName(item.name, lang));
  return (
    <button
      type="button"
      className={`stock-tile stock-${status}${isLearning(item) ? " learning" : ""}`}
      aria-label={t("suggestions.tileLabel", { name, status: t(`suggestions.status.${status}`) })}
      onClick={() => onAdd(item)}
      onContextMenu={(e) => {
        e.preventDefault();
        onDetails(item);
      }}
      {...longPress}
    >
      <span className="stock-tile-mark">
        <StockMark status={status} />
      </span>
      <span className="stock-badge" aria-hidden="true">
        <span className="item-icon-wrap">
          <ItemIcon name={item.name} />
        </span>
      </span>
      <span className="stock-tile-name">{name}</span>
    </button>
  );
}

export function SuggestionsModal({ suggestions, onAdd, onSnooze, onHide, onRestored, onClose, onFocusAdd }) {
  const { lang } = useLanguage();
  const t = useTranslation();
  const toast = useToast();
  // null = not loaded (section collapsed); [] once loaded.
  const [hidden, setHidden] = useState(null);
  const [hiddenLoading, setHiddenLoading] = useState(false);
  // The tile whose details view is open, or null for the grid.
  const [detail, setDetail] = useState(null);

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
      {(requestClose) =>
        detail ? (
          <SuggestionDetail
            item={suggestions.find((s) => s.id === detail.id) || detail}
            onBack={() => setDetail(null)}
            onAdd={(it) => {
              setDetail(null);
              onAdd(it);
            }}
            onSnooze={(it) => {
              setDetail(null);
              onSnooze(it);
            }}
            onHide={(it) => {
              setDetail(null);
              onHide(it);
            }}
          />
        ) : (
        <>
          <div>
            {suggestions.length === 0 ? (
              <EmptyState description={t("suggestions.empty")} />
            ) : (
              <>
                <div className="stock-legend" aria-hidden="true">
                  {STOCK_ORDER.map((st) => (
                    <span key={st} className={`stock-${st}`}>
                      <StockMark status={st} />
                      {t(`suggestions.status.${st}`)}
                    </span>
                  ))}
                </div>
                <div className="stock-grid">
                  {suggestions.map((it) => (
                    <SuggestionTile key={it.id} item={it} onAdd={onAdd} onDetails={setDetail} />
                  ))}
                </div>
                <p className="suggest-hint">{t("suggestions.tilesHint")}</p>
              </>
            )}

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
        )
      }
    </Modal>
  );
}

// The details view behind a long-press: the numbers the tile deliberately
// leaves out, plus the actions that used to be three icon buttons per row.
function SuggestionDetail({ item, onBack, onAdd, onSnooze, onHide }) {
  const { lang } = useLanguage();
  const t = useTranslation();
  const status = stockStatusOf(item);
  const name = cap(translateItemName(item.name, lang));
  return (
    <>
      <div className={`stock-detail stock-${status}`}>
        <div className="stock-detail-head">
          <StockMark status={status} size={16} />
          <strong>{name}</strong>
          <span>{t(`suggestions.status.${status}`)}</span>
        </div>
        <p className="stats">
          {t("suggestions.daysSince", { count: Math.round(item.days_since) })}
          {" · "}
          {t(item.repeat_every_days ? "suggestions.intervalSet" : "suggestions.interval", {
            count: Math.max(1, Math.round(item.avg_interval_days)),
          })}
        </p>
        {isLearning(item) && <p className="stats">{t("suggestions.learning")}</p>}
      </div>
      <div className="actions" style={{ flexDirection: "column", alignItems: "stretch" }}>
        <Button onClick={() => onAdd(item)}>{t("suggestions.detail.add")}</Button>
        <Button variant="outline" onClick={() => onSnooze(item)}>
          {t("suggestions.detail.snooze")}
        </Button>
        <Button variant="outline" onClick={() => onHide(item)}>
          {t("suggestions.detail.hide")}
        </Button>
        <Button variant="outline" onClick={onBack}>
          {t("suggestions.detail.back")}
        </Button>
      </div>
    </>
  );
}
