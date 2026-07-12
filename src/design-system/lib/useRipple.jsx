import React from 'react';

/**
 * Android Material-style tap ripple. `spawn(e)` starts an expanding circle
 * from the pointer-down point (falling back to the element centre when no
 * coordinates are available); each ripple auto-clears after the animation.
 * Keep it on `onPointerDown` so touch taps get feedback immediately, layered
 * on top of the brand's darken-and-scale press state.
 *
 * The host element must be `position: relative; overflow: hidden` so the
 * ripple is clipped to the control's shape. Render <Ripples/> inside it.
 * Source: Panhandle Design System (Android styling — README "Platform").
 */
export function useRipple() {
  const [ripples, setRipples] = React.useState([]);
  const spawn = React.useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.6;
    const cx = e.clientX ?? rect.left + rect.width / 2;
    const cy = e.clientY ?? rect.top + rect.height / 2;
    const id = Date.now() + Math.random();
    setRipples((rs) => [...rs, { id, x: cx - rect.left - size / 2, y: cy - rect.top - size / 2, size }]);
    setTimeout(() => setRipples((rs) => rs.filter((r) => r.id !== id)), 500);
  }, []);
  return { ripples, spawn };
}

/** Renders the active ripple circles. `tint` is the ripple colour — light
 * for filled/dark surfaces, ink-tinted for light/ghost surfaces. */
export function Ripples({ ripples, tint = 'rgba(255,255,255,0.35)' }) {
  return ripples.map((r) => (
    <span
      key={r.id}
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: r.x,
        top: r.y,
        width: r.size,
        height: r.size,
        borderRadius: '50%',
        background: tint,
        transform: 'scale(0)',
        animation: 'ph-ripple 500ms var(--ease-out) forwards',
        pointerEvents: 'none',
      }}
    />
  ));
}
