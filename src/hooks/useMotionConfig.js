import { useEffect, useState } from "react";
import { useDesignIntensity } from "./useDesignIntensity.js";

function reducedMotionQuery() {
  return window.matchMedia("(prefers-reduced-motion: reduce)");
}

// Drives the Framer Motion grid-reflow/mount-unmount animations (item cards,
// meal day cards). prefers-reduced-motion always wins, even under
// "expressive"; "classic" always disables motion regardless of the OS
// setting (it's a content-density choice, not an accessibility one). When
// shouldAnimate is false, callers should render a plain element instead of a
// motion.* one — that skips Framer's layout-measurement cost entirely rather
// than just no-op'ing the visual, which matters for PWA perf.
export function useMotionConfig() {
  const intensity = useDesignIntensity();
  const [reduced, setReduced] = useState(() => reducedMotionQuery().matches);

  useEffect(() => {
    const mq = reducedMotionQuery();
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const shouldAnimate = !reduced && intensity !== "classic";

  const transition = !shouldAnimate
    ? { duration: 0 }
    : intensity === "expressive"
      ? { type: "spring", stiffness: 380, damping: 28, mass: 0.9 }
      : { type: "tween", ease: [0.2, 0, 0, 1], duration: 0.18 };

  return { shouldAnimate, transition };
}
