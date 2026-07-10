import React from 'react';

/** Bottom tab bar — primary navigation. Source: Panhandle Design System
 * (components/navigation/TabBar.jsx), extended with the fixed/safe-area
 * positioning the real app's single-page layout needs. */
export function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      width: '100%',
      maxWidth: 480,
      zIndex: 10,
      display: 'flex',
      background: 'var(--surface-card)',
      borderTop: '1px solid var(--border-default)',
      padding: '10px 8px calc(10px + env(safe-area-inset-bottom, 0px))',
      justifyContent: 'space-around',
    }}>
      {tabs.map(t => {
        const isActive = t.key === active;
        return (
          <button
            key={t.key}
            onClick={() => onChange && onChange(t.key)}
            style={{
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
              transition: 'color 150ms ease-out',
            }}
          >
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px 20px',
              borderRadius: 'var(--radius-pill)',
              background: isActive ? 'var(--accent-primary-subtle)' : 'transparent',
              transition: 'background-color 150ms ease-out',
            }}>
              <i className={`ph ${isActive ? 'ph-fill' : ''} ph-${t.icon}`} style={{ fontSize: 24 }} />
            </span>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-2xs)', fontWeight: isActive ? 600 : 500 }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
