import { Checkbox, Tag } from "../../design-system/index.js";
import { cap } from "../../lib/shoppingUtils.js";

// Shared checkable ingredient list — used by both entry points that offer
// "pick which ingredients to add to the shopping list": the FAB's "Fra
// middagsplanen" (WeekIngredientsModal) and the meal-plan modal's "+ Legg
// ingredienser på handlelisten" (IngredientPickerModal). The row itself
// (not Checkbox's own onChange) handles the click so the whole row stays
// tappable, matching the previous native-checkbox row's hit area.
export function IngredientChecklist({ rows, onToggle }) {
  return (
    <div className="ing-list">
      {rows.map((r, i) => (
        <div className="ing-row" key={r.name} onClick={() => onToggle(i)}>
          <Checkbox checked={r.checked} label={cap(r.name)} />
          {r.already && <Tag tone="neutral">Allerede på listen</Tag>}
        </div>
      ))}
    </div>
  );
}
