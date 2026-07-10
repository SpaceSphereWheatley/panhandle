import React from 'react';
import { Checkbox } from '../forms/Checkbox.jsx';

/** Single row in the shopping list — checkbox, name, quantity, optional
 * meal-link tag. Source: Panhandle Design System
 * (components/data-display/ListItem.jsx), extended with a `leading` slot
 * so the real app's per-item hand-drawn ItemIcon badge can sit before the
 * checkbox, a `trailing` slot for edit/delete IconButtons, and a
 * `subtitle` line (e.g. item notes) under the label. */
export function ListItem({ label, subtitle = null, quantity, checked, onChange, linkedMeal = null, leading = null, trailing = null }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      padding: '14px 4px',
      borderBottom: '1px solid var(--border-default)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
        {leading}
        <div style={{ minWidth: 0, flex: 1 }}>
          <Checkbox checked={checked} onChange={onChange} label={label} />
          {subtitle ? (
            <div style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--text-xs)',
              fontStyle: 'italic',
              color: 'var(--text-tertiary)',
              marginLeft: 34,
              marginTop: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>{subtitle}</div>
          ) : null}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {linkedMeal ? (
          <span style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-2xs)',
            color: 'var(--sage-600)',
            background: 'var(--accent-secondary-subtle)',
            borderRadius: 'var(--radius-pill)',
            padding: '3px 10px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}>
            <i className="ph ph-cooking-pot" />{linkedMeal}
          </span>
        ) : null}
        {quantity ? (
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>{quantity}</span>
        ) : null}
        {trailing}
      </div>
    </div>
  );
}
