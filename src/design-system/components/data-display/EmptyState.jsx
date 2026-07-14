import React from 'react';

/** Shared "nothing here yet" block — icon + short message, for any screen or
 * modal with no content to show. Replaces each screen's own bespoke empty
 * copy/styling convention.
 * Source: Panhandle Design System (components/data-display/EmptyState.jsx). */
export function EmptyState({ icon, title, description }) {
  return (
    <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '48px 16px' }}>
      {icon ? (
        <i className={`ph ph-${icon}`} style={{ fontSize: 32, display: 'block', marginBottom: 10 }} aria-hidden="true" />
      ) : null}
      {title ? (
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: description ? 4 : 0 }}>
          {title}
        </div>
      ) : null}
      {description ? (
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)' }}>{description}</div>
      ) : null}
    </div>
  );
}
