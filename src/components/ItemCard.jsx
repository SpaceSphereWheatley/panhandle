import { ItemIcon } from "./ItemIcon.jsx";
import { UiIcon } from "./UiIcon.jsx";
import { cap } from "../lib/shoppingUtils.js";

// List-view row. The original vanilla app also supports a swipe-left gesture
// and long-press-to-edit on top of these same buttons; this port keeps the
// explicit tap-to-toggle / edit / delete buttons and drops the touch gestures
// as a v1 simplification (see PR description).
export function ItemCard({ item, resolving, onToggle, onEdit, onDelete }) {
  return (
    <div className="card-wrap">
      <div className="swipe-bg">
        <UiIcon name="check" size={20} />
      </div>
      <div
        className={`card${item.bought ? " bought" : ""}${resolving ? " resolving" : ""}`}
        onClick={() => onToggle(item.id)}
      >
        <div className="item-badge">
          <ItemIcon name={item.name} />
        </div>
        <div className="info">
          <div className="name">
            {cap(item.name)}
            {item.qty > 1 && <span className="qty-badge">x{item.qty}</span>}
          </div>
          <div className="meta" style={{ fontStyle: "italic" }}>{item.notes || ""}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button
            className="more"
            aria-label="Rediger vare"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(item.id);
            }}
          >
            <UiIcon name="more" size={18} />
          </button>
          <button
            className="del"
            aria-label="Slett vare"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item.id);
            }}
          >
            <UiIcon name="trash" size={18} />
          </button>
          <div className="check" />
        </div>
      </div>
    </div>
  );
}
