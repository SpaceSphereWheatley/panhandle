import React from 'react';

/** Rounded checkbox. `variant="task"` (default) is the grocery-list "got it"
 * look — checked reads as done/crossed off, used for grocery list items.
 * `variant="select"` is for pick-which-to-add checklists (e.g. the meal
 * ingredient picker) — checked means "included", not "done", so the label
 * stays full-color with no strikethrough.
 * Source: Panhandle Design System (components/forms/Checkbox.jsx). */
export function Checkbox({ checked, onChange, label, variant = 'task' }) {
  const crossOut = checked && variant !== 'select';
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
          transition: 'background-color var(--duration-fast) var(--ease-out)',
          flexShrink: 0,
        }}
      >
        {checked ? <i className="ph ph-check" style={{ color: 'var(--text-on-accent)', fontSize: '15px' }} /> : null}
      </span>
      {label ? (
        <span style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-md)',
          color: crossOut ? 'var(--text-tertiary)' : 'var(--text-primary)',
          textDecoration: crossOut ? 'line-through' : 'none',
          transition: 'color var(--duration-fast) var(--ease-out)',
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>{label}</span>
      ) : null}
    </label>
  );
}
