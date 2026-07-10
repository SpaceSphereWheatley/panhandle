import React from 'react';

/** Screen-top header — title, optional back button, optional trailing action.
 * Source: Panhandle Design System (components/navigation/Header.jsx),
 * extended with a sticky/safe-area treatment to match the real app's
 * single-page-with-fixed-chrome layout. */
export function Header({ title, onBack, action }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 'calc(var(--space-3) + env(safe-area-inset-top)) var(--screen-margin) 10px',
      background: 'var(--surface-page)',
      position: 'sticky',
      top: 0,
      zIndex: 10,
      maxWidth: 480,
      margin: '0 auto',
      width: '100%',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        {onBack ? (
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--text-primary)' }}>
            <i className="ph ph-caret-left" style={{ fontSize: 22 }} />
          </button>
        ) : null}
        <h1 style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-2xl)',
          fontWeight: 'var(--weight-bold)',
          letterSpacing: 'var(--tracking-tight)',
          color: 'var(--text-primary)',
          margin: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>{title}</h1>
      </div>
      {action}
    </div>
  );
}
