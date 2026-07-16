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

/** Bottom sheet overlay — used for all modal-style flows.
 * Source: Panhandle Design System (components/overlays/Sheet.jsx), extended
 * with a `className` passthrough on the content wrapper so callers (e.g.
 * Modal.jsx) can hook the many pre-existing `.modal …` descendant selectors
 * in src/index.css (labels, inputs, selects, action rows) without every
 * modal's internal markup needing to move onto design-system components. */
export function Sheet({ open = true, onClose, title, children, className }) {
  const titleId = React.useId();

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
      alignItems: 'flex-end',
      justifyContent: 'center',
      zIndex: 100,
      animation: 'ph-scrim-in var(--duration-base) var(--ease-out)',
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose && onClose(); }}>
      {/* Escape is handled by our own listener above (it needs to fire even
          before the trap's initial focus lands); the trap itself only owns
          Tab-cycling and initial/return focus. */}
      <FocusTrap active={open} focusTrapOptions={{ escapeDeactivates: false, clickOutsideDeactivates: false }}>
        <div
          className={className}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          tabIndex={-1}
          onClick={e => e.stopPropagation()}
          style={{
            background: 'var(--surface-card)',
            borderTopLeftRadius: 'var(--radius-xl)',
            borderTopRightRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-sheet)',
            width: '100%',
            maxWidth: 480,
            maxHeight: '88vh',
            overflowY: 'auto',
            padding: '12px 20px calc(28px + env(safe-area-inset-bottom, 0px))',
            animation: 'ph-sheet-in var(--spring-duration) var(--ease-spring)',
          }}
        >
          <div style={{ width: 40, height: 4, background: 'var(--warm-300)', borderRadius: 2, margin: '4px auto 16px' }} />
          {title ? (
            <h2 id={titleId} style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-lg)', fontWeight: 700, margin: '0 0 14px', color: 'var(--text-primary)' }}>{title}</h2>
          ) : null}
          {children}
        </div>
      </FocusTrap>
    </div>
  );
}
