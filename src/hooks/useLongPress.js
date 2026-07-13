import { useRef } from "react";
import { haptic } from "../lib/shoppingUtils.js";

const THRESHOLD_MS = 500;
const MOVE_TOLERANCE_PX = 10;

// Pointer-Events-based long-press: fires `onLongPress` after holding for
// THRESHOLD_MS, and suppresses the click that immediately follows (mobile
// browsers fire a synthetic click on pointerup even after a long hold), so
// a caller's onClick (e.g. toggle-bought) doesn't also run.
export function useLongPress(onLongPress) {
  const timerRef = useRef(null);
  const startRef = useRef(null);
  const firedRef = useRef(false);

  function clear() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function onPointerDown(e) {
    startRef.current = { x: e.clientX, y: e.clientY };
    firedRef.current = false;
    clear();
    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      haptic();
      onLongPress();
    }, THRESHOLD_MS);
  }

  function onPointerMove(e) {
    if (!startRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (Math.hypot(dx, dy) > MOVE_TOLERANCE_PX) clear();
  }

  function onPointerUp() {
    clear();
  }

  function onPointerLeave() {
    clear();
  }

  function onPointerCancel() {
    clear();
  }

  function onClickCapture(e) {
    if (firedRef.current) {
      e.stopPropagation();
      e.preventDefault();
      firedRef.current = false;
    }
  }

  return { onPointerDown, onPointerMove, onPointerUp, onPointerLeave, onPointerCancel, onClickCapture };
}
