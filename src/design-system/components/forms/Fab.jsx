import React from 'react';
import { useRipple, Ripples } from '../../lib/useRipple.jsx';

/**
 * Floating action button — the Android-style primary "add" action, pinned
 * bottom-right above the TabBar. Terracotta fill, raised shadow, Material
 * ripple, and an M3-Expressive press: a spring "give" plus a corner-radius
 * morph. When `active` (e.g. its FAB menu is open) the circle morphs to a
 * squircle and a `plus` icon rotates 45° into a close "×" — a shape/icon
 * morph rather than a hard glyph swap. Pass an optional `badge` node
 * (rendered top-right, allowed to overflow) and the Phosphor `icon` name.
 * Source: Panhandle Design System (README "Platform: Android web app").
 */
export function Fab({ icon = 'plus', label, onClick, badge = null, active = false }) {
  const [press, setPress] = React.useState(false);
  const [hover, setHover] = React.useState(false);
  const { ripples, spawn } = useRipple();

  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={active || undefined}
      onClick={onClick}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHover(true); }}
      onPointerDown={(e) => { setPress(true); spawn(e); }}
      onPointerUp={() => setPress(false)}
      onPointerLeave={() => { setHover(false); setPress(false); }}
      onPointerCancel={() => setPress(false)}
      style={{
        position: 'fixed',
        bottom: 'calc(84px + env(safe-area-inset-bottom))',
        right: 'var(--fab-right)',
        width: 56,
        height: 56,
        // Circle at rest, squircle when active — an M3-Expressive shape morph.
        // Rest uses 28px (half of 56 = a true circle) rather than the pill
        // 999px so the radius interpolates smoothly through the 20–28px range;
        // animating from 999px let the (overshooting) spring drive the value
        // negative mid-transition, which painted as a momentary hard square.
        borderRadius: active ? 'var(--shape-large)' : '28px',
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
        transform: press ? 'scale(var(--press-scale))' : 'scale(1)',
        transition:
          'background-color var(--duration-fast) var(--ease-out), ' +
          'transform var(--spring-duration-soft) var(--ease-spring-soft), ' +
          // Soft spring (tiny overshoot) on the radius so the morph stays in
          // the rounded range and never flashes square.
          'border-radius var(--spring-duration-soft) var(--ease-spring-soft)',
      }}
    >
      {/* Ripple clip layer — masks ripples + state layer to the FAB's current
          shape (follows the radius morph), while the badge can overflow. */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 'inherit',
          overflow: 'hidden',
        }}
      >
        {hover || press ? (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              background: 'var(--md-on-primary)',
              opacity: press ? 'var(--state-pressed-opacity)' : 'var(--state-hover-opacity)',
            }}
          />
        ) : null}
        <Ripples ripples={ripples} tint="rgba(255,255,255,0.35)" />
      </span>
      {badge}
      {/* A `plus` rotates 45° into an "×"; any other icon just gets a subtle
          turn as an "activated" cue. Springs so it settles with a little life. */}
      <i
        className={`ph ph-${icon}`}
        style={{
          position: 'relative',
          transform: active ? 'rotate(45deg)' : 'rotate(0deg)',
          transition: 'transform var(--spring-duration-soft) var(--ease-spring-soft)',
        }}
      />
    </button>
  );
}
