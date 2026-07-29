import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, animate } from "framer-motion";
import { api } from "../lib/api.js";
import { useToast } from "../context/ToastContext.jsx";
import { useRecurring } from "../context/RecurringContext.jsx";
import { useListUsers } from "../context/ListUsersContext.jsx";
import { localIso, mondayOf, parseIngredients, dayOfWeekMonFirst, WEEK_MIN, WEEK_MAX } from "../lib/mealUtils.js";
import { haptic } from "../lib/shoppingUtils.js";
import { useLanguage, useTranslation } from "../context/LanguageContext.jsx";
import { dateLocale } from "../lib/i18n/dateLocale.js";
import { useIsDesktop } from "../hooks/useIsDesktop.js";
import { useMotionConfig } from "../hooks/useMotionConfig.js";
import { MealPlanModal } from "../components/meals/MealPlanModal.jsx";
import { MealCatalogueBrowseModal } from "../components/meals/MealCatalogueBrowseModal.jsx";
import { MealEditModal } from "../components/meals/MealEditModal.jsx";
import { IngredientPickerModal } from "../components/meals/IngredientPickerModal.jsx";
import { Card, Avatar, FabMenu, Skeleton } from "../design-system/index.js";
import { UiIcon } from "../components/UiIcon.jsx";
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

// Cold-load placeholder shaped like a week of agenda rows, so first paint
// reserves the real layout instead of a spinner (and never reads as "every
// day is unplanned", which a blank/empty plan would). Uniform row height —
// unlike the old hero-card layout, no day is taller than the rest now.
function MealsSkeleton({ density }) {
  return (
    <div style={agendaListStyle(density)}>
      {Array.from({ length: 7 }).map((_, i) => (
        <Skeleton key={i} height={density === "comfortable" ? 64 : 48} radius={16} />
      ))}
    </div>
  );
}

// Shared by MealsSkeleton and WeekPane's own loading branch, and by the real
// row list — capped narrower than the tab's own content column (960px on
// desktop) so rows stay readable single lines instead of stretching one
// thin line across the wide column; centered so the cap doesn't just leave
// dead space on the right. A no-op on phones, whose viewport is already
// narrower than the cap.
function agendaListStyle(density) {
  return {
    maxWidth: 520,
    margin: "0 auto",
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: density === "comfortable" ? 8 : 6,
  };
}

// Who's responsible always renders in the same slot regardless of whether
// it's confirmed or just a recurring default — see WeekPane below. A
// confirmed day gets the person's normal colored Avatar; a day that only has
// a recurring default (nobody's confirmed it yet) gets the same shape/size,
// muted, with a small "usual" badge instead of a differently-placed text
// hint. `Avatar` has no style/border prop, so the muted state is hand-built
// rather than extending the shared component for this one Meals-specific case.
function ResponsibleAvatar({ name, nameFor, colorFor, size, muted, t }) {
  if (!muted) return <Avatar name={nameFor(name)} color={colorFor(name)} size={size} />;
  const initial = (nameFor(name) || name)[0]?.toUpperCase();
  // Badge scales with the avatar itself so it stays proportional across the
  // two call sites' very different sizes, instead of one fixed pixel size.
  const badgeSize = Math.round(size * 0.5);
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--surface-sunken)",
          color: "var(--text-tertiary)",
          border: "1.5px solid var(--accent-secondary)",
          fontFamily: "var(--font-sans)",
          fontWeight: 700,
          fontSize: size * 0.42,
        }}
      >
        {initial}
      </div>
      <span
        title={t("meals.recurringTag", { name: nameFor(name) })}
        style={{
          position: "absolute",
          right: -2,
          bottom: -2,
          width: badgeSize,
          height: badgeSize,
          borderRadius: "50%",
          background: "var(--accent-secondary)",
          border: "2px solid var(--surface-page)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <i className="ph ph-repeat" style={{ fontSize: badgeSize * 0.55, color: "var(--text-on-accent)" }} aria-hidden="true" />
      </span>
    </div>
  );
}

