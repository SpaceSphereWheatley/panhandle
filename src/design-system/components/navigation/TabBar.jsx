import React from 'react';

/* Vertical (rail) row metrics. The indicator's position is computed from this
   fixed pitch rather than a percentage: horizontally the track's width is
   definite so `100% / n` is exactly one tab's share, but vertically the track's
   height is content-driven AND gapped, so `100% / n` is not the row pitch. */
const ROW_H = 48;
const ROW_GAP = 6;

/** Primary navigation. Two orientations from one component:
 *
 *  - `horizontal` (default) — the phone bottom tab bar: fixed to the bottom
 *    edge, capped to the content column, labels under icons.
 *  - `vertical` — the desktop left rail: full-height, its own width token,
 *    labels beside icons, plus an optional `brand` node above the tabs.
 *
 * Both share the M3-Expressive nav indicator: a single pill that springs
 * between tabs (rather than fading in/out per tab), with the active icon
 * filling + lifting. The orientation only changes which axis it slides on, so
 * the intensity/reduced-motion tokens collapse it identically in both.
 *
 * Source: Panhandle Design System (components/navigation/TabBar.jsx), extended
 * with the fixed/safe-area positioning the real app's single-page layout needs.
 */
export function TabBar({ tabs, active, onChange, orientation = 'horizontal', brand = null, navLabel }) {
  const n = tabs.length;
  const activeIndex = Math.max(0, tabs.findIndex((t) => t.key === active));
  const INDICATOR_W = 64;
  const isVertical = orientation === 'vertical';

  return (
    <nav
      aria-label={navLabel}
      style={isVertical ? {
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: 'var(--nav-rail-width)',
        zIndex: 10,
        background: 'var(--surface-card)',
        borderRight: '1px solid var(--border-default)',
        padding: 'calc(var(--space-5) + env(safe-area-inset-top)) var(--space-3) var(--space-5)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-6)',
        overflowY: 'auto',
      } : {
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 'var(--content-max-width)',
        zIndex: 10,
        background: 'var(--surface-card)',
        borderTop: '1px solid var(--border-default)',
        padding: '10px 8px calc(10px + env(safe-area-inset-bottom, 0px))',
      }}>
      {isVertical && brand ? brand : null}
      {/* Inner track: the indicator's positioning is relative to exactly the
          flex row/column that holds the tabs, so it lines up regardless of
          the container's padding. */}
      <div style={{
        position: 'relative',
        display: 'flex',
        flexDirection: isVertical ? 'column' : 'row',
        gap: isVertical ? ROW_GAP : undefined,
        width: '100%',
      }}>
        {/* Sliding indicator pill, behind the icons. */}
        <span
          aria-hidden="true"
          style={isVertical ? {
            position: 'absolute',
            left: 0,
            width: '100%',
            height: ROW_H,
            top: `${activeIndex * (ROW_H + ROW_GAP)}px`,
            borderRadius: 'var(--radius-pill)',
            background: 'var(--accent-primary-subtle)',
            transition: 'top var(--spring-duration) var(--ease-spring)',
            zIndex: 0,
          } : {
            position: 'absolute',
            top: 4,
            height: 32,
            width: INDICATOR_W,
            left: `calc((${activeIndex} + 0.5) * (100% / ${n}) - ${INDICATOR_W / 2}px)`,
            borderRadius: 'var(--radius-pill)',
            background: 'var(--accent-primary-subtle)',
            transition: 'left var(--spring-duration) var(--ease-spring)',
            zIndex: 0,
          }}
        />
        {tabs.map((t) => {
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              onClick={() => onChange && onChange(t.key)}
              aria-current={isActive ? 'page' : undefined}
              style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: isActive ? 'var(--accent-primary-press)' : 'var(--text-tertiary)',
                transition: 'color var(--duration-fast) var(--ease-out)',
                ...(isVertical ? {
                  // Not `flex: 1` — in a column container that stretches each
                  // row to fill the track and breaks the indicator's pitch.
                  flex: '0 0 auto',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: 12,
                  height: ROW_H,
                  padding: '0 var(--space-4)',
                  borderRadius: 'var(--radius-pill)',
                } : {
                  flex: 1,
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 4px',
                }),
              }}
            >
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 32,
                // Active icon lifts + pops slightly; springs so it settles.
                transform: isActive ? 'translateY(-1px) scale(1.06)' : 'scale(1)',
                transition: 'transform var(--spring-duration-soft) var(--ease-spring-soft)',
              }}>
                <i className={`ph ${isActive ? 'ph-fill' : ''} ph-${t.icon}`} style={{ fontSize: 24 }} />
              </span>
              <span style={{
                fontFamily: 'var(--font-sans)',
                fontSize: isVertical ? 'var(--md-label-large-size)' : 'var(--text-2xs)',
                fontWeight: isActive ? 600 : 500,
              }}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
