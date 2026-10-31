import { BaseButton } from "../design-system/index.js";
import { UiIcon } from "./UiIcon.jsx";
import { cap } from "../lib/shoppingUtils.js";
import { useLanguage, useTranslation } from "../context/LanguageContext.jsx";
import { translateItemName } from "../lib/i18n/itemNames.js";

const CHIP_STYLE = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  flex: "0 0 auto",
  border: "none",
  borderRadius: "var(--radius-pill)",
  padding: "6px 12px 6px 8px",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-xs)",
  fontWeight: "var(--weight-semibold)",
  background: "var(--accent-primary-subtle)",
  color: "var(--accent-primary-press)",
  whiteSpace: "nowrap",
};

// "Due soon": the purchase-interval suggestions (GET /catalogue/suggestions)
// surfaced inline above the shopping list instead of only behind the FAB, so
// they're actually seen. A tap adds the item; snooze/hide live in the full
// SuggestionsModal ("See all"), keeping each chip a single, unambiguous
// action. Renders nothing when there's nothing due.
export function DueSoonStrip({ suggestions, onAdd, onSeeAll }) {
  const { lang } = useLanguage();
  const t = useTranslation();
  if (!suggestions.length) return null;
  return (
    <section className="due-strip" aria-label={t("suggestions.strip.title")}>
      <div className="due-strip-head">
        <span>{t("suggestions.strip.title")}</span>
        <button type="button" className="due-strip-all" onClick={onSeeAll}>
          {t("suggestions.strip.seeAll")}
        </button>
      </div>
      <div className="due-strip-row">
        {suggestions.map((it) => {
          const name = cap(translateItemName(it.name, lang));
          return (
            <BaseButton
              key={it.id}
              onClick={() => onAdd(it)}
              aria-label={t("suggestions.addLabel", { name })}
              style={CHIP_STYLE}
            >
              <UiIcon name="plus" size={14} />
              {name}
            </BaseButton>
          );
        })}
      </div>
    </section>
  );
}
