import { useRef } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { ItemIcon } from "./ItemIcon.jsx";
import { Card } from "../design-system/index.js";
import { cap, parseSqliteDatetime, haptic } from "../lib/shoppingUtils.js";
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

// Swipe-right-to-mark-important thresholds (list-view values — grid view
// scales these down since its tiles are much narrower, see isGrid below).
const SWIPE_COMMIT_PX = 72;
const SWIPE_VELOCITY = 500;
const SWIPE_MAX_PX = 96;
const STAR_PATH = "M12 2.5l2.9 6.2 6.6.8-4.9 4.5 1.3 6.6-5.9-3.3-5.9 3.3 1.3-6.6-4.9-4.5 6.6-.8z";

// Single card for both the list row and grid tile — `viewMode` picks the
// layout. Deliberately the SAME component (not two components swapped by the
// caller) so Framer's `layout` FLIP-animates the shell across the grid/list
// toggle instead of React unmounting/remounting a fresh node on every switch.
// `clusterOn`/`clusterBg` — the aisle-cluster accent color, used as the icon
// badge's backdrop (the hand-drawn item icons are hardcoded white-stroke SVGs,
// not currentColor) and as the pale per-aisle card backdrop.
export function ItemCard({ item, resolving, onToggle, onToggleImportant, onEdit, onResolved, clusterOn, clusterBg, viewMode = "list", index = 0, staleItemDays }) {
  const isGrid = viewMode === "grid";
  // Discreet "been on the list a while" marker — purely visual, computed from
  // added_at (see /notification-settings' stale_item_days, VarslerSubpage.jsx),
  // never shown once the item's bought.
  const isStale =
    !item.bought &&
    !!staleItemDays &&
    Date.now() - parseSqliteDatetime(item.added_at).getTime() > staleItemDays * 24 * 60 * 60 * 1000;
  const longPress = useLongPress(() => onEdit(item.id));
  const { shouldAnimate, transition } = useMotionConfig();
  const intensity = useDesignIntensity();
  const CardComponent = shouldAnimate ? MotionCard : Card;
  const ContentWrapper = shouldAnimate ? MotionDiv : "div";

  // Grid tiles are much narrower than list rows (ShoppingListTab's gridStyle
  // can go under 140px per tile on narrow screens with 3 columns), so a flat
  // 72px commit distance would consume most of a tile's width — scale it
  // down there. Velocity threshold stays the same in both: a fast flick
  // reads the same regardless of tile width.
  const swipeCommitPx = isGrid ? 40 : SWIPE_COMMIT_PX;
  const swipeMaxPx = isGrid ? 56 : SWIPE_MAX_PX;
  const x = useMotionValue(0);
  const swipeBackdropOpacity = useTransform(x, [0, swipeCommitPx], [0, 1]);
  // Distinguishes a genuine swipe from a tap-with-negligible-movement, same
  // pattern as MealsTab's week-pager swipe (see its onDrag comment): the
  // browser's native click on release fires before Framer calls onDragEnd,
  // so the suppress flag has to be set in onDrag, not onDragEnd.
  const dragActiveRef = useRef(false);
  const swipeSuppressRef = useRef(false);

  function onSwipeDragStart() {
    dragActiveRef.current = false;
  }
  function onSwipeDrag(_e, info) {
    if (Math.abs(info.offset.x) > 5) {
      dragActiveRef.current = true;
      swipeSuppressRef.current = true;
    }
  }
  function onSwipeDragEnd(_e, info) {
    if (dragActiveRef.current) {
      // Cleared a tick later so the click that follows this release (if
      // any) still sees it as suppressed.
      setTimeout(() => { swipeSuppressRef.current = false; }, 0);
    }
    const committed = info.offset.x > swipeCommitPx || info.velocity.x > SWIPE_VELOCITY;
    if (committed) {
      haptic();
      onToggleImportant(item.id);
    }
    animate(x, 0, transition); // always spring back — never a persistent "open" state
  }

  const staggerDelay = shouldAnimate && intensity === "expressive" ? Math.min(index, STAGGER_CAP) * STAGGER_STEP_S : 0;
  const layoutTransition = { ...transition, delay: staggerDelay };

  // `layout` is always on (never conditionally toggled per render) — Framer's
  // exit/projection tracking for a card gets permanently stuck (frozen in
  // place, blocking reflow of the rest of the list) if `layout` is flipped
  // off and back on for a card during its resolve/exit lifecycle, which
  // happened here whenever this card's pane was hidden (`display: none` in
  // AppShell) and shown again mid-animation. ShoppingListTab.jsx forces a
  // clean remount of the whole list on reactivation instead (`renderGeneration`
  // key), which is what actually avoids Framer measuring a stale zero-size
  // rect while hidden — a fresh AnimatePresence instance has no prior layout
  // to FLIP from, so items just reappear already in their settled position.
  //
  // `resolving`'s "pop, then settle dimmed" is driven here (not a parallel
  // CSS `animation`) so a single engine owns transform/opacity on this node —
  // mixing a native CSS animation with Framer's motion values on the same
  // element is an unstable combination.
  //
  // ShoppingListTab holds a checked-off item in place (via `resolving`) until
  // it's told to let go. Rather than that caller guessing how long this pop
  // animation takes, onAnimationComplete reports the real finish back to it —
  // the `resolving` check guards against firing for the plain enter/settle
  // animation too, since that one shares this same callback.
  const motionProps = shouldAnimate
    ? {
        layout: true,
        transition: { ...transition, layout: layoutTransition },
        initial: { opacity: 0, y: 8 },
        animate: resolving
          ? { opacity: 0.55, scale: [1, 1.05, 1], y: 0, transition: { duration: 0.3, ease: "easeOut" } }
          : { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.9 },
        onAnimationComplete: () => { if (resolving) onResolved?.(item.id); },
      }
    : {};
  // The icon badge and text block track their own position/size within the
  // shell (moving left→top, resizing 40→48px) instead of just riding along
  // with the shell's own FLIP — Framer's nested `layout` also auto-corrects
  // for the shell's scale so text never stretches through the transition.
  const contentMotionProps = shouldAnimate ? { layout: true, transition: layoutTransition } : {};

  // Flex layout for the icon badge + text block — used to live directly on
  // CardComponent; now lives one level down on the content layer instead,
  // so a sibling backdrop layer (below) can sit behind it and be revealed by
  // the swipe-right gesture. CardComponent's own padding is untouched, so
  // this still sits inside the same padded box as before.
  const contentLayerStyle = {
    position: "relative",
    zIndex: 1,
    display: "flex",
    flexDirection: isGrid ? "column" : "row",
    alignItems: "center",
    justifyContent: isGrid ? "flex-start" : undefined,
    textAlign: isGrid ? "center" : undefined,
    gap: isGrid ? 4 : 12,
  };

  const contentChildren = (
    <>
      <ContentWrapper
        {...contentMotionProps}
        className={isGrid ? "grid-badge" : "item-badge"}
        style={{
          position: "relative",
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
        {onToggleImportant ? (
          <span
            role="button"
            tabIndex={0}
            aria-pressed={!!item.important}
            aria-label={item.important ? "Fjern som viktig" : "Merk som viktig"}
            title={item.important ? "Fjern som viktig" : "Merk som viktig"}
            onClick={(e) => {
              e.stopPropagation();
              onToggleImportant(item.id);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onToggleImportant(item.id);
              }
            }}
            style={{
              position: "absolute",
              top: -4,
              left: -4,
              width: 18,
              height: 18,
              borderRadius: "50%",
              // Only important items get a visible marker — that's what makes
              // it readable at a glance. Non-important items keep this same
              // hit area (invisible, no background/border) so a tap here
              // still marks the item important instead of needing a separate
              // affordance.
              background: item.important ? "var(--surface-sunken)" : "transparent",
              border: item.important ? "1.5px solid var(--surface-card)" : "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              touchAction: "manipulation",
            }}
          >
            {item.important ? (
              <svg
                viewBox="0 0 24 24"
                width="11"
                height="11"
                fill="var(--accent-tertiary)"
                stroke="var(--accent-tertiary)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2.5l2.9 6.2 6.6.8-4.9 4.5 1.3 6.6-5.9-3.3-5.9 3.3 1.3-6.6-4.9-4.5 6.6-.8z" />
              </svg>
            ) : null}
          </span>
        ) : null}
        {isStale ? (
          <span
            title={`På listen i over ${staleItemDays} dager`}
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: "var(--surface-sunken)",
              border: "1.5px solid var(--surface-card)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="var(--text-tertiary)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          </span>
        ) : null}
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
            minHeight: 16,
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
      </ContentWrapper>
    </>
  );

  return (
    <CardComponent
      padding={isGrid ? "none" : "sm"}
      role="button"
      tabIndex={0}
      aria-label={`${cap(item.name)}${item.important ? ", viktig" : ""}${item.bought ? ", kjøpt" : ""}`}
      onClick={() => {
        if (swipeSuppressRef.current) return;
        onToggle(item.id);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle(item.id);
        }
      }}
      {...longPress}
      {...motionProps}
      style={{
        position: "relative",
        overflow: "hidden",
        background: clusterBg || "var(--surface-card)",
        opacity: item.bought ? 0.55 : 1,
        transition: "opacity var(--duration-fast) var(--ease-out)",
        touchAction: "manipulation",
        userSelect: "none",
        ...(isGrid ? { padding: "16px 10px" } : null),
        ...(resolving ? { pointerEvents: "none" } : null),
      }}
    >
      {shouldAnimate && onToggleImportant ? (
        // Swipe-right reveal — a full-bleed backdrop (its `inset:0` fills
        // CardComponent's padding box regardless of CardComponent's own
        // padding, per CSS's containing-block rules) that fades in as the
        // content layer above it slides right, mirroring the same star used
        // by the corner badge. Always rendered when shouldAnimate (list AND
        // grid) — only "classic"/reduced-motion users skip it, since they
        // still have the corner badge as an unconditional fallback. Gated on
        // onToggleImportant same as that badge — e.g. "Nylig kjøpt" rows
        // don't get it, since a bought item's important flag is always 0
        // (see ShoppingListTab's toggleItem) and there'd be nothing to swipe
        // toward.
        <motion.div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: isGrid ? "center" : "flex-start",
            paddingLeft: isGrid ? 0 : 20,
            background: "var(--accent-tertiary-subtle)",
            opacity: swipeBackdropOpacity,
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width={isGrid ? 18 : 20}
            height={isGrid ? 18 : 20}
            fill="var(--accent-tertiary)"
            stroke="var(--accent-tertiary)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d={STAR_PATH} />
          </svg>
        </motion.div>
      ) : null}
      {shouldAnimate && onToggleImportant ? (
        <motion.div
          style={{ ...contentLayerStyle, x, touchAction: "pan-y" }}
          drag="x"
          dragConstraints={{ left: 0, right: swipeMaxPx }}
          dragElastic={{ left: 0, right: 0.35 }}
          dragMomentum={false}
          onDragStart={onSwipeDragStart}
          onDrag={onSwipeDrag}
          onDragEnd={onSwipeDragEnd}
        >
          {contentChildren}
        </motion.div>
      ) : (
        <div style={contentLayerStyle}>{contentChildren}</div>
      )}
    </CardComponent>
  );
}
