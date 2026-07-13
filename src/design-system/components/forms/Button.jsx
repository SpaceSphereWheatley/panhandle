import React from 'react';
import { useRipple, Ripples } from '../../lib/useRipple.jsx';

/**
 * Primary action button. Pill-shaped, terracotta fill by default.
 * Source: Panhandle Design System (components/forms/Button.jsx), with the
 * app's pointer-based press/hover (so touch taps get the "give" too) and the
 * design system's Android Material ripple.
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon = null,
  disabled = false,
  onClick,
  type = 'button',
  style: styleOverride,
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
    position: 'relative',
    overflow: 'hidden',
    transition:
      'background-color var(--duration-fast) var(--ease-out), transform var(--duration-fast) var(--ease-out), opacity var(--duration-fast) var(--ease-out)',
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
    // Destructive actions: a clear red outline that fills on interaction —
    // reads as unmistakably "delete" without shouting like a solid-red button.
    danger: {
      background: 'transparent',
      color: 'var(--status-danger)',
      border: '1.5px solid var(--status-danger)',
    },
  };

  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);
  const { ripples, spawn } = useRipple();

  const hoverBg = {
    primary: 'var(--accent-primary-hover)',
    secondary: 'var(--accent-secondary-hover)',
    outline: 'var(--surface-sunken)',
    ghost: 'var(--surface-sunken)',
    danger: 'var(--status-danger-subtle)',
  };
  const pressBg = {
    primary: 'var(--accent-primary-press)',
    secondary: 'var(--accent-secondary-hover)',
    outline: 'var(--surface-sunken)',
    ghost: 'var(--surface-sunken)',
    danger: 'var(--status-danger-subtle)',
  };

  // Ink-tinted ripple on light/outline/ghost/danger surfaces, light ripple on solid fills.
  const rippleTint =
    variant === 'primary' || variant === 'secondary'
      ? 'rgba(255,255,255,0.35)'
      : variant === 'danger'
        ? 'rgba(178,59,59,0.20)'
        : 'rgba(43,38,33,0.12)';

  // M3 state layer — a flat tonal wash over the fill on hover/press, on top of
  // the brand's colour-darken. Light ink on solid fills, on-surface elsewhere.
  const stateLayerColor =
    variant === 'primary' || variant === 'secondary'
      ? 'var(--md-on-primary)'
      : variant === 'danger'
        ? 'var(--status-danger)'
        : 'var(--md-on-surface)';

  const style = {
    ...base,
    ...sizes[size],
    ...variants[variant],
    ...(hover && !disabled ? { background: hoverBg[variant] } : {}),
    ...(press && !disabled ? { background: pressBg[variant], transform: 'scale(var(--press-scale))' } : {}),
    ...styleOverride,
  };

  // Pointer events (not mouse events) so touch taps get the press "give" too;
  // hover is gated to mouse pointers to avoid sticky hover after a touch tap.
  return (
    <button
      type={type}
      style={style}
      disabled={disabled}
      onClick={onClick}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHover(true); }}
      onPointerLeave={() => { setHover(false); setPress(false); }}
      onPointerDown={(e) => { if (!disabled) { setPress(true); spawn(e); } }}
      onPointerUp={() => setPress(false)}
      onPointerCancel={() => setPress(false)}
    >
      {!disabled && (hover || press) ? (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: stateLayerColor,
            opacity: press ? 'var(--state-pressed-opacity)' : 'var(--state-hover-opacity)',
          }}
        />
      ) : null}
      <Ripples ripples={ripples} tint={rippleTint} />
      {icon ? <i className={`ph ph-${icon}`} style={{ fontSize: '1.15em', position: 'relative' }} /> : null}
      <span style={{ position: 'relative' }}>{children}</span>
    </button>
  );
}
