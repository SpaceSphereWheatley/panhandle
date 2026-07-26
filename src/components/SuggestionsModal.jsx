import { Modal } from "./Modal.jsx";
import { Button, IconButton, EmptyState } from "../design-system/index.js";
import { cap } from "../lib/shoppingUtils.js";
import { useLanguage, useTranslation } from "../context/LanguageContext.jsx";
import { translateItemName } from "../lib/i18n/itemNames.js";

export function SuggestionsModal({ suggestions, onAdd, onClose, onFocusAdd }) {
  const { lang } = useLanguage();
  const t = useTranslation();
  return (
    <Modal onClose={onClose} title={t("suggestions.title")}>
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
      </div>
      <div className="actions">
        <Button
          variant="outline"
          onClick={() => {
            onClose();
            onFocusAdd();
          }}
        >
          {t("suggestions.addOther")}
        </Button>
      </div>
    </Modal>
  );
}
