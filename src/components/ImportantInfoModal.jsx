import { useState } from "react";
import { motion } from "framer-motion";
import { Modal } from "./Modal.jsx";
import { Button } from "../design-system/index.js";
import { ItemIcon } from "./ItemIcon.jsx";
import { cap } from "../lib/shoppingUtils.js";
import { useMotionConfig } from "../hooks/useMotionConfig.js";
import { useDesignIntensity } from "../hooks/useDesignIntensity.js";

// Same star path ItemCard's importance badge/swipe-reveal draws — kept as a
// literal here (not imported) since these two demo mocks are self-contained
// illustrations, not real item rows.
const STAR_PATH = "M12 2.5l2.9 6.2 6.6.8-4.9 4.5 1.3 6.6-5.9-3.3-5.9 3.3 1.3-6.6-4.9-4.5 6.6-.8z";
const DEMO_SWIPE_PX = 28;
const DEMO_SWIPE_PX_GRID = 16;
// A handful of common items that each have their own hand-drawn icon
// (src/lib/itemIcons.js) — picked at random per modal open so the demo below
// reads as an actual item on the list rather than an abstract placeholder
// shape, which was hard to parse at a glance. The randomness is just a small
// bit of variety, not load-bearing for anything.
const DEMO_ITEMS = ["Melk", "Brød", "Ost", "Pasta", "Ris", "Egg", "Smør", "Kaffe"];

function StarIcon({ size = 14 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="var(--accent-tertiary)"
      stroke="var(--accent-tertiary)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={STAR_PATH} />
    </svg>
  );
}

// Real icon badge, same className convention ItemCard.jsx uses ("item-badge"/
// "grid-badge") so ItemIcon's SVG picks up its actual size from index.css's
// `.item-badge .item-icon`/`.grid-badge .item-icon` rules instead of an
// unstyled default.
function ItemBadge({ isGrid, itemName }) {
  const size = isGrid ? 48 : 40;
  return (
    <span
      className={isGrid ? "grid-badge" : "item-badge"}
      style={{
        width: size,
        height: size,
        borderRadius: "var(--radius-pill)",
        background: "var(--accent-secondary)",
        color: "var(--text-on-accent)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <ItemIcon name={itemName} />
    </span>
  );
}

// The item row/tile content shown both mid-slide (SwipeDemo) and at rest
// (TapDemo) — badge + name, laid out like ItemCard's real row (list) or
// column (grid).
function DemoItemContent({ isGrid, itemName }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: isGrid ? "column" : "row",
        alignItems: "center",
        gap: isGrid ? 4 : 10,
      }}
    >
      <ItemBadge isGrid={isGrid} itemName={itemName} />
      <span style={{ fontSize: isGrid ? "var(--text-2xs)" : "var(--text-sm)", fontWeight: "var(--weight-medium)", color: "var(--text-primary)" }}>
        {cap(itemName)}
      </span>
    </div>
  );
}

// A literal miniature of ItemCard's real swipe gesture: a mock row (list) or
// tile (grid — matches whichever view the user currently has selected, see
// ImportantInfoModal below) slides right on a loop, revealing the same
// star-on-tinted-backdrop underneath it, star left-aligned for a row /
// centered for a tile just like the real backdrop in ItemCard.jsx. The
// sliding element's own background is --surface-sunken (not ItemCard's real
// --surface-card) so it still reads against the modal's own card-colored
// panel. Falls back to a static mid-swipe illustration (fixed offset, no
// loop) under reduced motion/"classic" intensity, plus a chevron so the
// direction still reads without animation.
function SwipeDemo({ shouldAnimate, isGrid, itemName }) {
  const swipePx = isGrid ? DEMO_SWIPE_PX_GRID : DEMO_SWIPE_PX;
  const slidingStyle = {
    position: "absolute",
    inset: 0,
    borderRadius: "var(--radius-card)",
    background: "var(--surface-sunken)",
    display: "flex",
    alignItems: "center",
    justifyContent: isGrid ? "center" : "flex-start",
    padding: isGrid ? "8px 4px" : "0 14px",
  };
  return (
    <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
      <div
        aria-hidden="true"
        style={{
          position: "relative",
          width: isGrid ? 96 : "100%",
          height: isGrid ? 92 : 56,
          borderRadius: "var(--radius-card)",
          overflow: "hidden",
          background: "var(--accent-tertiary-subtle)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: isGrid ? "center" : "flex-start",
            paddingLeft: isGrid ? 0 : 14,
          }}
        >
          <StarIcon size={16} />
        </div>
        {shouldAnimate ? (
          <motion.div animate={{ x: [0, swipePx, 0] }} transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }} style={slidingStyle}>
            <DemoItemContent isGrid={isGrid} itemName={itemName} />
          </motion.div>
        ) : (
          <div style={{ ...slidingStyle, left: swipePx }}>
            <DemoItemContent isGrid={isGrid} itemName={itemName} />
          </div>
        )}
      </div>
    </div>
  );
}

// The same item, already marked important — static, since tapping has no
// direction to animate. Mirrors ItemCard's real corner star badge.
function TapDemo({ isGrid, itemName }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
      <div style={{ position: "relative" }}>
        <DemoItemContent isGrid={isGrid} itemName={itemName} />
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            top: -4,
            left: -4,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "var(--surface-sunken)",
            border: "1.5px solid var(--surface-card)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <StarIcon size={11} />
        </span>
      </div>
    </div>
  );
}

const textStyle = { margin: "0 0 16px", fontSize: "var(--text-sm)", lineHeight: 1.6, color: "var(--text-primary)" };

export function ImportantInfoModal({ onClose }) {
  const { shouldAnimate } = useMotionConfig();
  const intensity = useDesignIntensity();
  // Mirrors ShoppingListTab's own effectiveViewMode: "classic" intensity
  // always forces list regardless of the stored ph_view preference, so the
  // demo should too — otherwise it could show a grid tile while the user is
  // actually looking at a forced-list Handleliste.
  const isGrid = intensity !== "classic" && localStorage.getItem("ph_view") === "grid";
  // Picked once per modal open (not per render) so it doesn't jump between
  // the swipe and tap demos, or flicker on an unrelated re-render.
  const [itemName] = useState(() => DEMO_ITEMS[Math.floor(Math.random() * DEMO_ITEMS.length)]);
  return (
    <Modal onClose={onClose} title="Merk som viktig">
      <SwipeDemo shouldAnimate={shouldAnimate} isGrid={isGrid} itemName={itemName} />
      <p style={textStyle}>Sveip et element mot høyre for å merke det som viktig.</p>
      <TapDemo isGrid={isGrid} itemName={itemName} />
      <p style={{ ...textStyle, margin: 0 }}>Eller trykk på den lille sirkelen øverst til venstre på ikonet.</p>
      <div className="actions">
        <Button variant="primary" onClick={onClose}>Lukk</Button>
      </div>
    </Modal>
  );
}
