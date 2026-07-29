import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMotionConfig } from "../../hooks/useMotionConfig.js";
import { Button } from "../../design-system/index.js";
import { ONBOARDING_SLIDES } from "./onboardingSlides.js";
import { containerVariants } from "./illustrations.jsx";

// A swipeable, one-time intro shown before a first-time user lands on an
// empty shopping list. Self-contained: the only contract with the rest of
// the app is the `onDone` callback (fired on "Skip" or the final "Get
// started"). Wired in by App.jsx's Root(), gated on a per-device
// localStorage flag (src/lib/onboarding.js) — see there for why per-device
// rather than per-account. See onboardingSlides.js for the slide content and
// illustrations.jsx for the per-slide artwork.
//
// Deliberately not run through useTranslation()/t(): every string here is
// plain English, same as the illustrations' in-frame UI text (see the
// comment atop illustrations.jsx) rather than switching with the device's
// UI language.
//
// Motion goes through the same useMotionConfig() hook as MealsTab/ItemCard —
// prefers-reduced-motion and the "classic" design-intensity setting both
// disable it the same way they do everywhere else, and shouldAnimate=false
// renders plain elements instead of motion.* ones per that hook's contract.
const SWIPE_DISTANCE_THRESHOLD = 60;
const SWIPE_VELOCITY_THRESHOLD = 500;

const slideVariants = {
  enter: (dir) => ({ x: dir > 0 ? 48 : -48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir > 0 ? -48 : 48, opacity: 0 }),
};

export function OnboardingFlow({ onDone }) {
  const { shouldAnimate, transition } = useMotionConfig();
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);

  const isLast = index === ONBOARDING_SLIDES.length - 1;
  const slide = ONBOARDING_SLIDES[index];
  const Illustration = slide.Illustration;

  function goTo(next) {
    if (next < 0 || next >= ONBOARDING_SLIDES.length) return;
    setDirection(next > index ? 1 : -1);
    setIndex(next);
  }

  function handleDragEnd(_e, info) {
    if (info.offset.x < -SWIPE_DISTANCE_THRESHOLD || info.velocity.x < -SWIPE_VELOCITY_THRESHOLD) {
      goTo(index + 1);
    } else if (info.offset.x > SWIPE_DISTANCE_THRESHOLD || info.velocity.x > SWIPE_VELOCITY_THRESHOLD) {
      goTo(index - 1);
    }
  }

  return (
    <div
      id="onboarding"
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        background: "var(--surface-page)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "16px 20px", minHeight: 44 }}>
        {!isLast && (
          <button type="button" onClick={onDone} style={textButtonStyle}>
            Skip
          </button>
        )}
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 32px",
          overflow: "hidden",
        }}
      >
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={slide.id}
            custom={direction}
            variants={shouldAnimate ? slideVariants : undefined}
            initial={shouldAnimate ? "enter" : false}
            animate={shouldAnimate ? "center" : undefined}
            exit={shouldAnimate ? "exit" : undefined}
            transition={transition}
            drag={shouldAnimate ? "x" : false}
            dragElastic={0.6}
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={handleDragEnd}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 24,
              width: "100%",
              maxWidth: 360,
              textAlign: "center",
              touchAction: "pan-y",
            }}
          >
            <motion.div
              variants={shouldAnimate ? containerVariants : undefined}
              initial={shouldAnimate ? "hidden" : false}
              animate={shouldAnimate ? "visible" : undefined}
            >
              <Illustration />
            </motion.div>
            <h2
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-2xl)",
                fontWeight: "var(--weight-bold)",
                letterSpacing: "var(--tracking-tight)",
                color: "var(--text-primary)",
                margin: 0,
              }}
            >
              {slide.title}
            </h2>
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "var(--text-md)",
                lineHeight: "var(--leading-normal)",
                color: "var(--text-secondary)",
                margin: 0,
              }}
            >
              {slide.body}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 8, paddingBottom: 20 }}>
        {ONBOARDING_SLIDES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            aria-label={`Go to slide ${i + 1}`}
            aria-current={i === index}
            onClick={() => goTo(i)}
            style={{
              width: i === index ? 20 : 8,
              height: 8,
              borderRadius: "var(--radius-pill)",
              border: "none",
              padding: 0,
              cursor: "pointer",
              background: i === index ? "var(--accent-primary)" : "var(--border-default)",
              transition:
                "width var(--duration-base) var(--ease-out), background-color var(--duration-base) var(--ease-out)",
            }}
          />
        ))}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0 24px 32px",
          gap: 12,
        }}
      >
        <div style={{ minWidth: 72 }}>
          {index > 0 && (
            <button type="button" onClick={() => goTo(index - 1)} style={textButtonStyle}>
              Back
            </button>
          )}
        </div>
        <Button variant="primary" size="lg" onClick={() => (isLast ? onDone() : goTo(index + 1))}>
          {isLast ? "Get started" : "Next"}
        </Button>
      </div>
    </div>
  );
}

const textButtonStyle = {
  background: "none",
  border: "none",
  color: "var(--text-tertiary)",
  fontFamily: "var(--font-sans)",
  fontSize: "var(--text-sm)",
  fontWeight: "var(--weight-semibold)",
  cursor: "pointer",
  padding: "8px 4px",
};
