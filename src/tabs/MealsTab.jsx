import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../lib/api.js";
import { useToast } from "../context/ToastContext.jsx";
import { useRecurring } from "../context/RecurringContext.jsx";
import { useListUsers } from "../context/ListUsersContext.jsx";
import { localIso, mondayOf, parseIngredients, WEEK_MIN, WEEK_MAX } from "../lib/mealUtils.js";
import { haptic } from "../lib/shoppingUtils.js";
import { avatarColorFor } from "../lib/avatarColor.js";
import { useDesignIntensity } from "../hooks/useDesignIntensity.js";
import { useMotionConfig } from "../hooks/useMotionConfig.js";
import { MealPlanModal } from "../components/meals/MealPlanModal.jsx";
import { MealCatalogueBrowseModal } from "../components/meals/MealCatalogueBrowseModal.jsx";
import { MealEditModal } from "../components/meals/MealEditModal.jsx";
import { IngredientPickerModal } from "../components/meals/IngredientPickerModal.jsx";
import { Card, Avatar, Tag, FabMenu, Skeleton } from "../design-system/index.js";
import { readCache, writeCache } from "../lib/localCache.js";

const POLL_MS = 7000;
const MotionCard = motion(Card);
// Last-fetched current week's plan, hydrated on mount so a returning user
// sees real days instead of a skeleton/spinner (or worse, days that briefly
// render as "unplanned" before the fetch resolves) on every cold open.
// Keyed by that week's Monday so a stale cache from a previous week is never
// mistaken for the current one — see loadPlan()/CLAUDE.md's loading-UI notes.
const PLAN_CACHE_KEY = "ph_cache_plan_v1";

function cachedCurrentWeekPlan() {
  const cached = readCache(PLAN_CACHE_KEY, null);
  const currentMonday = localIso(mondayOf(new Date()));
  return cached && cached.monday === currentMonday ? cached.plan : null;
}

// Cold-load placeholder shaped like a week of day cards, so first paint
// reserves the real layout instead of a spinner (and never reads as "every
// day is unplanned", which a blank/empty plan would).
function MealsSkeleton({ stackStyle }) {
  return (
    <div style={stackStyle}>
      {Array.from({ length: 7 }).map((_, i) => (
        <Skeleton key={i} height={i === 0 ? 88 : 56} radius={16} />
      ))}
    </div>
  );
}

