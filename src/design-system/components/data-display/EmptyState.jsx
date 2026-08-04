import React from 'react';

/** Shared "nothing here yet" block — icon + short message, for any screen or
 * modal with no content to show. Replaces each screen's own bespoke empty
 * copy/styling convention. `illustration` (a rendered node, e.g. an inline
 * SVG) takes priority over `icon` for screens worth the extra art; callers
 * that only pass `icon` are unaffected. `action` (e.g. a retry Button) is
 * optional and renders below the description, for the error-state variant of
 * this same block (empty because there's nothing yet vs. empty because the
 * load failed) rather than a second bespoke component.
 * Source: Panhandle Design System (components/data-display/EmptyState.jsx). */
export function EmptyState({ icon, illustration, title, description, action }) {
  return (
    <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '48px 16px' }}>
      {illustration ? (
        <div style={{ marginBottom: 14 }}>{illustration}</div>
      ) : icon ? (
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
      {action ? <div style={{ marginTop: 16 }}>{action}</div> : null}
    </div>
  );
}
