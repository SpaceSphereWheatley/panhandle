import React from 'react';
import { useRipple, Ripples } from '../../lib/useRipple.jsx';

/** Icon-only circular button, for compact toolbar/list actions.
 * Source: Panhandle Design System (components/forms/IconButton.jsx), with the
 * app's pointer-based press and the design system's Android Material ripple. */
export function IconButton({ icon, size = 'md', variant = 'ghost', onClick, label }) {
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);
  const { ripples, spawn } = useRipple();
  const sizes = { sm: 32, md: 40, lg: 48 };
  const dim = sizes[size];

  const variants = {
    ghost: { background: hover ? 'var(--surface-sunken)' : 'transparent', color: 'var(--text-primary)' },
    filled: { background: hover ? 'var(--accent-primary-hover)' : 'var(--accent-primary)', color: 'var(--text-on-accent)' },
    subtle: { background: hover ? 'var(--accent-primary-subtle)' : 'var(--surface-sunken)', color: 'var(--accent-primary)' },
    danger: { background: hover ? 'var(--status-danger-subtle)' : 'transparent', color: 'var(--status-danger)' },
  };

  const rippleTint = variant === 'filled' ? 'rgba(255,255,255,0.35)' : 'rgba(43,38,33,0.15)';

  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHover(true); }}
      onPointerLeave={() => { setHover(false); setPress(false); }}
      onPointerDown={(e) => { setPress(true); spawn(e); }}
      onPointerUp={() => setPress(false)}
      onPointerCancel={() => setPress(false)}
      style={{
        width: dim,
        height: dim,
        borderRadius: 'var(--radius-pill)',
        border: 'none',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background-color var(--duration-fast) var(--ease-out), transform var(--duration-fast) var(--ease-out)',
        transform: press ? 'scale(var(--press-scale))' : 'none',
        fontSize: dim * 0.5,
        flexShrink: 0,
        ...variants[variant],
      }}
    >
      <Ripples ripples={ripples} tint={rippleTint} />
      <i className={`ph ph-${icon}`} style={{ position: 'relative' }} />
    </button>
  );
}