// One week's worth of agenda rows, sized to a fixed pane width so it can sit
// inside the horizontally-scrolling row in MealsTab below. Only the active
// (currently selected) week's rows are tappable — the ones peeking in from
// either side during a drag are a preview, not live controls, until you
// actually swipe to them.
function WeekPane({ monday, byDate, isActive, today, schedule, nameFor, colorFor, shouldAnimate, transition, active, suppressClickRef, onOpenDay, density, paneWidth }) {
  const t = useTranslation();
  const { lang } = useLanguage();
  const days = weekDays(monday);
  const cozy = density === "comfortable";
  // Horizontal padding, box-sizing:border-box so it insets the rows rather
  // than widening the pane itself — the row's drag math treats `paneWidth`
  // as an exact one-week pitch, so the pane's *outer* size can't change.
  // Without this, two adjacent weeks' rows touch with zero gap at the seam
  // while rows within a week keep their usual gap, which reads as one
  // merged row rather than two separate pages while peeking mid-swipe.
  // Half the intra-week gap on each side keeps the rhythm the same as
  // everywhere else instead of an arbitrary gutter width.
  const gutter = (cozy ? 8 : 6) / 2;
  return (
    <div style={{ width: paneWidth, flexShrink: 0, boxSizing: "border-box", padding: `0 ${gutter}px` }}>
      <div style={agendaListStyle(density)}>
        {!byDate
          ? Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} height={cozy ? 64 : 48} radius={16} />
            ))
          : days.map((d) => {
              const iso = localIso(d);
              const p = byDate[iso];
              const isToday = iso === today;
              const dayName = d.toLocaleDateString(dateLocale(lang), { weekday: "long", day: "numeric", month: "short" });
              const dayAbbr = d.toLocaleDateString(dateLocale(lang), { weekday: "short" }).replace(/\./g, "").slice(0, 3).toUpperCase();
              const dow = dayOfWeekMonFirst(d);
              // The responsible slot is filled the same way whether it's a
              // confirmed assignment or just a recurring default — see
              // ResponsibleAvatar above. Only truly nobody (neither) leaves
              // it empty.
              const recurring = !p?.responsible ? schedule[dow] : null;
              const responsible = p?.responsible || recurring || null;
              const muted = !p?.responsible;
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
              const basePadding = cozy ? "11px 14px" : "9px 10px";
              const rowStyle = isToday
                ? {
                    background: "var(--accent-primary-subtle)",
                    borderLeft: "3px solid var(--accent-primary)",
                    borderRadius: "var(--radius-md)",
                    padding: basePadding,
                    paddingLeft: cozy ? 12 : 8,
                  }
                : p?.meal_name
                  ? { background: "var(--surface-card)", borderRadius: "var(--radius-md)", padding: basePadding }
                  // Unplanned: an empty slot, not a row with muted text in it —
                  // drop the fill for a dashed outline instead of reusing the
                  // same solid surface every other day gets.
                  : {
                      background: "transparent",
                      boxShadow: "none",
                      border: "1.5px dashed var(--border-default)",
                      borderRadius: "var(--radius-md)",
                      padding: basePadding,
                    };
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
                  aria-label={t(p?.meal_name ? "meals.day.aria.edit" : "meals.day.aria.add", { day: dayName })}
                  padding="none"
                  style={rowStyle}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: cozy ? 12 : 10 }}>
                    <div style={{ width: cozy ? 40 : 34, flexShrink: 0, textAlign: "center" }}>
                      <div
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: cozy ? "10px" : "var(--text-2xs)",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "var(--tracking-wide)",
                          color: isToday ? "var(--accent-primary)" : "var(--text-tertiary)",
                        }}
                      >
                        {dayAbbr}
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: cozy ? "17px" : "15px",
                          fontWeight: 700,
                          color: isToday ? "var(--accent-primary)" : "var(--text-primary)",
                        }}
                      >
                        {d.getDate()}
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {p?.meal_name ? (
                        <div
                          style={{
                            fontFamily: "var(--font-sans)",
                            fontSize: cozy ? "15.5px" : "14.5px",
                            fontWeight: cozy ? 700 : 600,
                            color: "var(--text-primary)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {p.meal_name}
                        </div>
                      ) : (
                        // Unplanned: an active invite ("Legg til måltid" + a plus
                        // chip), not a passive statement in muted italic — italic
                        // reads as disabled, not tappable, and this row is now a
                        // tap target in its own right (see `interactive` above).
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: "50%",
                              background: "var(--surface-sunken)",
                              color: "var(--text-tertiary)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            <i className="ph ph-plus" style={{ fontSize: 10 }} aria-hidden="true" />
                          </span>
                          <span
                            style={{
                              fontFamily: "var(--font-sans)",
                              fontSize: cozy ? "15.5px" : "14.5px",
                              fontWeight: 600,
                              color: "var(--text-secondary)",
                            }}
                          >
                            {t("meals.addMeal")}
                          </span>
                        </div>
                      )}
                      {!cozy && isToday && (
                        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-2xs)", color: "var(--text-tertiary)", marginTop: 1 }}>
                          {t("meals.today")}
                        </div>
                      )}
                      {cozy && responsible && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                          <ResponsibleAvatar name={responsible} nameFor={nameFor} colorFor={colorFor} size={32} muted={muted} t={t} />
                          <span
                            style={{
                              fontFamily: "var(--font-sans)",
                              fontSize: "var(--text-xs)",
                              fontWeight: 600,
                              color: isToday ? "var(--accent-primary)" : "var(--text-secondary)",
                            }}
                          >
                            {muted ? t("meals.recurringTag", { name: nameFor(responsible) }) : nameFor(responsible)}
                          </span>
                        </div>
                      )}
                    </div>
                    {cozy && isToday && (
                      <span
                        style={{
                          flexShrink: 0,
                          fontFamily: "var(--font-sans)",
                          fontSize: "9px",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "var(--tracking-wide)",
                          color: "var(--text-on-accent)",
                          background: "var(--accent-primary)",
                          padding: "3px 7px",
                          borderRadius: "var(--radius-pill)",
                        }}
                      >
                        {t("meals.today")}
                      </span>
                    )}
                    {!cozy && responsible && <ResponsibleAvatar name={responsible} nameFor={nameFor} colorFor={colorFor} size={40} muted={muted} t={t} />}
                    <i className="ph ph-caret-right" style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)", flexShrink: 0 }} aria-hidden="true" />
                  </div>
                </CardComponent>
              );
            })}
      </div>
    </div>
  );
}

