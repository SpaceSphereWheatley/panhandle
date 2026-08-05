import React from 'react';
import { useRipple } from './useRipple.jsx';

/**
 * Shared hover/press pointer tracking + ripple spawn, factored out of
 * Button/IconButton/Fab (TODO #118), which each hand-rolled this same
 * pointer-handler block independently. Pointer events (not mouse events) so
 * touch taps get the press "give" too; hover is gated to mouse pointers to
 * avoid sticky hover after a touch tap. `disabled` suppresses both.
 */
export function usePressInteractions({ disabled = false } = {}) {
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);
  const { ripples, spawn } = useRipple();

  const handlers = {
    onPointerEnter: (e) => { if (!disabled && e.pointerType === 'mouse') setHover(true); },
    onPointerLeave: () => { setHover(false); setPress(false); },
    onPointerDown: (e) => { if (!disabled) { setPress(true); spawn(e); } },
    onPointerUp: () => setPress(false),
    onPointerCancel: () => setPress(false),
  };

  return { hover, press, ripples, handlers };
}
