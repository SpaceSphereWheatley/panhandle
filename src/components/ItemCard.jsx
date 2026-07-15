import { motion } from "framer-motion";
import { ItemIcon } from "./ItemIcon.jsx";
import { Card } from "../design-system/index.js";
import { cap } from "../lib/shoppingUtils.js";
import { useLongPress } from "../hooks/useLongPress.js";
import { useMotionConfig } from "../hooks/useMotionConfig.js";
import { useDesignIntensity } from "../hooks/useDesignIntensity.js";

const MotionCard = motion(Card);
const MotionDiv = motion.div;

// Choreographed stagger, expressive intensity only — cards ripple in instead
// of moving in lockstep. Capped so a long list doesn't produce a multi-second
// sweep; step kept small to stay "restrained" per motion.css's own framing.
const STAGGER_STEP_S = 0.024;
const STAGGER_CAP = 10;

// Single card for both the list row and grid tile — `viewMode` picks the
// layout. Deliberately the SAME component (not two components swapped by the
// caller) so Framer's `layout` FLIP-animates the shell across the grid/list
// toggle instead of React unmounting/remounting a fresh node on every switch.
// `clusterOn`/`clusterBg` — the aisle-cluster accent color, used as the icon
// badge's backdrop (the hand-drawn item icons are hardcoded white-stroke SVGs,
// not currentColor) and as the pale per-aisle card backdrop.
export function ItemCard({ item, resolving, onToggle, onEdit, clusterOn, clusterBg, active, viewMode = "list", index = 0 }) {
  const isGrid = viewMode === "grid";
  const longPress = useLongPress(() => onEdit(item.id));
  const { shouldAnimate, transition } = useMotionConfig();
  const intensity = useDesignIntensity();
  const CardComponent = shouldAnimate ? MotionCard : Card;
  const ContentWrapper = shouldAnimate ? MotionDiv : "div";

  const staggerDelay = shouldAnimate && intensity === "expressive" ? Math.min(index, STAGGER_CAP) * STAGGER_STEP_S : 0;
  const layoutTransition = { ...transition, delay: staggerDelay };

  // `layout` gated on `active`, not just `shouldAnimate` — this card's pane
  // can be hidden via `display: none` while staying mounted (AppShell.jsx),
  // and Framer would otherwise measure a stale zero-size rect while hidden
  // and animate a "fly in from (0,0)" on reactivation.
  const motionProps = shouldAnimate
    ? {
        layout: active,
        transition: { ...transition, layout: layoutTransition },
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, scale: 0.9 },
      }
    : {};
  // The icon badge and text block track their own position/size within the
  // shell (moving left→top, resizing 40→48px) instead of just riding along
  // with the shell's own FLIP — Framer's nested `layout` also auto-corrects
  // for the shell's scale so text never stretches through the transition.
  const contentMotionProps = shouldAnimate ? { layout: true, transition: layoutTransition } : {};

  return (
    <CardComponent
      padding={isGrid ? "none" : "sm"}
      role="button"
      tabIndex={0}
      aria-label={`${cap(item.name)}${item.bought ? ", kjøpt" : ""}`}
      onClick={() => onToggle(item.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle(item.id);
        }
      }}
      {...longPress}
      {...motionProps}
      style={{
        display: "flex",
        flexDirection: isGrid ? "column" : "row",
        alignItems: "center",
        justifyContent: isGrid ? "flex-start" : undefined,
        textAlign: isGrid ? "center" : undefined,
        gap: isGrid ? 4 : 12,
        padding: isGrid ? "16px 10px" : undefined,
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
      <ContentWrapper
        {...contentMotionProps}
        className={isGrid ? "grid-badge" : "item-badge"}
        style={{
          width: isGrid ? 48 : 40,
          height: isGrid ? 48 : 40,
          borderRadius: "var(--radius-pill)",
          background: clusterOn || "var(--accent-secondary)",
          color: "var(--text-on-accent)",
          fontWeight: "var(--weight-semibold)",
          fontSize: isGrid ? 20 : 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <ItemIcon name={item.name} />
      </ContentWrapper>
      <ContentWrapper
        {...contentMotionProps}
        style={{
          minWidth: 0,
          flex: isGrid ? undefined : 1,
          display: isGrid ? "flex" : undefined,
          flexDirection: isGrid ? "column" : undefined,
          justifyContent: isGrid ? "center" : undefined,
          gap: isGrid ? 2 : undefined,
          width: isGrid ? "100%" : undefined,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: isGrid ? "var(--text-xs)" : "var(--text-sm)",
            fontWeight: "var(--weight-medium)",
            lineHeight: isGrid ? 1.2 : undefined,
            width: isGrid ? "100%" : undefined,
            color: "var(--text-primary)",
            textDecoration: item.bought ? "line-through" : "none",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: isGrid ? undefined : "nowrap",
            display: isGrid ? "-webkit-box" : undefined,
            WebkitBoxOrient: isGrid ? "vertical" : undefined,
            WebkitLineClamp: isGrid ? 2 : undefined,
          }}
        >
          {cap(item.name)}
        </div>
        {(item.qty > 1 || item.notes) ? (
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: isGrid ? "center" : undefined,
              gap: isGrid ? 5 : 6,
              overflow: "hidden",
              textOverflow: isGrid ? undefined : "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: isGrid ? "100%" : undefined,
            }}
          >
            {item.qty > 1 ? (
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: isGrid ? "var(--text-2xs)" : "var(--text-xs)",
                  fontWeight: "var(--weight-display-max)",
                  color: clusterOn || "var(--accent-primary)",
                  flexShrink: 0,
                }}
              >
                {isGrid ? "x" : "×"}{item.qty}
              </span>
            ) : null}
            {item.notes ? (
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: isGrid ? "var(--text-2xs)" : "var(--text-xs)",
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
      </ContentWrapper>
    </CardComponent>
  );
}
