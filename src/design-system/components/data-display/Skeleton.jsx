import React from 'react';

/** Pulsing placeholder block for content that hasn't loaded yet — reserves
 * the real layout's shape (rows/cards) so first paint doesn't jump when data
 * arrives, in place of a spinner for a cold load with nothing cached yet.
 * Source: Panhandle Design System (components/data-display/Skeleton.jsx). */
export function Skeleton({ width = '100%', height = 16, radius = 8, style }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'block',
        width,
        height,
        borderRadius: radius,
        background: 'var(--border-default)',
        animation: 'ph-skeleton-pulse 1.4s ease-in-out infinite',
        ...style,
      }}
    />
  );
}