export function MealsTab({ onSyncTick, onOffline, active }) {
  const toast = useToast();
  const t = useTranslation();
  const { lang } = useLanguage();
  const { schedule, ensureLoaded } = useRecurring();
  const { nameFor, colorFor } = useListUsers();
  const isDesktop = useIsDesktop();
  const { shouldAnimate, transition } = useMotionConfig();
  // Kompakt (one line/day) vs Behagelig (adds a second line spelling out
  // who's responsible) — a per-device preference, same persistence pattern
  // as Handleliste's grid/list toggle (`ph_view`), just a different key.
  const [density, setDensityState] = useState(() =>
    localStorage.getItem("ph_meals_density") === "comfortable" ? "comfortable" : "compact"
  );
  function setDensity(next) {
    setDensityState(next);
    localStorage.setItem("ph_meals_density", next);
  }
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
      toast(t("meals.toast.saveFailed"), { error: true });
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
      toast(t("meals.toast.deleteFailed"), { error: true });
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
  // rotation) changes. Framer's own `drag="x"` gesture (passed this same
  // motion value via the row's `style`, below) is the sole writer of `x`
  // while a drag is in progress, and the settle effect is the sole writer
  // once it's not — never both at once. The previous hand-rolled
  // onPan/onPanEnd implementation instead wrote to `x` itself during the
  // drag *in addition to* this settle effect, racing it — see CHANGELOG
  // 1.32.0-1.32.2's repeated fixes for the same underlying bug class.
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
  // suppress it), popping open that day's edit modal. Set in onDrag (not
  // onDragEnd) since the browser's native click fires before Framer gets
  // around to calling onDragEnd — see the comment there.
  const dragActiveRef = useRef(false);
  const suppressClickRef = useRef(false);

  function onDragStart() {
    // Hand `x` over to Framer's drag gesture for the duration of the drag —
    // stop whatever settle animation might still be in flight (e.g. a
    // button-nav animation interrupted by an immediate swipe) so it isn't
    // also writing to `x` while the drag is.
    settleControlsRef.current?.stop();
    dragActiveRef.current = false;
  }

  function onDrag(_event, info) {
    if (Math.abs(info.offset.x) > 5) {
      dragActiveRef.current = true;
      suppressClickRef.current = true;
    }
  }

  // The browser's native `click` on whatever's under the pointer at release
  // fires before Framer gets to call this — so setting suppressClickRef here
  // would always be too late; it's set in onDrag above instead, the moment
  // the drag is unambiguously real.
  function onDragEnd(_event, info) {
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
      toast(t("meals.toast.weekFull"));
      return;
    }
    const dow = dayOfWeekMonFirst(targetIso);
    const responsible = byDate[targetIso]?.responsible || schedule[dow] || "";
    const dayLabel = new Date(targetIso).toLocaleDateString(dateLocale(lang), { weekday: "long", day: "numeric", month: "short" });
    setModal(null);
    await savePlanDay(targetIso, { meal_name: meal.name, responsible, ingredients: parseIngredients(meal.ingredients) });
    toast(t("meals.toast.planned", { name: meal.name, day: dayLabel }), { undoFn: () => deletePlanDay(targetIso) });
  }

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 14 }}>
        <button disabled={weekOffset <= WEEK_MIN} style={{ ...weekNavBtnStyle, opacity: weekOffset <= WEEK_MIN ? 0.4 : 1 }} onClick={() => shiftWeek(-1)}>‹ {t("meals.nav.prev")}</button>
        <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-tertiary)", textAlign: "center", flex: 1 }}>
          {targetMonday.toLocaleDateString(dateLocale(lang), { day: "numeric", month: "short" })} – {" "}
          {targetSunday.toLocaleDateString(dateLocale(lang), { day: "numeric", month: "short" })}
        </span>
        <button style={weekNavBtnStyle} onClick={() => shiftWeek(0)}>{t("meals.nav.thisWeek")}</button>
        <button disabled={weekOffset >= WEEK_MAX} style={{ ...weekNavBtnStyle, opacity: weekOffset >= WEEK_MAX ? 0.4 : 1 }} onClick={() => shiftWeek(1)}>{t("meals.nav.next")} ›</button>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
        <button
          onClick={() => setModal({ type: "browse" })}
          style={{ background: "none", border: "none", color: "var(--accent-primary)", fontSize: "var(--text-sm)", fontWeight: 600, fontFamily: "var(--font-sans)", cursor: "pointer", padding: 0 }}
        >
          {t("meals.allMeals")} ›
        </button>
        <button
          onClick={() => setDensity(density === "compact" ? "comfortable" : "compact")}
          aria-label={t(density === "compact" ? "meals.densityToggle.switchToComfortable" : "meals.densityToggle.switchToCompact")}
          title={t(density === "compact" ? "meals.densityToggle.switchToComfortable" : "meals.densityToggle.switchToCompact")}
          style={{
            position: "relative",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 4,
            background: "var(--surface-sunken)",
            border: "none",
            borderRadius: "var(--radius-pill)",
            padding: 3,
            margin: 0,
            font: "inherit",
            cursor: "pointer",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              zIndex: 0,
              top: 3,
              bottom: 3,
              left: 3,
              width: "calc(50% - 5px)",
              background: "var(--accent-primary)",
              borderRadius: "var(--radius-pill)",
              transform: density === "comfortable" ? "translateX(calc(100% + 4px))" : "translateX(0)",
              transition: "transform var(--spring-duration-soft) var(--ease-spring-soft)",
            }}
          />
          <span style={densityToggleIconStyle(density === "compact")}>
            <UiIcon name="rowsCompact" size={16} />
          </span>
          <span style={densityToggleIconStyle(density === "comfortable")}>
            <UiIcon name="rowsComfortable" size={16} />
          </span>
        </button>
      </div>

      {/* containerRef is always mounted (even while `loading`/before paneWidth
          is measured) so ResizeObserver above can report a real width as soon
          as possible instead of only once the row itself first renders. */}
      <div ref={containerRef} style={{ position: "relative", overflow: "hidden" }}>
        {loading || !paneWidth ? (
          <MealsSkeleton density={density} />
        ) : (
          /* Swipe-paging is a touch affordance; on desktop the prev / "this
             week" / next buttons above are the sole control. Turning drag off
             also makes the settle effect the only writer of `x`, which is
             exactly the invariant that effect's comment depends on. */
          <motion.div
            style={{ display: "flex", width: paneWidth * WEEK_OFFSETS.length, x, touchAction: "pan-y" }}
            drag={isDesktop ? false : "x"}
            {...(isDesktop ? {} : {
              dragConstraints: { left: -((WEEK_OFFSETS.length - 1) * paneWidth), right: 0 },
              dragElastic: 0.3,
              dragMomentum: false,
              onDragStart,
              onDrag,
              onDragEnd,
            })}
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
                colorFor={colorFor}
                shouldAnimate={shouldAnimate}
                transition={transition}
                active={active}
                suppressClickRef={suppressClickRef}
                onOpenDay={(iso) => setModal({ type: "plan", iso })}
                density={density}
                paneWidth={paneWidth}
              />
            ))}
          </motion.div>
        )}
      </div>

      <FabMenu
        label={t("meals.fab.label")}
        haptic={haptic}
        actions={[
          { icon: "plus", label: t("meals.fab.newMeal"), onClick: () => setModal({ type: "edit", id: null }) },
          { icon: "pencil-simple", label: t("meals.fab.editMeals"), onClick: () => setModal({ type: "browse" }) },
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

// Mirrors ShoppingListTab's viewToggleIconStyle: the two icons are inert
// labels riding on top of the single toggle button, not separate click
// targets — a press anywhere on the pill flips the density regardless of
// which icon it lands on.
function densityToggleIconStyle(active) {
  return {
    position: "relative",
    zIndex: 1,
    color: active ? "var(--text-on-accent)" : "var(--text-tertiary)",
    padding: "6px 10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "color 150ms var(--ease-out)",
  };
}
