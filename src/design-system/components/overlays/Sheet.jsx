import React, { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Bottom sheet overlay — used for all modal-style flows.
 * Source: Panhandle Design System (components/overlays/Sheet.jsx), extended
 * with a `className` passthrough on the content wrapper so callers (e.g.
 * Modal.jsx) can hook the many pre-existing `.modal …` descendant selectors
 * in src/index.css (labels, inputs, selects, action rows) without every
 * modal's internal markup needing to move onto design-system components. */
export function Sheet({ open = true, onClose, title, children, className }) {
  const contentRef = useRef(null);
  const previousFocusRef = useRef(null);
  const titleId = React.useId();

  useEffect(() => {
    if (!open || !onClose) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Focus management: move focus into the sheet on open, trap Tab within it
  // while open, and restore focus to whatever triggered it on close — same
  // approach as FabMenu.jsx's own overlay.
  useEffect(() => {
    if (!open) return undefined;
    previousFocusRef.current = document.activeElement;
    const node = contentRef.current;
    const firstFocusable = node?.querySelector(FOCUSABLE_SELECTOR);
    (firstFocusable || node)?.focus();

    function handleTab(e) {
      if (e.key !== 'Tab' || !node) return;
      const focusables = Array.from(node.querySelectorAll(FOCUSABLE_SELECTOR));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', handleTab);
    return () => {
      document.removeEventListener('keydown', handleTab);
      previousFocusRef.current?.focus?.();
    };
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
      <div
        ref={contentRef}
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
          // % of the scrim's own box (which is `inset: 0` on the fixed
          // containing block — the frame on desktop, viewport on mobile),
          // not `vh`: on desktop the frame can be shorter than the actual
          // browser viewport, and a vh-based cap could push the sheet past
          // the frame's bottom edge.
          maxHeight: '88%',
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
    </div>
  );
}
