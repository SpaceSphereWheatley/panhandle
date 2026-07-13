import React from 'react';

/** Bottom tab bar — primary navigation. Source: Panhandle Design System
 * (components/navigation/TabBar.jsx), extended with the fixed/safe-area
 * positioning the real app's single-page layout needs, and an M3-Expressive
 * nav indicator: a single pill that springs/slides between tabs (rather than
 * fading in and out per tab), with the active icon filling + lifting. */
export function TabBar({ tabs, active, onChange }) {
  const n = tabs.length;
  const activeIndex = Math.max(0, tabs.findIndex((t) => t.key === active));
  const INDICATOR_W = 64;

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      width: '100%',
      maxWidth: 480,
      zIndex: 10,
      background: 'var(--surface-card)',
      borderTop: '1px solid var(--border-default)',
      padding: '10px 8px calc(10px + env(safe-area-inset-bottom, 0px))',
    }}>
      {/* Inner track: the indicator's % positioning is relative to exactly the
          flex row that holds the tabs, so it lines up regardless of padding. */}
      <div style={{ position: 'relative', display: 'flex', width: '100%' }}>
        {/* Sliding indicator pill, behind the icons. */}
        <span
          aria-hidden="true"
          style={{
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
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 4px',
                color: isActive ? 'var(--accent-primary-press)' : 'var(--text-tertiary)',
                transition: 'color var(--duration-fast) var(--ease-out)',
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
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-2xs)', fontWeight: isActive ? 600 : 500 }}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
