import { BaseButton } from "../design-system/index.js";
import { needsAttention, stockStatusOf } from "../lib/stock.js";
import { cap } from "../lib/shoppingUtils.js";
import { useLanguage, useTranslation } from "../context/LanguageContext.jsx";
import { translateItemName } from "../lib/i18n/itemNames.js";

// "Due soon": the purchase-interval suggestions (GET /catalogue/suggestions)
// surfaced inline above the shopping list instead of only behind the FAB, so
// they're actually seen. A tap adds the item; snooze/hide live in the full
// SuggestionsModal ("See all"), keeping each chip a single, unambiguous
// action. Shows only the red ("out") and yellow ("running low") suggestions,
// tinted to match the grid in SuggestionsModal; "fine for now" items live only
// in the full view. Renders nothing when there's nothing to show.
const STRIP_LIMIT = 8;

export function DueSoonStrip({ suggestions, onAdd, onSeeAll }) {
  const { lang } = useLanguage();
  const t = useTranslation();
  const shown = needsAttention(suggestions).slice(0, STRIP_LIMIT);
  if (!shown.length) return null;
  return (
    <section className="due-strip" aria-label={t("suggestions.strip.title")}>
      <div className="due-strip-head">
        <span>{t("suggestions.strip.title")}</span>
        <button type="button" className="due-strip-all" onClick={onSeeAll}>
          {t("suggestions.strip.seeAll")}
        </button>
      </div>
      <div className="due-strip-row">
        {shown.map((it) => {
          const name = cap(translateItemName(it.name, lang));
          const status = stockStatusOf(it);
          return (
            <BaseButton
              key={it.id}
              onClick={() => onAdd(it)}
              aria-label={t("suggestions.addLabel", { name })}
              className={`due-chip stock-${status}`}
            >
              {name}
            </BaseButton>
          );
        })}
      </div>
    </section>
  );
}
