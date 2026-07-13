import { ItemIcon } from "./ItemIcon.jsx";
import { Card } from "../design-system/index.js";
import { cap } from "../lib/shoppingUtils.js";
import { useLongPress } from "../hooks/useLongPress.js";

// Grid-view tile. Tap toggles bought; long-press opens the edit modal.
export function ItemGridCard({ item, resolving, onToggle, onEdit }) {
  const meta = [item.qty > 1 ? `x${item.qty}` : "", item.notes || ""].filter(Boolean).join(" · ");
  const longPress = useLongPress(() => onEdit(item.id));
  return (
    <Card
      padding="none"
      onClick={() => onToggle(item.id)}
      {...longPress}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 2,
        height: 104,
        padding: "8px 10px",
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
        className="grid-badge"
        style={{
          color: "var(--text-on-accent)",
          fontWeight: "var(--weight-semibold)",
          fontSize: 26,
          display: "flex",
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          minHeight: 0,
        }}
      >
        <ItemIcon name={item.name} />
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 2,
          flex: 1,
          minHeight: 0,
          width: "100%",
        }}
      >
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
            color: "var(--text-on-accent)",
          }}
        >
          {cap(item.name)}
        </div>
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-2xs)",
            color: "var(--text-on-accent)",
            opacity: 0.75,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "100%",
          }}
        >
          {meta}
        </div>
      </div>
    </Card>
  );
}
