import React from 'react';
import { usePressInteractions } from '../../lib/usePressInteractions.js';
import { Ripples } from '../../lib/useRipple.jsx';

/**
 * Lowest-level interactive-surface primitive (TODO #118): owns hover/press
 * pointer tracking, the Material ripple, and the tonal hover/press state-layer
 * wash every button in the app should share. `Button`/`IconButton` build their
 * variant styling on top of this; a one-off control that needs a shape none of
 * those cover (a segmented-pill toggle, a bordered square icon button, a plain
 * ghost text link) uses it directly so it gets real press feedback instead of
 * a hand-styled `<button>` with none. `:focus-visible` styling is automatic
 * (base.css's tag-selector rule) — this component doesn't apply it itself.
 *
 * `style` is the resting-state style; `hoverStyle`/`pressStyle` are shallow-
 * merged on top while hovered/pressed (mouse hover only, gated in the hook).
 * Fab.jsx doesn't use this directly — its ripple/state-layer live in a nested
 * clip layer so its badge can overflow the button's own shape, which this
 * component's fixed structure doesn't support — but it shares the same
 * `usePressInteractions` hook underneath.
 */
export function BaseButton({
  type = 'button',
  disabled = false,
  onClick,
  style,
  hoverStyle = null,
  pressStyle = null,
  stateLayerColor = 'var(--md-on-surface)',
  rippleTint = 'rgba(43,38,33,0.12)',
  children,
  ...rest
}) {
  const { hover, press, ripples, handlers } = usePressInteractions({ disabled });

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      {...handlers}
      {...rest}
      style={{
        position: 'relative',
        overflow: 'hidden',
        cursor: disabled ? 'default' : 'pointer',
        transition:
          'background-color var(--duration-fast) var(--ease-out), transform var(--spring-duration-soft) var(--ease-spring-soft), opacity var(--duration-fast) var(--ease-out)',
        opacity: disabled ? 0.45 : 1,
        ...style,
        ...(hover && !disabled ? hoverStyle : null),
        ...(press && !disabled ? pressStyle : null),
      }}
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
      {children}
    </button>
  );
}
