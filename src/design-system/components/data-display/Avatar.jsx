import React from 'react';

/** Circular avatar for a household member — initials or emoji-free color fill.
 * Source: Panhandle Design System (components/data-display/Avatar.jsx). */
export function Avatar({ name, color = 'var(--accent-primary)', size = 36 }) {
  const initials = name ? name.trim().slice(0, 1).toUpperCase() : '?';
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: color,
      color: 'var(--text-on-accent)',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-sans)',
      fontWeight: 'var(--weight-semibold)',
      fontSize: size * 0.42,
      flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}
