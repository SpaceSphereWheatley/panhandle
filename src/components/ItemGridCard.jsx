import { ItemIcon } from "./ItemIcon.jsx";
import { cap } from "../lib/shoppingUtils.js";

// Grid-view tile. Tap toggles bought; long-press-to-edit from the original is
// dropped for v1 (see ItemCard.jsx) — use the list view's edit button instead.
export function ItemGridCard({ item, onToggle }) {
  const meta = [item.qty > 1 ? `x${item.qty}` : "", item.notes || ""].filter(Boolean).join(" · ");
  return (
    <div className={`grid-card${item.bought ? " bought" : ""}`} onClick={() => onToggle(item.id)}>
      <div className="badge">
        <ItemIcon name={item.name} />
      </div>
      <div className="grid-name">{cap(item.name)}</div>
      <div className="grid-meta">{meta}</div>
    </div>
  );
}
