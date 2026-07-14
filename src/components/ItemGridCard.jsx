import { motion } from "framer-motion";
import { ItemIcon } from "./ItemIcon.jsx";
import { Card } from "../design-system/index.js";
import { cap } from "../lib/shoppingUtils.js";
import { useLongPress } from "../hooks/useLongPress.js";
import { useMotionConfig } from "../hooks/useMotionConfig.js";

const MotionCard = motion(Card);

// Grid-view tile. Tap toggles bought; long-press opens the edit modal.
// `clusterOn` — see ItemCard.jsx's comment on why the icon badge needs a
// solid backdrop instead of a text-color tint. `clusterBg` is the pale
// per-aisle backdrop, now painted on the card itself (sections no longer
// have their own background — see ShoppingListTab.jsx).
export function ItemGridCard({ item, resolving, onToggle, onEdit, clusterOn, clusterBg, active }) {
  const longPress = useLongPress(() => onEdit(item.id));
  const { shouldAnimate, transition } = useMotionConfig();
  const CardComponent = shouldAnimate ? MotionCard : Card;
  // See ItemCard.jsx's comment on why `layout` is gated on `active` rather
  // than just `shouldAnimate`.
  const motionProps = shouldAnimate
    ? {
        layout: active,
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
        background: clusterBg || "var(--surface-card)",
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
        {(item.qty > 1 || item.notes) ? (
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "center",
              gap: 5,
              whiteSpace: "nowrap",
              overflow: "hidden",
              maxWidth: "100%",
            }}
          >
            {item.qty > 1 ? (
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "var(--text-2xs)",
                  fontWeight: "var(--weight-display-max)",
                  color: clusterOn || "var(--accent-primary)",
                  flexShrink: 0,
                }}
              >
                x{item.qty}
              </span>
            ) : null}
            {item.notes ? (
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "var(--text-2xs)",
                  color: "var(--text-secondary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {item.notes}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </CardComponent>
  );
}
