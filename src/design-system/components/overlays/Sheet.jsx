import React, { useEffect } from 'react';
import FocusTrap from 'focus-trap-react';

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
 * Source: Panhandle Design System (components/overlays/Sheet.jsx), extended
 * with a `className` passthrough on the content wrapper so callers (e.g.
 * Modal.jsx) can hook the many pre-existing `.modal …` descendant selectors
 * in src/index.css (labels, inputs, selects, action rows) without every
 * modal's internal markup needing to move onto design-system components. */
export function Sheet({ open = true, onClose, title, children, className, placement = 'sheet' }) {
  const isDialog = placement === 'dialog';
  const titleId = React.useId();
  const containerRef = React.useRef(null);

  useEffect(() => {
    if (!open || !onClose) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return undefined;
    lockBodyScroll();
    return unlockBodyScroll;
  }, [open]);

  if (!open) return null;
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
      animation: 'ph-scrim-in var(--duration-base) var(--ease-out)',
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose && onClose(); }}>
      {/* Escape is handled by our own listener above (it needs to fire even
          before the trap's initial focus lands); the trap itself only owns
          Tab-cycling and initial/return focus. `fallbackFocus` targets the
          dialog container itself (tabIndex={-1} makes it programmatically
          focusable) — without it, focus-trap throws whenever a sheet mounts
          with no tabbable content yet, e.g. a modal showing only a loading
          spinner before its data arrives, taking down the whole app since
          there's no error boundary. */}
      <FocusTrap
        active={open}
        focusTrapOptions={{ escapeDeactivates: false, clickOutsideDeactivates: false, fallbackFocus: () => containerRef.current }}
      >
        <div
          ref={containerRef}
          className={className}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          tabIndex={-1}
          onClick={e => e.stopPropagation()}
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
            animation: isDialog
              ? 'ph-dialog-in var(--spring-duration) var(--ease-spring)'
              : 'ph-sheet-in var(--spring-duration) var(--ease-spring)',
            // Sheets can be triggered from anywhere in the tree (e.g. a
            // centered footer) — position: fixed detaches the sheet
            // visually but not from CSS inheritance, so without this a
            // sheet's text silently inherits whatever text-align the
            // trigger's ancestors happen to have set.
            textAlign: 'left',
          }}
        >
          {/* Drag-grabber pill — a touch affordance, so omitted on the
              centered dialog where there's nothing to drag. */}
          {isDialog ? null : (
            <div style={{ width: 40, height: 4, background: 'var(--warm-300)', borderRadius: 2, margin: '4px auto 16px' }} />
          )}
          {title ? (
            <h2 id={titleId} style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-lg)', fontWeight: 700, margin: '0 0 14px', color: 'var(--text-primary)' }}>{title}</h2>
          ) : null}
          {children}
        </div>
      </FocusTrap>
    </div>
  );
}
