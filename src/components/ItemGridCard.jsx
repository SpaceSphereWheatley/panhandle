import { ItemIcon } from "./ItemIcon.jsx";
import { Card } from "../design-system/index.js";
import { cap } from "../lib/shoppingUtils.js";

// Grid-view tile. Tap toggles bought; long-press-to-edit from the original is
// dropped for v1 (see ItemCard.jsx) — use the list view's edit button instead.
export function ItemGridCard({ item, resolving, onToggle }) {
  const meta = [item.qty > 1 ? `x${item.qty}` : "", item.notes || ""].filter(Boolean).join(" · ");
  return (
    <Card
      padding="sm"
      onClick={() => onToggle(item.id)}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 4,
        height: 104,
        overflow: "hidden",
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
        className="grid-badge"
        style={{
          width: 32,
          height: 32,
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
      <div
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-xs)",
          fontWeight: "var(--weight-medium)",
          lineHeight: 1.2,
          width: "100%",
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: 2,
          overflow: "hidden",
          textOverflow: "ellipsis",
          textDecoration: item.bought ? "line-through" : "none",
          color: item.bought ? "var(--text-tertiary)" : "var(--text-primary)",
        }}
      >
        {cap(item.name)}
      </div>
      <div
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "var(--text-2xs)",
          color: "var(--text-tertiary)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: "100%",
          minHeight: 13,
        }}
      >
        {meta}
      </div>
    </Card>
  );
}
