import { ItemIcon } from "./ItemIcon.jsx";
import { ListItem, IconButton } from "../design-system/index.js";
import { cap } from "../lib/shoppingUtils.js";

// List-view row, built on the design system's ListItem. The original vanilla
// app also supports a swipe-left gesture and long-press-to-edit on top of
// these same buttons; this port keeps the explicit tap-to-toggle / edit /
// delete buttons and drops the touch gestures as a v1 simplification (see
// PR description).
export function ItemCard({ item, resolving, onToggle, onEdit, onDelete }) {
  return (
    <div
      style={
        resolving
          ? {
              // Fade + shrink out after the strike-through has had a beat to
              // register (delay ≈ --duration-fast), then the row re-sorts away.
              transition:
                "transform var(--duration-base) var(--ease-out) var(--duration-fast), opacity var(--duration-base) var(--ease-out) var(--duration-fast)",
              transform: "scale(.96)",
              opacity: 0,
              pointerEvents: "none",
            }
          : undefined
      }
    >
      <ListItem
        label={cap(item.name) + (item.qty > 1 ? ` ×${item.qty}` : "")}
        subtitle={item.notes || null}
        checked={!!item.bought}
        onChange={() => onToggle(item.id)}
        leading={
          <div
            className="item-badge"
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "var(--accent-secondary)",
              color: "var(--text-on-accent)",
              fontWeight: "var(--weight-semibold)",
              fontSize: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              opacity: item.bought ? 0.45 : 1,
              transition: "opacity var(--duration-fast) var(--ease-out)",
            }}
          >
            <ItemIcon name={item.name} />
          </div>
        }
        trailing={
          <>
            <IconButton icon="dots-three-vertical" size="sm" label="Rediger vare" onClick={() => onEdit(item.id)} />
            <IconButton icon="trash" size="sm" label="Slett vare" onClick={() => onDelete(item.id)} />
          </>
        }
      />
    </div>
  );
}
