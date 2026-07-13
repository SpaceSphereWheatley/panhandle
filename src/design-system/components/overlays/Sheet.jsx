import React from 'react';

/** Bottom sheet overlay — used for all modal-style flows.
 * Source: Panhandle Design System (components/overlays/Sheet.jsx), extended
 * with a `className` passthrough on the content wrapper so callers (e.g.
 * Modal.jsx) can hook the many pre-existing `.modal …` descendant selectors
 * in src/index.css (labels, inputs, selects, action rows) without every
 * modal's internal markup needing to move onto design-system components. */
export function Sheet({ open = true, onClose, title, children, className }) {
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
        className={className}
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
          <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-lg)', fontWeight: 700, margin: '0 0 14px', color: 'var(--text-primary)' }}>{title}</h2>
        ) : null}
        {children}
      </div>
    </div>
  );
}
