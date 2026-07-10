import { ItemIcon } from "./ItemIcon.jsx";
import { Card } from "../design-system/index.js";
import { cap } from "../lib/shoppingUtils.js";

// Grid-view tile. Tap toggles bought; long-press-to-edit from the original is
// dropped for v1 (see ItemCard.jsx) — use the list view's edit button instead.
export function ItemGridCard({ item, onToggle }) {
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
      }}
    >
      <div style={{ opacity: item.bought ? 0.45 : 1, fontSize: 30, lineHeight: 1 }}>
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
