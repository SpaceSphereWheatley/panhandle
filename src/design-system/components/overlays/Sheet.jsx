import React, { useEffect, useRef, useState } from 'react';
import FocusTrap from 'focus-trap-react';
import { motion, useMotionValue, useDragControls, animate } from 'framer-motion';
import { useMotionConfig } from '../../../hooks/useMotionConfig.js';

// Drag-to-dismiss commit thresholds — a downward drag past either wins,
// matching the distance/velocity commit pattern used for ItemCard's swipe
// and MealsTab's week-pager (60px there, scaled up here since this is a
// vertical bottom-sheet dismiss rather than a horizontal pane-swipe, and
// wants a clearer "you've committed" distance than a quick swipe does).
const DISMISS_DISTANCE_PX = 120;
const DISMISS_VELOCITY = 500;

// Safety net for the CSS-driven (non-drag) exit below: onAnimationEnd should
// always fire, but if it somehow doesn't (a browser quirk, a near-zero
// duration under prefers-reduced-motion's 0.001ms override), this fallback
// still lets the caller unmount instead of leaving the sheet stuck forever.
// Comfortably longer than --spring-duration (500ms).
const EXIT_FALLBACK_MS = 650;

// Locks background scroll while at least one sheet is open. A counter (not a
// plain boolean) so a sheet opened from within another sheet doesn't have the
// inner one's close re-enable scrolling while the outer one is still open.
let openSheetCount = 0;
function lockBodyScroll() {
  if (openSheetCount === 0) document.body.style.overflow = 'hidden';
  openSheetCount++;
}
function unlockBodyScroll() {
  openSheetCount = Math.max(0, openSheetCount - 1);
  if (openSheetCount === 0) document.body.style.overflow = '';
}

/** Modal overlay — used for all modal-style flows, in two placements:
 *
 *  - `sheet` (default) — the phone bottom sheet: docked to the bottom edge,
 *    top corners rounded, drag-grabber affordance, safe-area bottom padding.
 *  - `dialog` — the desktop centered dialog: centered in the viewport, all
 *    four corners rounded, no grabber (a drag affordance means nothing with a
 *    mouse) and none of the bottom-edge padding compensation.
 *
 * The default keeps every caller on today's phone behaviour unless it opts in.
 *
 * `open` going from true to false doesn't unmount anything by itself — Sheet
 * keeps rendering through its own dismissal animation and calls `onExited`
 * once it's actually safe to remove it from the tree. `onClose` is the
 * *request* to close (backdrop click, Escape, a Cancel/Confirm button, a
 * committed drag, browser back); `onExited` is the animation's completion.
 * Modal.jsx is the only consumer and owns translating between the two: it
 * keeps its own `open` state, passes `onClose` down as the thing that flips
 * it false, and forwards its real `onClose` prop as `onExited` so the caller
 * that mounted <Modal> only unmounts it once the sheet has actually left the
 * screen — never mid-animation.
 *
 * Source: Panhandle Design System (components/overlays/Sheet.jsx), extended
 * with a `className` passthrough on the content wrapper so callers (e.g.
 * Modal.jsx) can hook the many pre-existing `.modal …` descendant selectors
 * in src/index.css (labels, inputs, selects, action rows) without every
 * modal's internal markup needing to move onto design-system components. */
