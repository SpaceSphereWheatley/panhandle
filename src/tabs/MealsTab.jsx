import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, animate } from "framer-motion";
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
// Every navigable week (WEEK_MIN..WEEK_MAX is a small, fixed range — 6 weeks
// total), not just the current one. All 6 panes are always mounted side by
// side in a single wide row; swiping/paging just translates that row, so the
// neighbouring week's real cards are already there to slide into view the
// moment a drag starts, instead of only appearing once the drag commits.
const WEEK_OFFSETS = [];
for (let o = WEEK_MIN; o <= WEEK_MAX; o++) WEEK_OFFSETS.push(o);

function mondayForOffset(offset) {
  const m = mondayOf(new Date());
  m.setDate(m.getDate() + offset * 7);
  return m;
}

function weekDays(monday) {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

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

// One week's worth of day cards, sized to a fixed pane width so it can sit
// inside the horizontally-scrolling row in MealsTab below. Only the active
// (currently selected) week's cards are tappable — the ones peeking in from
// either side during a drag are a preview, not live controls, until you
// actually swipe to them.
function WeekPane({ monday, byDate, isActive, today, schedule, nameFor, shouldAnimate, transition, active, suppressClickRef, onOpenDay, stackStyle, paneWidth }) {
  const days = weekDays(monday);
  return (
    <div style={{ ...stackStyle, width: paneWidth, flexShrink: 0 }}>
      {!byDate
        ? Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} height={i === 0 ? 88 : 56} radius={16} />
          ))
        : days.map((d) => {
            const iso = localIso(d);
            const p = byDate[iso];
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
                interactive={isActive}
                onClick={
                  isActive
                    ? () => {
                        // A released swipe can leave the pointer sitting on top of
                        // whatever card is now underneath it, which fires this as a
                        // genuine click — see dragActiveRef/suppressClickRef in
                        // MealsTab below.
                        if (suppressClickRef.current) return;
                        onOpenDay(iso);
                      }
                    : undefined
                }
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
  // offset -> { [iso]: planRow }, populated lazily. Only the current week and
  // its immediate neighbours are kept fetched (see the prefetch effect below)
  // so a swipe already has real content to reveal instead of the blank gap
  // you'd get by fetching only once the drag commits.
  const [planCache, setPlanCache] = useState(() => {
    const cached = cachedCurrentWeekPlan();
    return cached ? { 0: cached } : {};
  });
  const planCacheRef = useRef(planCache);
  planCacheRef.current = planCache;
  // Only true for a genuine cold load with no matching cached week yet —
  // once hydrated from PLAN_CACHE_KEY, subsequent fetches are silent
  // background refreshes rather than a loading state.
  const [loading, setLoading] = useState(() => cachedCurrentWeekPlan() === null);
  // Single active modal for the whole tab, mirroring the vanilla app's one
  // #modalRoot swapping content: { type: "plan"|"browse"|"edit"|"ingredients", ... } | null
  const [modal, setModal] = useState(null);

  async function loadPlan(offset) {
    const m = mondayForOffset(offset);
    const sunday = new Date(m);
    sunday.setDate(sunday.getDate() + 6);
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
    setPlanCache((c) => ({ ...c, [offset]: byDate }));
    if (offset === 0) writeCache(PLAN_CACHE_KEY, { monday: localIso(m), plan: byDate });
  }

  // Optimistic, matching the shopping-list toggle pattern: update local
  // state immediately, then reconcile/roll back based on the network result
  // instead of blocking the modal open on a full round trip. Always the
  // currently-selected week, since only its cards are ever tappable (see
  // WeekPane's `isActive` gate) — a modal can only have been opened from there.
  async function savePlanDay(planIso, { meal_name, responsible, ingredients }) {
    const offset = weekOffset;
    const prevEntry = planCache[offset]?.[planIso];
    setPlanCache((c) => ({
      ...c,
      [offset]: { ...(c[offset] || {}), [planIso]: { ...(prevEntry || {}), plan_date: planIso, meal_name, responsible } },
    }));
    try {
      await api("/plan", {
        method: "POST",
        body: JSON.stringify({ plan_date: planIso, meal_name, responsible, ingredients }),
      });
      loadPlan(offset);
    } catch {
      setPlanCache((c) => ({ ...c, [offset]: { ...(c[offset] || {}), [planIso]: prevEntry } }));
      toast("Kunne ikke lagre måltidet – sjekk nettforbindelsen", { error: true });
    }
  }

  async function deletePlanDay(planIso) {
    const offset = weekOffset;
    const prevEntry = planCache[offset]?.[planIso];
    setPlanCache((c) => {
      const dayMap = { ...(c[offset] || {}) };
      delete dayMap[planIso];
      return { ...c, [offset]: dayMap };
    });
    try {
      await api(`/plan/${planIso}`, { method: "DELETE" });
      loadPlan(offset);
    } catch {
      setPlanCache((c) => ({ ...c, [offset]: { ...(c[offset] || {}), [planIso]: prevEntry } }));
      toast("Kunne ikke fjerne måltidet – sjekk nettforbindelsen", { error: true });
    }
  }

  // Loads once on mount regardless of `active` — both tabs are now mounted
  // together at app open (see AppShell.jsx's `visited` seed), so Måltider's
  // data is ready by the time the user switches to it instead of only
  // starting the fetch at that point. Reactivation (switching back to an
  // already-loaded tab) still triggers its own refresh + polling below.
  // Only ever fetches/polls the *current* offset — neighbouring weeks are
  // handled by the prefetch effect further down.
  const hasLoadedRef = useRef(false);
  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      ensureLoaded();
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

  // Keeps the current week and both its neighbours fetched, so whichever
  // direction you swipe next already has real content instead of a skeleton.
  // Runs on mount too (prefetching -1/+1 around the starting week), and again
  // every time weekOffset actually changes — you can only ever reach a week
  // by stepping through its neighbours (± the buttons/swipe) or jumping to 0
  // (always loaded from mount), so this alone keeps every reachable week
  // covered without ever fetching the whole WEEK_MIN..WEEK_MAX range at once.
  useEffect(() => {
    [weekOffset - 1, weekOffset, weekOffset + 1].forEach((o) => {
      if (o < WEEK_MIN || o > WEEK_MAX) return;
      if (planCacheRef.current[o] === undefined) loadPlan(o);
    });
  }, [weekOffset]);

  // Measures the pane viewport so the row (WEEK_OFFSETS.length panes wide)
  // and the drag math below can work in real pixels rather than percentages
  // — simpler to combine with the live pointer offset (also in pixels).
  const containerRef = useRef(null);
  const [paneWidth, setPaneWidth] = useState(0);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setPaneWidth(el.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The row's total x offset, in pixels. Its "resting" position for a given
  // weekOffset is `-((weekOffset - WEEK_MIN) * paneWidth)`; the settle effect
  // below animates it there whenever weekOffset (or paneWidth, e.g. on
  // rotation) changes, and onPan/onPanEnd drive it directly during a gesture.
  const x = useMotionValue(0);
  const settleControlsRef = useRef(null);
  const transitionRef = useRef(transition);
  transitionRef.current = transition;

  useEffect(() => {
    if (!paneWidth) return;
    const target = -((weekOffset - WEEK_MIN) * paneWidth);
    settleControlsRef.current = animate(x, target, transitionRef.current);
    return () => settleControlsRef.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset, paneWidth]);

  // Distinguishes a genuine swipe from a tap-with-negligible-movement on the
  // draggable week row: without this, releasing a drag on top of a day card
  // fires that card's native onClick (Framer's gesture handling doesn't
  // suppress it), popping open that day's edit modal. Set in onPan (not
  // onPanEnd) since the browser's native click fires before Framer gets
  // around to calling onPanEnd — see the comment there.
  const dragActiveRef = useRef(false);
  const suppressClickRef = useRef(false);
  const dragStartXRef = useRef(0);

  function onPanStart() {
    settleControlsRef.current?.stop();
    dragActiveRef.current = false;
    dragStartXRef.current = x.get();
  }

  function onPan(_event, info) {
    if (!paneWidth) return;
    if (Math.abs(info.offset.x) > 5) {
      dragActiveRef.current = true;
      suppressClickRef.current = true;
    }
    const raw = dragStartXRef.current + info.offset.x;
    const min = -((WEEK_OFFSETS.length - 1) * paneWidth);
    const max = 0;
    // A little resistance past the first/last week instead of a hard stop.
    const clamped = raw > max ? max + (raw - max) * 0.3 : raw < min ? min + (raw - min) * 0.3 : raw;
    x.set(clamped);
  }

  // The browser's native `click` on whatever's under the pointer at release
  // fires before Framer gets to call this — so setting suppressClickRef here
  // would always be too late; it's set in onPan above instead, the moment
  // the drag is unambiguously real.
  function onPanEnd(_event, info) {
    if (dragActiveRef.current) {
      // Cleared a tick later so the click that follows this release (if
      // any) still sees it as suppressed.
      setTimeout(() => { suppressClickRef.current = false; }, 0);
    }
    const DISTANCE = 60;
    const VELOCITY = 500;
    let next = weekOffset;
    if ((info.offset.x < -DISTANCE || info.velocity.x < -VELOCITY) && weekOffset < WEEK_MAX) {
      next = weekOffset + 1;
    } else if ((info.offset.x > DISTANCE || info.velocity.x > VELOCITY) && weekOffset > WEEK_MIN) {
      next = weekOffset - 1;
    }
    if (next !== weekOffset) {
      setWeekOffset(next);
    } else if (paneWidth) {
      // No commit — animate back to the current week's resting position.
      settleControlsRef.current = animate(x, -((weekOffset - WEEK_MIN) * paneWidth), transitionRef.current);
    }
  }

  function shiftWeek(delta) {
    const next = delta === 0 ? 0 : Math.max(WEEK_MIN, Math.min(WEEK_MAX, weekOffset + delta));
    if (next === weekOffset) return;
    setWeekOffset(next);
  }

  // The week the header should reflect right now — driven by weekOffset
  // (updates the instant a swipe/button commits), not by whether that
  // week's plan has actually finished loading.
  const targetMonday = mondayForOffset(weekOffset);
  const targetSunday = new Date(targetMonday);
  targetSunday.setDate(targetSunday.getDate() + 6);
  const today = localIso(new Date());

  // "Cook again" (U26): one-tap re-plan of a catalogue meal onto the next
  // unplanned day of the *currently visible* week, rather than a day picker —
  // keeps the affordance to a single tap and the placement predictable (you
  // can see the week you're planning into).
  async function planAgain(meal) {
    const byDate = planCache[weekOffset] || {};
    const activeDays = weekDays(targetMonday);
    const targetIso = activeDays.map(localIso).find((iso) => !byDate[iso]?.meal_name);
    if (!targetIso) {
      toast("Alle dagene denne uken er allerede planlagt");
      return;
    }
    const dow = (new Date(targetIso).getDay() + 6) % 7;
    const responsible = byDate[targetIso]?.responsible || schedule[dow] || "";
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
          {targetMonday.toLocaleDateString("no-NO", { day: "numeric", month: "short" })} – {" "}
          {targetSunday.toLocaleDateString("no-NO", { day: "numeric", month: "short" })}
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

      {/* containerRef is always mounted (even while `loading`/before paneWidth
          is measured) so ResizeObserver above can report a real width as soon
          as possible instead of only once the row itself first renders. */}
      <div ref={containerRef} style={{ position: "relative", overflow: "hidden" }}>
        {loading || !paneWidth ? (
          <MealsSkeleton stackStyle={stackStyle} />
        ) : (
          <motion.div
            style={{ display: "flex", width: paneWidth * WEEK_OFFSETS.length, x, touchAction: "pan-y" }}
            onPanStart={onPanStart}
            onPan={onPan}
            onPanEnd={onPanEnd}
          >
            {WEEK_OFFSETS.map((offset) => (
              <WeekPane
                key={offset}
                monday={mondayForOffset(offset)}
                byDate={planCache[offset]}
                isActive={offset === weekOffset}
                today={today}
                schedule={schedule}
                nameFor={nameFor}
                shouldAnimate={shouldAnimate}
                transition={transition}
                active={active}
                suppressClickRef={suppressClickRef}
                onOpenDay={(iso) => setModal({ type: "plan", iso })}
                stackStyle={stackStyle}
                paneWidth={paneWidth}
              />
            ))}
          </motion.div>
        )}
      </div>

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
            loadPlan(weekOffset);
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
