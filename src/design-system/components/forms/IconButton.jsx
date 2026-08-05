import React from 'react';
import { BaseButton } from './BaseButton.jsx';

/** Icon-only circular button, for compact toolbar/list actions.
 * Source: Panhandle Design System (components/forms/IconButton.jsx), with the
 * app's pointer-based press and the design system's Android Material ripple —
 * via the shared `BaseButton` primitive (TODO #118). */
export function IconButton({ icon, size = 'md', variant = 'ghost', onClick, label, style: styleOverride }) {
  const sizes = { sm: 32, md: 40, lg: 48 };
  const dim = sizes[size];

  const restBg = {
    ghost: { background: 'transparent', color: 'var(--text-primary)' },
    filled: { background: 'var(--accent-primary)', color: 'var(--text-on-accent)' },
    subtle: { background: 'var(--surface-sunken)', color: 'var(--accent-primary)' },
    danger: { background: 'transparent', color: 'var(--status-danger)' },
  };
  const hoverBg = {
    ghost: { background: 'var(--surface-sunken)' },
    filled: { background: 'var(--accent-primary-hover)' },
    subtle: { background: 'var(--accent-primary-subtle)' },
    danger: { background: 'var(--status-danger-subtle)' },
  };

  const rippleTint = variant === 'filled' ? 'rgba(255,255,255,0.35)' : 'rgba(43,38,33,0.15)';
  // M3 state layer — flat tonal wash on hover/press over the fill.
  const stateLayerColor = variant === 'filled' ? 'var(--md-on-primary)' : 'var(--md-on-surface)';

  return (
    <BaseButton
      aria-label={label}
      onClick={onClick}
      style={{
        width: dim,
        height: dim,
        borderRadius: 'var(--radius-pill)',
        border: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: dim * 0.5,
        flexShrink: 0,
        ...restBg[variant],
        ...styleOverride,
      }}
      hoverStyle={hoverBg[variant]}
      pressStyle={{ transform: 'scale(var(--press-scale))' }}
      stateLayerColor={stateLayerColor}
      rippleTint={rippleTint}
    >
      <i className={`ph ph-${icon}`} style={{ position: 'relative' }} />
    </BaseButton>
  );
}
