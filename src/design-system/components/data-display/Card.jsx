import React from 'react';

/** Base surface card — rounded, soft shadow, used to contain any grouped content.
 * forwardRef so framer-motion's motion(Card) wrapper can measure/animate the
 * underlying DOM node (used for grid-reflow layout animations).
 * Source: Panhandle Design System (components/data-display/Card.jsx). */
export const Card = React.forwardRef(function Card({ children, padding = 'md', onClick, style, ...rest }, ref) {
  const paddings = { sm: '12px 16px', md: '18px 20px', lg: '24px', none: 0 };
  return (
    <div
      ref={ref}
      onClick={onClick}
      style={{
        background: 'var(--surface-card)',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-card)',
        padding: paddings[padding],
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
});
