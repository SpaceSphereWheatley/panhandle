import React from 'react';

/** Native <select> styled to match the Input primitive — same rounded
 * container, focus ring, and tokenized padding/radius/font, so form controls
 * across the app read as one system instead of a hand-styled browser default.
 * A caret glyph sits on the trailing edge (the native arrow is hidden via
 * `appearance: none`). Source: Panhandle Design System, mirroring Input.jsx. */
export const Select = React.forwardRef(function Select(
  { value, onChange, children, style, id, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledby, ...rest },
  ref
) {
  const [focus, setFocus] = React.useState(false);
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        background: 'var(--surface-card)',
        border: '1.5px solid ' + (focus ? 'var(--accent-primary)' : 'var(--border-default)'),
        borderRadius: 'var(--radius-md)',
        boxShadow: focus ? 'var(--border-focus)' : 'none',
        transition: 'border-color 150ms ease-out, box-shadow 150ms ease-out',
        ...style,
      }}
    >
      <select
        ref={ref}
        id={id}
        value={value}
        onChange={onChange}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        {...rest}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          appearance: 'none',
          WebkitAppearance: 'none',
          MozAppearance: 'none',
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-md)',
          color: 'var(--text-primary)',
          padding: '12px 40px 12px 16px',
          width: '100%',
          minWidth: 0,
          cursor: 'pointer',
        }}
      >
        {children}
      </select>
      <i
        className="ph ph-caret-down"
        aria-hidden="true"
        style={{
          position: 'absolute',
          right: 14,
          fontSize: 16,
          color: 'var(--text-tertiary)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
});
