import React from 'react';

/** Rounded checkbox. `variant="task"` (default) is the grocery-list "got it"
 * look — checked reads as done/crossed off, used for grocery list items.
 * `variant="select"` is for pick-which-to-add checklists (e.g. the meal
 * ingredient picker) — checked means "included", not "done", so the label
 * stays full-color with no strikethrough.
 * Source: Panhandle Design System (components/forms/Checkbox.jsx). A real
 * `<button role="checkbox">` (not a plain `<span onClick>`), so it's actually
 * reachable by keyboard/switch-control (TODO #117) — nested inside the
 * `<label>`, a native label-forwarded click still lands on it since `button`
 * is a labelable element, so click-anywhere-on-the-row behavior is unchanged. */
export function Checkbox({ checked, onChange, label, variant = 'task' }) {
  const crossOut = checked && variant !== 'select';
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', cursor: 'pointer', minWidth: 0 }}>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={() => onChange && onChange(!checked)}
        style={{
          width: 24,
          height: 24,
          padding: 0,
          border: checked ? 'none' : '1.5px solid var(--border-strong)',
          borderRadius: 'var(--radius-sm)',
          background: checked ? 'var(--accent-secondary)' : 'transparent',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'background-color var(--duration-fast) var(--ease-out)',
          flexShrink: 0,
        }}
      >
        {checked ? <i className="ph ph-check" style={{ color: 'var(--text-on-accent)', fontSize: '15px' }} /> : null}
      </button>
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