export function MealsTab({ onSyncTick, onOffline, active }) {
  const toast = useToast();
  const { schedule, ensureLoaded } = useRecurring();
  const { nameFor } = useListUsers();
  const intensity = useDesignIntensity();
  const { shouldAnimate, transition } = useMotionConfig();
  const [weekOffset, setWeekOffset] = useState(0);
  const weekOffsetRef = useRef(weekOffset);
  weekOffsetRef.current = weekOffset;
  const [plan, setPlan] = useState(() => cachedCurrentWeekPlan() || {}); // iso -> plan row
  // Only true for a genuine cold load with no matching cached week yet —
  // once hydrated from PLAN_CACHE_KEY, subsequent fetches are silent
  // background refreshes rather than a loading state.
  const [loading, setLoading] = useState(() => cachedCurrentWeekPlan() === null);
  const [monday, setMonday] = useState(() => mondayOf(new Date()));
  // Single active modal for the whole tab, mirroring the vanilla app's one
  // #modalRoot swapping content: { type: "plan"|"browse"|"edit"|"ingredients", ... } | null
  const [modal, setModal] = useState(null);

  async function loadPlan(offset = weekOffset) {
    const m = mondayOf(new Date());
    m.setDate(m.getDate() + offset * 7);
    const sunday = new Date(m);
    sunday.setDate(sunday.getDate() + 6);
    setMonday(m);
    let rows;
    try {
      rows = await api(`/plan?from=${localIso(m)}&to=${localIso(sunday)}`);
      onSyncTick();
    } catch {
      onOffline();
      return;
    }
    const byDate = {};
    for (const p of rows) byDate[p.plan_date] = p;
    setPlan(byDate);
    if (offset === 0) writeCache(PLAN_CACHE_KEY, { monday: localIso(m), plan: byDate });
  }

  // Optimistic, matching the shopping-list toggle pattern: update local
  // state immediately, then reconcile/roll back based on the network result
  // instead of blocking the modal open on a full round trip.
  async function savePlanDay(planIso, { meal_name, responsible, ingredients }) {
    const prevEntry = plan[planIso];
    setPlan((p) => ({ ...p, [planIso]: { ...(prevEntry || {}), plan_date: planIso, meal_name, responsible } }));
    try {
      await api("/plan", {
        method: "POST",
        body: JSON.stringify({ plan_date: planIso, meal_name, responsible, ingredients }),
      });
      loadPlan();
    } catch {
      setPlan((p) => ({ ...p, [planIso]: prevEntry }));
      toast("Kunne ikke lagre måltidet – sjekk nettforbindelsen", { error: true });
    }
  }

  async function deletePlanDay(planIso) {
    const prevEntry = plan[planIso];
    setPlan((p) => {
      const next = { ...p };
      delete next[planIso];
      return next;
    });
    try {
      await api(`/plan/${planIso}`, { method: "DELETE" });
      loadPlan();
    } catch {
      setPlan((p) => ({ ...p, [planIso]: prevEntry }));
      toast("Kunne ikke fjerne måltidet – sjekk nettforbindelsen", { error: true });
    }
  }

  // Loads once on mount regardless of `active` — both tabs are now mounted
  // together at app open (see AppShell.jsx's `visited` seed), so Måltider's
  // data is ready by the time the user switches to it instead of only
  // starting the fetch at that point. Reactivation (switching back to an
  // already-loaded tab) still triggers its own refresh + polling below.
  const hasLoadedRef = useRef(false);
  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      ensureLoaded();
      // Reload whatever week was last open, not the current week — the tab
      // stays mounted (hidden via CSS) across pane switches now, see
      // AppShell.jsx, so weekOffset persists and shouldn't reset on reactivation.
      loadPlan(weekOffsetRef.current).finally(() => setLoading(false));
    } else if (active) {
      loadPlan(weekOffsetRef.current);
    }
    if (!active) return;
    const timer = setInterval(() => {
      if (!document.hidden) loadPlan(weekOffsetRef.current);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [active]);

  function shiftWeek(delta) {
    const next = delta === 0 ? 0 : Math.max(WEEK_MIN, Math.min(WEEK_MAX, weekOffset + delta));
    setWeekOffset(next);
    loadPlan(next);
  }

  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const today = localIso(new Date());
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    days.push(d);
  }

  // "Cook again" (U26): one-tap re-plan of a catalogue meal onto the next
  // unplanned day of the *currently visible* week, rather than a day picker —
  // keeps the affordance to a single tap and the placement predictable (you
  // can see the week you're planning into).
  async function planAgain(meal) {
    const targetIso = days.map(localIso).find((iso) => !plan[iso]?.meal_name);
    if (!targetIso) {
      toast("Alle dagene denne uken er allerede planlagt");
      return;
    }
    const dow = (new Date(targetIso).getDay() + 6) % 7;
    const responsible = plan[targetIso]?.responsible || schedule[dow] || "";
    const dayLabel = new Date(targetIso).toLocaleDateString("no-NO", { weekday: "long", day: "numeric", month: "short" });
    setModal(null);
    await savePlanDay(targetIso, { meal_name: meal.name, responsible, ingredients: parseIngredients(meal.ingredients) });
    toast(`«${meal.name}» planlagt til ${dayLabel}`, { undoFn: () => deletePlanDay(targetIso) });
  }

  // Classic intensity is a plain linear list; expressive/muted use an
  // adaptive grid (same repeat(auto-fit, minmax(...)) mechanism as
  // Handleliste's clusters, for consistency) so "I dag" can stand apart.
  const stackStyle =
    intensity === "classic"
      ? { display: "flex", flexDirection: "column", gap: 6 }
      : { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 };

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 14 }}>
        <button disabled={weekOffset <= WEEK_MIN} style={{ ...weekNavBtnStyle, opacity: weekOffset <= WEEK_MIN ? 0.4 : 1 }} onClick={() => shiftWeek(-1)}>‹ Forrige</button>
        <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-tertiary)", textAlign: "center", flex: 1 }}>
          {monday.toLocaleDateString("no-NO", { day: "numeric", month: "short" })} – {" "}
          {sunday.toLocaleDateString("no-NO", { day: "numeric", month: "short" })}
        </span>
        <button style={weekNavBtnStyle} onClick={() => shiftWeek(0)}>Denne uken</button>
        <button disabled={weekOffset >= WEEK_MAX} style={{ ...weekNavBtnStyle, opacity: weekOffset >= WEEK_MAX ? 0.4 : 1 }} onClick={() => shiftWeek(1)}>Neste ›</button>
      </div>
      <div style={{ marginBottom: 10 }}>
        <button
          onClick={() => setModal({ type: "browse" })}
          style={{ background: "none", border: "none", color: "var(--accent-primary)", fontSize: "var(--text-sm)", fontWeight: 600, fontFamily: "var(--font-sans)", cursor: "pointer", padding: 0 }}
        >
          Alle måltider ›
        </button>
      </div>

      {loading ? (
        <MealsSkeleton stackStyle={stackStyle} />
      ) : (
      <div style={stackStyle}>
        {days.map((d) => {
          const iso = localIso(d);
          const p = plan[iso];
          const isToday = iso === today;
          const dayName = d.toLocaleDateString("no-NO", { weekday: "long", day: "numeric", month: "short" });
          const dow = (d.getDay() + 6) % 7;
          const recurring = !p?.responsible ? schedule[dow] : null;
          const CardComponent = shouldAnimate ? MotionCard : Card;
          // `layout` gated on `active`, not just `shouldAnimate`: this tab stays
          // mounted (hidden via `display: none`) when switched away from (see
          // AppShell.jsx), and a display:none subtree measures as a zero-size
          // box at (0,0) — if Framer kept tracking layout through that, it'd
          // see a jump from (0,0) to the real position on reactivation and
          // animate it, i.e. cards visibly flying in from the top-left on
          // every tab switch. Layout tracking only turns on once visible, so
          // its first measurement is the real position with nothing to
          // interpolate from.
          const motionProps = shouldAnimate ? { layout: active, transition } : {};
          return (
            <CardComponent
              key={iso}
              {...motionProps}
              interactive
              onClick={() => setModal({ type: "plan", iso })}
              aria-label={`${p?.meal_name ? "Endre" : "Legg til"} måltid, ${dayName}`}
              // Non-today cards are more compact (smaller padding, tighter
              // title margin below) so the whole week takes up less vertical
              // space — today's card keeps the full-size prominent treatment.
              padding={isToday ? "md" : "sm"}
              style={
                isToday
                  ? {
                      background: "var(--md-inverse-surface)",
                      color: "var(--md-inverse-on-surface)",
                      borderRadius: "var(--radius-card)",
                      boxShadow: "var(--elevation-shadow-3)",
                    }
                  : p?.meal_name
                    ? { borderRadius: "var(--radius-md)" }
                    // Unplanned, non-today: an empty slot, not a card with muted
                    // text in it — drop the fill for a dashed outline instead of
                    // reusing the same solid surface every other day gets.
                    : {
                        borderRadius: "var(--radius-md)",
                        background: "transparent",
                        boxShadow: "none",
                        border: "1.5px dashed var(--border-default)",
                      }
              }
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "var(--text-2xs)",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "var(--tracking-wide)",
                      color: isToday ? "color-mix(in oklch, var(--md-inverse-on-surface) 70%, transparent)" : "var(--text-tertiary)",
                    }}
                  >
                    {isToday ? "I dag" : dayName}
                  </div>
                  {p?.meal_name ? (
                    <div
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: isToday ? "var(--md-headline-emphasized-size)" : "var(--md-title-large-size)",
                        lineHeight: isToday ? "var(--md-headline-emphasized-line)" : "var(--md-title-large-line)",
                        fontWeight: isToday ? "var(--weight-display-max)" : "var(--md-title-emphasized-weight)",
                        color: isToday ? "var(--md-inverse-on-surface)" : "var(--text-primary)",
                        margin: isToday ? "4px 0" : "2px 0",
                      }}
                    >
                      {p.meal_name}
                    </div>
                  ) : (
                    // Unplanned: an active invite ("Legg til måltid" + a plus
                    // chip), not a passive statement in muted italic — italic
                    // reads as disabled, not tappable, and this card is now a
                    // tap target in its own right (see `interactive` above).
                    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: isToday ? "4px 0" : "2px 0" }}>
                      <span
                        style={{
                          width: isToday ? 26 : 22,
                          height: isToday ? 26 : 22,
                          borderRadius: "50%",
                          background: isToday ? "color-mix(in oklch, var(--md-inverse-on-surface) 18%, transparent)" : "var(--accent-primary-subtle)",
                          color: isToday ? "var(--md-inverse-on-surface)" : "var(--accent-primary-press)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <i className="ph ph-plus" style={{ fontSize: isToday ? 14 : 12 }} aria-hidden="true" />
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: isToday ? "var(--md-headline-emphasized-size)" : "var(--md-title-large-size)",
                          lineHeight: isToday ? "var(--md-headline-emphasized-line)" : "var(--md-title-large-line)",
                          fontWeight: isToday ? "var(--weight-display-max)" : "var(--md-title-emphasized-weight)",
                          color: isToday ? "var(--md-inverse-on-surface)" : "var(--accent-primary)",
                        }}
                      >
                        Legg til måltid
                      </span>
                    </div>
                  )}
                  {p?.responsible ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                      <Avatar
                        name={nameFor(p.responsible)}
                        color={isToday ? "var(--md-inverse-primary)" : avatarColorFor(p.responsible)}
                        size={isToday ? 40 : 32}
                      />
                      <span
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: "var(--text-xs)",
                          fontWeight: 600,
                          color: isToday ? "var(--md-inverse-on-surface)" : "var(--text-secondary)",
                        }}
                      >
                        {nameFor(p.responsible)}
                      </span>
                    </div>
                  ) : recurring ? (
                    <div style={{ marginTop: 6 }}>
                      <Tag tone="primary">
                        <i className="ph ph-repeat" style={{ marginRight: 4 }} aria-hidden="true" />
                        Fast: {nameFor(recurring)}
                      </Tag>
                    </div>
                  ) : null}
                </div>
                {/* The card itself is the tap target now (see `interactive`
                    above) — this is a quiet label, not a second control, so
                    it can't nest inside the card's own button semantics. */}
                <span
                  style={{
                    position: "relative",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    fontFamily: "var(--font-sans)",
                    fontSize: "var(--text-xs)",
                    fontWeight: 600,
                    color: isToday ? "color-mix(in oklch, var(--md-inverse-on-surface) 80%, transparent)" : "var(--text-tertiary)",
                  }}
                >
                  {/* Only "Endre" needs the word — an unplanned day's card
                      already says "Legg til måltid" front and centre, so
                      repeating it here would be redundant, just the chevron. */}
                  {p?.meal_name ? "Endre" : null}
                  <i className="ph ph-caret-right" style={{ fontSize: "0.95em" }} aria-hidden="true" />
                </span>
              </div>
            </CardComponent>
          );
        })}
      </div>
      )}

      <FabMenu
        label="Måltider"
        haptic={haptic}
        actions={[
          { icon: "plus", label: "Nytt måltid", onClick: () => setModal({ type: "edit", id: null }) },
          { icon: "pencil-simple", label: "Rediger måltider", onClick: () => setModal({ type: "browse" }) },
        ]}
      />

      {modal?.type === "plan" && (
        <MealPlanModal
          iso={modal.iso}
          onClose={() => setModal(null)}
          onSavePlan={savePlanDay}
          onDeletePlanDay={deletePlanDay}
          onOpenIngredientPicker={(ingredients, iso) => setModal({ type: "ingredients", ingredients, iso })}
        />
      )}
      {modal?.type === "browse" && (
        <MealCatalogueBrowseModal
          onClose={() => setModal(null)}
          onOpenEdit={(id) => setModal({ type: "edit", id })}
          onPlanAgain={planAgain}
        />
      )}
      {modal?.type === "edit" && (
        <MealEditModal
          id={modal.id}
          onClose={() => setModal(null)}
          onSaved={() => setModal({ type: "browse" })}
        />
      )}
      {modal?.type === "ingredients" && (
        <IngredientPickerModal
          ingredients={modal.ingredients}
          onClose={() => {
            setModal(null);
            loadPlan();
          }}
        />
      )}
    </section>
  );
}

const weekNavBtnStyle = {
  background: "var(--surface-sunken)",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--radius-sm)",
  padding: "8px 12px",
  fontSize: "var(--text-xs)",
  fontFamily: "var(--font-sans)",
  color: "var(--text-primary)",
  cursor: "pointer",
};
