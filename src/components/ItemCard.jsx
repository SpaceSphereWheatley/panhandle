import { ItemIcon } from "./ItemIcon.jsx";
import { Card } from "../design-system/index.js";
import { cap } from "../lib/shoppingUtils.js";
import { useLongPress } from "../hooks/useLongPress.js";

// List-view row. Tap toggles bought; long-press opens the edit modal —
// same interaction model as ItemGridCard.jsx, just laid out horizontally.
export function ItemCard({ item, resolving, onToggle, onEdit }) {
  const meta = [item.qty > 1 ? `×${item.qty}` : "", item.notes || ""].filter(Boolean).join(" · ");
  const longPress = useLongPress(() => onEdit(item.id));
  return (
    <Card
      padding="sm"
      onClick={() => onToggle(item.id)}
      {...longPress}
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        overflow: "hidden",
        background: "var(--accent-secondary)",
        opacity: item.bought ? 0.55 : 1,
        transition: "opacity var(--duration-fast) var(--ease-out)",
        touchAction: "manipulation",
        userSelect: "none",
        ...(resolving
          ? {
              transition:
                "transform var(--duration-base) var(--ease-out) var(--duration-fast), opacity var(--duration-base) var(--ease-out) var(--duration-fast)",
              transform: "scale(.96)",
              opacity: 0,
              pointerEvents: "none",
            }
          : null),
      }}
    >
      <div
        className="item-badge"
        style={{
          color: "var(--text-on-accent)",
          fontWeight: "var(--weight-semibold)",
          fontSize: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <ItemIcon name={item.name} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-sm)",
            fontWeight: "var(--weight-medium)",
            color: "var(--text-on-accent)",
            textDecoration: item.bought ? "line-through" : "none",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {cap(item.name)}
        </div>
        {meta ? (
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-xs)",
              color: "var(--text-on-accent)",
              opacity: 0.75,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {meta}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
