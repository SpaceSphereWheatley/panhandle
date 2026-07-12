import React from 'react';
import { useRipple, Ripples } from '../../lib/useRipple.jsx';

/**
 * Floating action button — the Android-style primary "add" action, pinned
 * bottom-right above the TabBar. Terracotta fill, raised shadow, darken-and-
 * scale press plus a Material ripple. Pass an optional `badge` node (rendered
 * top-right, allowed to overflow the circle) and the Phosphor `icon` name.
 * Source: Panhandle Design System (README "Platform: Android web app").
 */
export function Fab({ icon = 'plus', label, onClick, badge = null }) {
  const [press, setPress] = React.useState(false);
  const { ripples, spawn } = useRipple();

  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      onPointerDown={(e) => { setPress(true); spawn(e); }}
      onPointerUp={() => setPress(false)}
      onPointerLeave={() => setPress(false)}
      onPointerCancel={() => setPress(false)}
      style={{
        position: 'fixed',
        bottom: 'calc(84px + env(safe-area-inset-bottom))',
        right: 'max(16px, calc(50vw - 224px))',
        width: 56,
        height: 56,
        borderRadius: 'var(--radius-pill)',
        background: press ? 'var(--accent-primary-press)' : 'var(--accent-primary)',
        color: 'var(--text-on-accent)',
        border: 'none',
        boxShadow: 'var(--shadow-raised)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 26,
        cursor: 'pointer',
        zIndex: 11,
        transform: press ? 'scale(var(--press-scale))' : 'none',
        transition: 'background-color var(--duration-fast) var(--ease-out), transform var(--duration-fast) var(--ease-out)',
      }}
    >
      {/* Ripple clip layer — kept inside the circle so ripples are masked to
          the FAB's shape, while the badge below can overflow the bounds. */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 'var(--radius-pill)',
          overflow: 'hidden',
        }}
      >
        <Ripples ripples={ripples} tint="rgba(255,255,255,0.35)" />
      </span>
      {badge}
      <i className={`ph ph-${icon}`} style={{ position: 'relative' }} />
    </button>
  );
}
