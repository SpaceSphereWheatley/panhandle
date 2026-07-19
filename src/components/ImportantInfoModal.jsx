import { motion } from "framer-motion";
import { Modal } from "./Modal.jsx";
import { Button } from "../design-system/index.js";
import { useMotionConfig } from "../hooks/useMotionConfig.js";

// Same star path ItemCard's importance badge/swipe-reveal draws — kept as a
// literal here (not imported) since these two demo mocks are self-contained
// illustrations, not real item rows.
const STAR_PATH = "M12 2.5l2.9 6.2 6.6.8-4.9 4.5 1.3 6.6-5.9-3.3-5.9 3.3 1.3-6.6-4.9-4.5 6.6-.8z";
const DEMO_SWIPE_PX = 28;

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

// A literal miniature of ItemCard's real swipe gesture: a mock row slides
// right on a loop, revealing the same star-on-tinted-backdrop underneath it.
// Falls back to a static mid-swipe illustration (fixed offset, no loop) under
// reduced motion/"classic" intensity, plus a chevron so the direction still
// reads without animation.
function SwipeDemo({ shouldAnimate }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "relative",
        height: 44,
        borderRadius: "var(--radius-card)",
        overflow: "hidden",
        background: "var(--accent-tertiary-subtle)",
        marginBottom: 8,
      }}
    >
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", paddingLeft: 14 }}>
        <StarIcon size={16} />
      </div>
      {shouldAnimate ? (
        <motion.div
          animate={{ x: [0, DEMO_SWIPE_PX, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "var(--radius-card)",
            background: "var(--surface-sunken)",
          }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            left: DEMO_SWIPE_PX,
            borderRadius: "var(--radius-card)",
            background: "var(--surface-sunken)",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            paddingRight: 10,
            color: "var(--text-tertiary)",
            fontSize: "var(--text-sm)",
          }}
        >
          →
        </div>
      )}
    </div>
  );
}

// Mirrors ItemCard's real 40px icon badge with the corner star badge shown
// in its "active" (already-important) state — static, since tapping has no
// direction to animate.
function TapDemo() {
  return (
    <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
      <div
        aria-hidden="true"
        style={{
          position: "relative",
          width: 40,
          height: 40,
          borderRadius: "var(--radius-pill)",
          background: "var(--accent-secondary)",
        }}
      >
        <span
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
  return (
    <Modal onClose={onClose} title="Merk som viktig">
      <SwipeDemo shouldAnimate={shouldAnimate} />
      <p style={textStyle}>Sveip et element mot høyre for å merke det som viktig.</p>
      <TapDemo />
      <p style={{ ...textStyle, margin: 0 }}>Eller trykk på den lille sirkelen øverst til venstre på ikonet.</p>
      <div className="actions">
        <Button variant="primary" onClick={onClose}>Lukk</Button>
      </div>
    </Modal>
  );
}
