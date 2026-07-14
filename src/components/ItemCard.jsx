import { motion } from "framer-motion";
import { ItemIcon } from "./ItemIcon.jsx";
import { Card } from "../design-system/index.js";
import { cap } from "../lib/shoppingUtils.js";
import { useLongPress } from "../hooks/useLongPress.js";
import { useMotionConfig } from "../hooks/useMotionConfig.js";

const MotionCard = motion(Card);

// List-view row. Tap toggles bought; long-press opens the edit modal —
// same interaction model as ItemGridCard.jsx, just laid out horizontally.
// `clusterOn` is the aisle-cluster accent color used as the icon badge's
// backdrop — the hand-drawn item icons are hardcoded white-stroke SVGs, not
// currentColor, so they need a solid tinted badge behind them rather than a
// text-color tint. `clusterBg` is the pale per-aisle backdrop, painted on
// the card itself (there's no per-category section container anymore).
export function ItemCard({ item, resolving, onToggle, onEdit, clusterOn, clusterBg, active }) {
  const longPress = useLongPress(() => onEdit(item.id));
  const { shouldAnimate, transition } = useMotionConfig();
  const CardComponent = shouldAnimate ? MotionCard : Card;
  // `layout` gated on `active`, not just `shouldAnimate` — see MealsTab.jsx's
  // comment on why: this card's pane can be hidden via `display: none` while
  // staying mounted (AppShell.jsx), and Framer would otherwise measure a
  // stale zero-size rect while hidden and animate a "fly in from (0,0)" on
  // reactivation.
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
      padding="sm"
      onClick={() => onToggle(item.id)}
      {...longPress}
      {...motionProps}
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
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
        className="item-badge"
        style={{
          width: 40,
          height: 40,
          borderRadius: "var(--radius-pill)",
          background: clusterOn || "var(--accent-secondary)",
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
            color: "var(--text-primary)",
            textDecoration: item.bought ? "line-through" : "none",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {cap(item.name)}
        </div>
        {(item.qty > 1 || item.notes) ? (
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 6,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {item.qty > 1 ? (
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "var(--text-xs)",
                  fontWeight: "var(--weight-display-max)",
                  color: clusterOn || "var(--accent-primary)",
                  flexShrink: 0,
                }}
              >
                ×{item.qty}
              </span>
            ) : null}
            {item.notes ? (
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "var(--text-xs)",
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
