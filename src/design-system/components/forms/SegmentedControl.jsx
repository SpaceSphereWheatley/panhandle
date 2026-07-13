import React from 'react';

/** 3-way pill segmented control — used for Tema and Designintensitet.
 * Source: Panhandle Design System (components/forms/SegmentedControl.jsx). */
export function SegmentedControl({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, background: 'var(--surface-sunken)', borderRadius: 'var(--radius-pill)', padding: 3 }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            flex: 1,
            border: 'none',
            borderRadius: 'var(--radius-pill)',
            padding: '8px 10px',
            fontSize: 'var(--text-xs)',
            fontFamily: 'var(--font-sans)',
            cursor: 'pointer',
            background: value === opt.value ? 'var(--accent-primary)' : 'transparent',
            color: value === opt.value ? 'var(--text-on-accent)' : 'var(--text-primary)',
            transition: 'background-color var(--spring-duration-soft) var(--ease-spring-soft)',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
