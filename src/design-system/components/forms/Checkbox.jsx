import React from 'react';

/** Rounded checkbox — used for grocery list items ("got it").
 * Source: Panhandle Design System (components/forms/Checkbox.jsx). */
export function Checkbox({ checked, onChange, label }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', cursor: 'pointer', minWidth: 0 }}>
      <span
        onClick={() => onChange && onChange(!checked)}
        style={{
          width: 24,
          height: 24,
          borderRadius: 'var(--radius-sm)',
          border: checked ? 'none' : '1.5px solid var(--border-strong)',
          background: checked ? 'var(--accent-secondary)' : 'transparent',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background-color 150ms ease-out',
          flexShrink: 0,
        }}
      >
        {checked ? <i className="ph ph-check-bold" style={{ color: 'var(--text-on-accent)', fontSize: '15px' }} /> : null}
      </span>
      {label ? (
        <span style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-md)',
          color: checked ? 'var(--text-tertiary)' : 'var(--text-primary)',
          textDecoration: checked ? 'line-through' : 'none',
          transition: 'color 150ms ease-out',
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>{label}</span>
      ) : null}
    </label>
  );
}
