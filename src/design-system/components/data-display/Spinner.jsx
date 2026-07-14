import React from 'react';

/** Simple rotating-ring loading indicator, for initial-fetch loading states.
 * Source: Panhandle Design System (components/data-display/Spinner.jsx). */
export function Spinner({ size = 28, color = 'var(--accent-primary)' }) {
  return (
    <span
      role="status"
      aria-label="Laster"
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        border: `${Math.max(2, size / 10)}px solid var(--border-default)`,
        borderTopColor: color,
        borderRadius: '50%',
        animation: 'ph-spin 700ms linear infinite',
      }}
    />
  );
}

/** Centered spinner block for a whole screen/section's initial loading
 * state (as opposed to the bare `Spinner` glyph for inline use). */
export function LoadingState({ label = 'Laster...' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '48px 16px' }}>
      <Spinner size={28} />
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>{label}</span>
    </div>
  );
}
