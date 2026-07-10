import React from 'react';

/** Small pill tag — used for categories, "who's cooking", and meal-link badges.
 * Source: Panhandle Design System (components/forms/Tag.jsx). */
export function Tag({ children, tone = 'neutral', hand = false }) {
  const tones = {
    neutral: { background: 'var(--surface-sunken)', color: 'var(--text-secondary)' },
    primary: { background: 'var(--accent-primary-subtle)', color: 'var(--accent-primary-press)' },
    secondary: { background: 'var(--accent-secondary-subtle)', color: 'var(--sage-700)' },
    tertiary: { background: 'var(--accent-tertiary-subtle)', color: 'var(--warm-800)' },
  };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: hand ? '2px 12px 4px' : '4px 12px',
        borderRadius: 'var(--radius-pill)',
        fontFamily: hand ? 'var(--font-hand)' : 'var(--font-sans)',
        fontWeight: hand ? 600 : 'var(--weight-medium)',
        fontSize: hand ? '19px' : 'var(--text-xs)',
        lineHeight: 1,
        whiteSpace: 'nowrap',
        ...tones[tone],
      }}
    >
      {children}
    </span>
  );
}
