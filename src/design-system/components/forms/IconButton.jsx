import React from 'react';

/** Icon-only circular button, for compact toolbar/list actions.
 * Source: Panhandle Design System (components/forms/IconButton.jsx). */
export function IconButton({ icon, size = 'md', variant = 'ghost', onClick, label }) {
  const [hover, setHover] = React.useState(false);
  const sizes = { sm: 32, md: 40, lg: 48 };
  const dim = sizes[size];

  const variants = {
    ghost: { background: hover ? 'var(--surface-sunken)' : 'transparent', color: 'var(--text-primary)' },
    filled: { background: hover ? 'var(--accent-primary-hover)' : 'var(--accent-primary)', color: 'var(--text-on-accent)' },
    subtle: { background: hover ? 'var(--accent-primary-subtle)' : 'var(--surface-sunken)', color: 'var(--accent-primary)' },
  };

  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: dim,
        height: dim,
        borderRadius: 'var(--radius-pill)',
        border: 'none',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background-color 150ms ease-out',
        fontSize: dim * 0.5,
        flexShrink: 0,
        ...variants[variant],
      }}
    >
      <i className={`ph ph-${icon}`} />
    </button>
  );
}
