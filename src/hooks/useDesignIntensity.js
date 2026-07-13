import { useEffect, useState } from "react";
import { currentIntensity, subscribeIntensity } from "../lib/designIntensity.js";

// "expressive" | "muted" | "classic" — for the handful of places that need
// to branch in JS (forcing list mode in classic, useMotionConfig, the
// Designintensitet control itself). Pure-CSS consumers of the intensity
// tokens (radius, motion) need nothing extra; they react via the cascade the
// instant document.documentElement.dataset.designIntensity flips.
export function useDesignIntensity() {
  const [level, setLevel] = useState(currentIntensity());
  useEffect(() => subscribeIntensity(setLevel), []);
  return level;
}
