import { motion } from "framer-motion";
import { ItemIcon } from "./ItemIcon.jsx";
import { Card } from "../design-system/index.js";
import { cap } from "../lib/shoppingUtils.js";
import { useLongPress } from "../hooks/useLongPress.js";
import { useMotionConfig } from "../hooks/useMotionConfig.js";

const MotionCard = motion(Card);

// Grid-view tile. Tap toggles bought; long-press opens the edit modal.
// `clusterOn` — see ItemCard.jsx's comment on why the icon badge needs a
// solid backdrop instead of a text-color tint.
export function ItemGridCard({ item, resolving, onToggle, onEdit, clusterOn }) {
  const meta = [item.qty > 1 ? `x${item.qty}` : "", item.notes || ""].filter(Boolean).join(" · ");
  const longPress = useLongPress(() => onEdit(item.id));
  const { shouldAnimate, transition } = useMotionConfig();
  const CardComponent = shouldAnimate ? MotionCard : Card;
  const motionProps = shouldAnimate
    ? {
        layout: true,
        transition,
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, scale: 0.9 },
      }
    : {};
  return (
    <CardComponent
      padding="none"
      onClick={() => onToggle(item.id)}
      {...longPress}
      {...motionProps}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 4,
        minHeight: 112,
        padding: "10px 10px",
        overflow: "hidden",
        background: "var(--surface-card)",
        opacity: item.bought ? 0.55 : 1,
        transition: "opacity var(--duration-fast) var(--ease-out)",
        touchAction: "manipulation",
        userSelect: "none",
        ...(resolving
          ? {
              animation: "ph-item-resolve 380ms var(--ease-out) forwards",
              pointerEvents: "none",
            }
          : null),
      }}
    >
      <div
        className="grid-badge"
        style={{
          width: 48,
          height: 48,
          borderRadius: "var(--radius-pill)",
          background: clusterOn || "var(--accent-secondary)",
          color: "var(--text-on-accent)",
          fontWeight: "var(--weight-semibold)",
          fontSize: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
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
            color: "var(--text-primary)",
          }}
        >
          {cap(item.name)}
        </div>
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-2xs)",
            color: "var(--text-secondary)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "100%",
          }}
        >
          {meta}
        </div>
      </div>
    </CardComponent>
  );
}
