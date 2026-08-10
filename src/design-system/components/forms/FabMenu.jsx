import React from 'react';
import FocusTrap from 'focus-trap-react';
import { Fab } from './Fab.jsx';
import { useRipple, Ripples } from '../../lib/useRipple.jsx';

/* Shared positioning with the Fab — both read the same two tokens (defined in
   design-system/tokens/layout.css), so they stay in sync by construction
   rather than by comment, and follow the content column in either layout. */
const FAB_BOTTOM = 'var(--fab-bottom)';
const FAB_RIGHT = 'var(--fab-right)';

/**
 * Material 3 FAB menu (speed-dial). The FAB stays pinned bottom-right; tapping
 * it fades in a scrim, morphs the icon to a close "×", and rises a right-aligned
 * stack of labeled action buttons above it (staggered). Tapping an action, the
 * scrim, the FAB again, or pressing Esc closes it.
 *
 * Replaces the old custom-modal FAB choosers (ShoppingFabMenu / MealFabMenu).
 *
 *   <FabMenu
 *     label="Legg til vare"
 *     icon="plus"
 *     actions={[{ icon, label, onClick, badge? }]}
 *   />
 *
 * Source: Panhandle Design System (README "Platform: Android web app" —
 * Material-influenced interaction patterns restyled with the brand tokens).
 */
export function FabMenu({ icon = 'plus', label, actions = [], haptic }) {
  const [open, setOpen] = React.useState(false);
  const wrapperRef = React.useRef(null);

  const close = React.useCallback(() => setOpen(false), []);

  function toggle() {
    setOpen((v) => {
      const next = !v;
      if (next) haptic?.();
      return next;
    });
  }

  React.useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function runAction(action) {
    haptic?.();
    setOpen(false);
    action.onClick?.();
  }

  return (
    <>
      {/* Scrim — always mounted so it can fade both ways; inert when closed. */}
      <div
        aria-hidden={!open}
        onClick={close}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(43, 38, 33, 0.4)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity var(--duration-base) var(--ease-out)',
          zIndex: 10,
        }}
      />

      {/* Traps Tab within the action stack + FAB while open (so keyboard focus
          can't wander into whatever's behind the scrim) and returns focus to
          the FAB on close — same primitive Sheet.jsx uses, in place of two
          separate hand-rolled implementations. Escape stays handled by our
          own listener above, which needs to fire regardless of where focus
          currently is. `allowOutsideClick: true` is required too: by default
          focus-trap preventDefault+stops propagation on any click outside the
          trapped element, which silently ate the scrim's own onClick above
          before it ever fired — same bug (and fix) as Sheet.jsx.
          `fallbackFocus` guards the same crash Sheet.jsx documents: with no
          fallback, activating the trap on a FabMenu with zero actions (only
          the FAB itself, which the trap sees as not yet tabbable at the
          instant it activates) throws and takes down the whole app, since
          there's no error boundary. */}
      <FocusTrap active={open} focusTrapOptions={{ escapeDeactivates: false, clickOutsideDeactivates: false, allowOutsideClick: true, fallbackFocus: () => wrapperRef.current }}>
        <div ref={wrapperRef} tabIndex={-1}>
          {/* Action stack — above the FAB, right-aligned, nearest action lowest. */}
          <div
            role="menu"
            aria-hidden={!open}
            style={{
              position: 'fixed',
              right: FAB_RIGHT,
              bottom: `calc(${FAB_BOTTOM} + 68px)`,
              display: 'flex',
              flexDirection: 'column-reverse',
              alignItems: 'flex-end',
              gap: 12,
              zIndex: 12,
              pointerEvents: open ? 'auto' : 'none',
            }}
          >
            {actions.map((action, i) => (
              <FabMenuItem
                key={action.label || i}
                action={action}
                open={open}
                // Nearest-the-FAB item (index 0) leads on open; no delay on close.
                delay={open ? i * 40 : 0}
                onRun={() => runAction(action)}
              />
            ))}
          </div>

          <Fab
            icon={icon}
            active={open}
            label={open ? 'Lukk meny' : label}
            onClick={toggle}
          />
        </div>
      </FocusTrap>
    </>
  );
}

function FabMenuItem({ action, open, delay, onRun }) {
  const [press, setPress] = React.useState(false);
  const { ripples, spawn } = useRipple();

  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={open ? 0 : -1}
      onClick={onRun}
      onPointerDown={(e) => { setPress(true); spawn(e); }}
      onPointerUp={() => setPress(false)}
      onPointerLeave={() => setPress(false)}
      onPointerCancel={() => setPress(false)}
      style={{
        position: 'relative',
        overflow: 'hidden',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        height: 48,
        padding: '0 20px',
        border: 'none',
        borderRadius: 'var(--radius-pill)',
        background: 'var(--md-surface-container)',
        color: 'var(--text-primary)',
        boxShadow: 'var(--elevation-shadow-3)',
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--md-label-large-size)',
        fontWeight: 600,
        letterSpacing: 'var(--md-label-large-tracking)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        opacity: open ? 1 : 0,
        transform: `${open ? 'translateY(0)' : 'translateY(10px)'} scale(${press ? 'var(--press-scale)' : '1'})`,
        transition:
          'opacity var(--duration-base) var(--ease-out), transform var(--spring-duration) var(--ease-spring)',
        transitionDelay: `${delay}ms`,
      }}
    >
      <span aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', overflow: 'hidden' }}>
        <Ripples ripples={ripples} tint="rgba(43,38,33,0.14)" />
      </span>
      <i className={`ph ph-${action.icon}`} style={{ position: 'relative', fontSize: 20, color: 'var(--accent-primary)' }} />
      <span style={{ position: 'relative' }}>{action.label}</span>
      {action.badge != null && action.badge !== false ? (
        <span
          style={{
            position: 'relative',
            minWidth: 20,
            height: 20,
            padding: '0 6px',
            borderRadius: 'var(--radius-pill)',
            background: 'var(--accent-primary)',
            color: 'var(--text-on-accent)',
            fontSize: 11,
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
          }}
        >
          {action.badge}
        </span>
      ) : null}
    </button>
  );
}
