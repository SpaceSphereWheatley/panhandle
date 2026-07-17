import React from 'react';
import { useRipple } from '../../lib/useRipple.jsx';

/** Base surface card — rounded, soft shadow, used to contain any grouped content.
 * forwardRef so framer-motion's motion(Card) wrapper can measure/animate the
 * underlying DOM node (used for grid-reflow layout animations).
 * `interactive` opts a card into M3 state-layer + ripple press feedback (a
 * colour wash while held, plus a tap ripple) on top of the plain `onClick`
 * every Card already supported — existing `onClick` consumers (e.g. ItemCard,
 * which supplies its own role/tabIndex/keydown) are untouched unless they
 * explicitly ask for it. The state layer/ripple use `currentColor`, so they
 * automatically pick up whatever on-surface tone the caller's `style.color`
 * puts on the card (e.g. the meals tab's inverse-surface "today" card) with
 * no extra prop. Deliberately no press-scale: that would need its own,
 * Framer-untouched node to stay safe next to `motion(Card)`'s `layout`
 * tracking — a follow-up once colour+ripple alone has been checked live,
 * not speculative complexity added up front.
 * Source: Panhandle Design System (components/data-display/Card.jsx). */
export const Card = React.forwardRef(function Card(
  { children, padding = 'md', onClick, interactive = false, style, ...rest },
  ref
) {
  const paddings = { sm: '12px 16px', md: '18px 20px', lg: '24px', none: 0 };
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);
  const { ripples, spawn } = useRipple();

  const baseStyle = {
    background: 'var(--surface-card)',
    borderRadius: 'var(--radius-card)',
    boxShadow: 'var(--shadow-card)',
    padding: paddings[padding],
    cursor: onClick ? 'pointer' : 'default',
  };

  if (!interactive) {
    return (
      <div ref={ref} onClick={onClick} style={{ ...baseStyle, ...style }} {...rest}>
        {children}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.(e);
        }
      }}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHover(true); }}
      onPointerLeave={() => { setHover(false); setPress(false); }}
      onPointerDown={(e) => { setPress(true); spawn(e); }}
      onPointerUp={() => setPress(false)}
      onPointerCancel={() => setPress(false)}
      style={{ ...baseStyle, position: 'relative', overflow: 'hidden', ...style }}
      {...rest}
    >
      {(hover || press) && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: 'currentColor',
            opacity: press ? 'var(--state-pressed-opacity)' : 'var(--state-hover-opacity)',
          }}
        />
      )}
      {ripples.map((r) => (
        <span
          key={r.id}
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: r.x,
            top: r.y,
            width: r.size,
            height: r.size,
            borderRadius: '50%',
            background: 'currentColor',
            opacity: 0.16,
            transform: 'scale(0)',
            animation: 'ph-ripple 500ms var(--ease-out) forwards',
            pointerEvents: 'none',
          }}
        />
      ))}
      {children}
    </div>
  );
});
