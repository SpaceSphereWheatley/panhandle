import React from 'react';

/** Toggle switch — used for settings-style binary choices.
 * Source: Panhandle Design System (components/forms/Switch.jsx). */
export function Switch({ checked, onChange, label }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
      <span
        onClick={() => onChange && onChange(!checked)}
        style={{
          width: 44,
          height: 26,
          borderRadius: 'var(--radius-pill)',
          background: checked ? 'var(--accent-primary)' : 'var(--warm-300)',
          position: 'relative',
          transition: 'background-color 150ms ease-out',
          flexShrink: 0,
        }}
      >
        <span style={{
          position: 'absolute',
          top: 3,
          left: checked ? 21 : 3,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: 'var(--surface-card)',
          boxShadow: 'var(--shadow-sm)',
          transition: 'left 150ms ease-out',
        }} />
      </span>
      {label ? <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-md)', color: 'var(--text-primary)' }}>{label}</span> : null}
    </label>
  );
}
