import React from 'react';

/** Base surface card — rounded, soft shadow, used to contain any grouped content.
 * Source: Panhandle Design System (components/data-display/Card.jsx). */
export function Card({ children, padding = 'md', onClick, style, ...rest }) {
  const paddings = { sm: '12px 16px', md: '18px 20px', lg: '24px', none: 0 };
  return (
    <div
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
}
