import React from 'react';

/** Text input with optional leading icon, used for search and forms.
 * Source: Panhandle Design System (components/forms/Input.jsx), extended
 * with `type`/ref-forwarding and a `trailing` slot (password show/hide
 * toggle) needed by the real app's login form. */
export const Input = React.forwardRef(function Input(
  { placeholder, value, onChange, onKeyDown, icon = null, type = 'text', autoComplete, trailing = null, style },
  ref
) {
  const [focus, setFocus] = React.useState(false);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        background: 'var(--surface-card)',
        border: '1.5px solid ' + (focus ? 'var(--accent-primary)' : 'var(--border-default)'),
        borderRadius: 'var(--radius-md)',
        padding: '12px 16px',
        boxShadow: focus ? 'var(--border-focus)' : 'none',
        transition: 'border-color 150ms ease-out, box-shadow 150ms ease-out',
        ...style,
      }}
    >
      {icon ? <i className={`ph ph-${icon}`} style={{ color: 'var(--text-tertiary)', fontSize: '18px' }} /> : null}
      <input
        ref={ref}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        autoComplete={autoComplete}
        style={{
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-md)',
          color: 'var(--text-primary)',
          flex: 1,
          minWidth: 0,
        }}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
      />
      {trailing}
    </div>
  );
});
