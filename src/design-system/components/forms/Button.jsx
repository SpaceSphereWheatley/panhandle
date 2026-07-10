import React from 'react';

/**
 * Primary action button. Pill-shaped, terracotta fill by default.
 * Source: Panhandle Design System (components/forms/Button.jsx).
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon = null,
  disabled = false,
  onClick,
  type = 'button',
}) {
  const base = {
    fontFamily: 'var(--font-sans)',
    fontWeight: 'var(--weight-semibold)',
    borderRadius: 'var(--radius-pill)',
    border: 'none',
    cursor: disabled ? 'default' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'background-color 150ms ease-out, transform 100ms ease-out, opacity 150ms ease-out',
    opacity: disabled ? 0.45 : 1,
  };

  const sizes = {
    sm: { fontSize: 'var(--text-xs)', padding: '8px 16px' },
    md: { fontSize: 'var(--text-sm)', padding: '12px 22px' },
    lg: { fontSize: 'var(--text-md)', padding: '15px 26px' },
  };

  const variants = {
    primary: {
      background: 'var(--accent-primary)',
      color: 'var(--text-on-accent)',
    },
    secondary: {
      background: 'var(--accent-secondary)',
      color: 'var(--text-on-accent)',
    },
    outline: {
      background: 'transparent',
      color: 'var(--text-primary)',
      border: '1.5px solid var(--border-strong)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text-primary)',
    },
  };

  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);

  const hoverBg = {
    primary: 'var(--accent-primary-hover)',
    secondary: 'var(--accent-secondary-hover)',
    outline: 'var(--surface-sunken)',
    ghost: 'var(--surface-sunken)',
  };
  const pressBg = {
    primary: 'var(--accent-primary-press)',
    secondary: 'var(--accent-secondary-hover)',
    outline: 'var(--surface-sunken)',
    ghost: 'var(--surface-sunken)',
  };

  const style = {
    ...base,
    ...sizes[size],
    ...variants[variant],
    ...(hover && !disabled ? { background: hoverBg[variant] } : {}),
    ...(press && !disabled ? { background: pressBg[variant], transform: 'scale(0.97)' } : {}),
  };

  return (
    <button
      type={type}
      style={style}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPress(false); }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
    >
      {icon ? <i className={`ph ph-${icon}`} style={{ fontSize: '1.15em' }} /> : null}
      {children}
    </button>
  );
}
