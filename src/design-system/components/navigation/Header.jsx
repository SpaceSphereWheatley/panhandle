import React from 'react';
import { IconButton } from '../forms/IconButton.jsx';

/** Screen-top header — title, optional back button, optional trailing action.
 * Source: Panhandle Design System (components/navigation/Header.jsx),
 * extended with a sticky/safe-area treatment to match the real app's
 * single-page-with-fixed-chrome layout. Back button goes through the shared
 * `IconButton` (TODO #118) instead of a hand-styled `<button>`, so it gets
 * real press/hover feedback and a proper 40px touch target like every other
 * icon button in the app. */
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
      maxWidth: 'var(--content-max-width)',
      margin: '0 auto',
      width: '100%',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        {onBack ? (
          <IconButton icon="caret-left" variant="ghost" label="Tilbake" onClick={onBack} style={{ marginLeft: -8 }} />
        ) : null}
        <h1 style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--md-headline-emphasized-size)',
          lineHeight: 'var(--md-headline-emphasized-line)',
          fontWeight: 'var(--md-headline-emphasized-weight)',
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
