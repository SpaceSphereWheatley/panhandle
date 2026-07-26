import { Checkbox, Tag } from "../../design-system/index.js";
import { cap } from "../../lib/shoppingUtils.js";
import { useLanguage, useTranslation } from "../../context/LanguageContext.jsx";
import { translateItemName } from "../../lib/i18n/itemNames.js";

// Shared checkable ingredient list — used by both entry points that offer
// "pick which ingredients to add to the shopping list": the FAB's "Fra
// middagsplanen" (WeekIngredientsModal) and the meal-plan modal's "+ Legg
// ingredienser på handlelisten" (IngredientPickerModal). The row itself
// (not Checkbox's own onChange) handles the click so the whole row stays
// tappable, matching the previous native-checkbox row's hit area.
export function IngredientChecklist({ rows, onToggle }) {
  const t = useTranslation();
  const { lang } = useLanguage();
  return (
    <div className="ing-list">
      {rows.map((r, i) => (
        // Best-effort name translation: `r.name` is the catalogue name when
        // the ingredient matched one (buildIngredientRows), so common items
        // localize; a free-typed ingredient has no entry and passes through
        // as typed. Display only — `r.name` is what actually gets POSTed.
        <div className="ing-row" key={r.name} onClick={() => onToggle(i)}>
          <Checkbox checked={r.checked} label={cap(translateItemName(r.name, lang))} />
          {r.already && <Tag tone="neutral">{t("meals.alreadyOnList")}</Tag>}
        </div>
      ))}
    </div>
  );
}