export function Sheet({ open = true, onClose, onExited, title, children, className, placement = 'sheet' }) {
  const isDialog = placement === 'dialog';
  const titleId = React.useId();
  const containerRef = React.useRef(null);
  const dragControls = useDragControls();
  const y = useMotionValue(0);
  const { transition } = useMotionConfig();
  const snapControlsRef = React.useRef(null);
  // Distinguishes a genuine drag from a tap-with-negligible-movement, so a
  // drag released back over the backdrop (e.g. dragging the pill upward,
  // where dragConstraints pins the sheet in place) can't spuriously trigger
  // the backdrop's own onClose — same pattern as MealsTab's week-pager.
  const dragActiveRef = React.useRef(false);
  // A committed drag-dismiss continues the live drag offset/velocity (via
  // the `y` motion value) instead of the CSS ph-sheet-out keyframe every
  // other dismissal route uses — replaying that keyframe would visibly snap
  // the sheet back to a resting translateY(0) before sliding it back out.
  const [dragDismissed, setDragDismissed] = useState(false);
  const dragVelocityRef = useRef(0);
  const exitedRef = useRef(false);

  function fireExited() {
    if (exitedRef.current) return;
    exitedRef.current = true;
    onExited && onExited();
  }

  function handleDragStart() {
    snapControlsRef.current?.stop();
  }

  function handleDrag(_event, info) {
    if (Math.abs(info.offset.y) > 5) dragActiveRef.current = true;
  }

  function handleDragEnd(_event, info) {
    const shouldDismiss = info.offset.y > DISMISS_DISTANCE_PX || info.velocity.y > DISMISS_VELOCITY;
    if (shouldDismiss) {
      dragVelocityRef.current = info.velocity.y;
      setDragDismissed(true);
      onClose && onClose();
    } else {
      snapControlsRef.current = animate(y, 0, transition);
    }
    // Cleared a tick later so the click that follows this release (if any)
    // still sees it as suppressed.
    setTimeout(() => { dragActiveRef.current = false; }, 0);
  }

  useEffect(() => {
    if (!open || !onClose) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Locked for as long as the sheet is actually on screen, including its
  // exit animation — unlike `open` itself, this only ever runs once per
  // mounted instance (a Sheet never re-opens after closing).
  useEffect(() => {
    lockBodyScroll();
    return unlockBodyScroll;
  }, []);

  // Drag-dismiss exit: continue the throw (current offset + release
  // velocity) rather than the CSS keyframe, then hand off to `onExited`.
  useEffect(() => {
    if (open || !dragDismissed) return undefined;
    const controls = animate(y, '120%', { ...transition, velocity: dragVelocityRef.current });
    let cancelled = false;
    controls.then(() => { if (!cancelled) fireExited(); });
    return () => { cancelled = true; controls.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dragDismissed]);

  // Non-drag exit fallback: onAnimationEnd (below) is the primary signal,
  // this only fires if that somehow doesn't.
  useEffect(() => {
    if (open || dragDismissed) return undefined;
    const timer = setTimeout(fireExited, EXIT_FALLBACK_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dragDismissed]);

  function handleContainerAnimationEnd(e) {
    // Ignore bubbled animationend events from descendants (e.g. a spinner)
    // and the drag-dismiss path, which completes via the promise above.
    if (e.target !== e.currentTarget || open || dragDismissed) return;
    fireExited();
  }

  // Only the phone/compact sheet is draggable — a mouse-centered dialog has
  // nothing to drag, same reasoning that already omits the pill for it.
  const Container = isDialog ? 'div' : motion.div;
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(43, 38, 33, 0.4)',
      display: 'flex',
      // flex-end is what docks the sheet to the bottom edge; centering it is
      // the whole structural difference between the two placements.
      alignItems: isDialog ? 'center' : 'flex-end',
      justifyContent: 'center',
      // Keeps a tall dialog off the viewport edges; the sheet is deliberately
      // flush instead.
      padding: isDialog ? 'var(--space-6)' : undefined,
      zIndex: 100,
      animation: open
        ? 'ph-scrim-in var(--duration-base) var(--ease-out)'
        : 'ph-scrim-out var(--duration-base) var(--ease-out) forwards',
    }} onClick={(e) => { if (e.target === e.currentTarget && !dragActiveRef.current) onClose && onClose(); }}>
      {/* Escape is handled by our own listener above (it needs to fire even
          before the trap's initial focus lands); the trap itself only owns
          Tab-cycling and initial/return focus. `fallbackFocus` targets the
          dialog container itself (tabIndex={-1} makes it programmatically
          focusable) — without it, focus-trap throws whenever a sheet mounts
          with no tabbable content yet, e.g. a modal showing only a loading
          spinner before its data arrives, taking down the whole app since
          there's no error boundary. `allowOutsideClick: true` is required
          too: by default focus-trap preventDefault+stops propagation on any
          click outside the trapped element (to keep focus from "escaping"),
          which silently ate the backdrop's own onClick below before it ever
          fired — clicking outside a modal did nothing on desktop even though
          Escape worked, since Escape bypasses the trap entirely. */}
      <FocusTrap
        active={open}
        focusTrapOptions={{ escapeDeactivates: false, clickOutsideDeactivates: false, allowOutsideClick: true, fallbackFocus: () => containerRef.current }}
      >
        <Container
          ref={containerRef}
          className={className}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          tabIndex={-1}
          onClick={e => e.stopPropagation()}
          onAnimationEnd={handleContainerAnimationEnd}
          {...(isDialog ? {} : {
            drag: 'y',
            dragListener: false,
            dragControls,
            dragConstraints: { top: 0 },
            dragElastic: 0.15,
            dragMomentum: false,
            onDragStart: handleDragStart,
            onDrag: handleDrag,
            onDragEnd: handleDragEnd,
          })}
          style={{
            background: 'var(--surface-card)',
            ...(isDialog
              ? { borderRadius: 'var(--radius-xl)' }
              : { borderTopLeftRadius: 'var(--radius-xl)', borderTopRightRadius: 'var(--radius-xl)' }),
            boxShadow: 'var(--shadow-sheet)',
            width: '100%',
            maxWidth: 'var(--dialog-max-width)',
            maxHeight: isDialog ? 'min(80vh, 720px)' : '88vh',
            overflowY: 'auto',
            // The sheet's 28px bottom overshoot and safe-area inset are
            // bottom-edge affordances; a centered dialog wants even padding.
            padding: isDialog ? '20px 24px 24px' : '12px 20px calc(28px + env(safe-area-inset-bottom, 0px))',
            // A drag-dismiss drives its own exit imperatively via the `y`
            // motion value (see the effect above) and a plain opacity
            // transition — the CSS keyframe below is for every other
            // dismissal route, which starts from a resting position.
            ...(dragDismissed
              ? { opacity: 0, transition: 'opacity var(--duration-base) var(--ease-out)' }
              : {
                animation: open
                  ? (isDialog ? 'ph-dialog-in var(--spring-duration) var(--ease-spring)' : 'ph-sheet-in var(--spring-duration) var(--ease-spring)')
                  : (isDialog ? 'ph-dialog-out var(--spring-duration) var(--ease-spring) forwards' : 'ph-sheet-out var(--spring-duration) var(--ease-spring) forwards'),
              }),
            // Sheets can be triggered from anywhere in the tree (e.g. a
            // centered footer) — position: fixed detaches the sheet
            // visually but not from CSS inheritance, so without this a
            // sheet's text silently inherits whatever text-align the
            // trigger's ancestors happen to have set.
            textAlign: 'left',
            ...(isDialog ? {} : { y }),
          }}
        >
          {/* Drag-grabber pill — a touch affordance, so omitted on the
              centered dialog where there's nothing to drag. Starts the drag
              gesture itself (dragListener={false} on the container above
              means Framer only watches for a pointerdown here, not anywhere
              in the scrollable content below) — touchAction: 'none' stops
              the browser's own scroll gesture from competing with it. The
              hit target is a separate, larger wrapper around the visible
              4px-tall pill: on a high-density phone screen (reported on a
              Samsung device) the pill alone was too small to reliably land a
              touch on, even though the drag gesture behind it worked fine
              once actually triggered — the wrapper matches the ~44px
              platform-standard minimum touch target without changing the
              pill's visual size. */}
          {isDialog ? null : (
            <div
              aria-hidden="true"
              onPointerDown={(e) => dragControls.start(e)}
              style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', height: 44, margin: '0 auto 4px', touchAction: 'none' }}
            >
              <div style={{ width: 40, height: 4, background: 'var(--warm-300)', borderRadius: 2 }} />
            </div>
          )}
          {title ? (
            <h2 id={titleId} style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-lg)', fontWeight: 700, margin: '0 0 14px', color: 'var(--text-primary)' }}>{title}</h2>
          ) : null}
          {children}
        </Container>
      </FocusTrap>
    </div>
  );
}
