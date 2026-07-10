import React from 'react';

/** Small status/count badge — solid fill, for counts or state indicators.
 * Source: Panhandle Design System (components/data-display/Badge.jsx). */
export function Badge({ children, tone = 'primary' }) {
  const tones = {
    primary: { background: 'var(--accent-primary)', color: 'var(--text-on-accent)' },
    secondary: { background: 'var(--accent-secondary)', color: 'var(--text-on-accent)' },
    neutral: { background: 'var(--warm-800)', color: 'var(--text-on-accent)' },
    danger: { background: 'var(--status-danger)', color: 'var(--text-on-accent)' },
  };
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 20,
      height: 20,
      padding: '0 6px',
      borderRadius: 'var(--radius-pill)',
      fontFamily: 'var(--font-sans)',
      fontWeight: 'var(--weight-semibold)',
      fontSize: 'var(--text-2xs)',
      ...tones[tone],
    }}>
      {children}
    </span>
  );
}
