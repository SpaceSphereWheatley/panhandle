import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../lib/api.js";
import { useRecurring } from "../context/RecurringContext.jsx";
import { localIso, mondayOf, WEEK_MIN, WEEK_MAX } from "../lib/mealUtils.js";
import { haptic } from "../lib/shoppingUtils.js";
import { useDesignIntensity } from "../hooks/useDesignIntensity.js";
import { useMotionConfig } from "../hooks/useMotionConfig.js";
import { MealPlanModal } from "../components/meals/MealPlanModal.jsx";
import { MealCatalogueBrowseModal } from "../components/meals/MealCatalogueBrowseModal.jsx";
import { MealEditModal } from "../components/meals/MealEditModal.jsx";
import { IngredientPickerModal } from "../components/meals/IngredientPickerModal.jsx";
import { Card, Avatar, Tag, Button, FabMenu } from "../design-system/index.js";

const POLL_MS = 7000;
const MotionCard = motion(Card);

// Deterministic-but-varied avatar color per person, since the real data
// model (unlike the design project's toy fake cooks) has no fixed
// per-person color assigned. Drawn from the shopping-list cluster "on"
// tones for more distinct, higher-contrast per-person colors than a small
// hand-picked palette gives.
const AVATAR_COLORS = [
  "var(--accent-primary)",
  "var(--cluster-meat-on)",
  "var(--cluster-drinks-on)",
  "var(--cluster-care-on)",
  "var(--cluster-snacks-on)",
  "var(--cluster-frozen-on)",
  "var(--cluster-bakery-on)",
  "var(--cluster-household-on)",
];
function avatarColorFor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function MealsTab({ onSyncTick, onOffline, active }) {
  const { schedule, ensureLoaded } = useRecurring();
  const intensity = useDesignIntensity();
  const { shouldAnimate, transition } = useMotionConfig();
  const [weekOffset, setWeekOffset] = useState(0);
  const weekOffsetRef = useRef(weekOffset);
  weekOffsetRef.current = weekOffset;
  const [plan, setPlan] = useState({}); // iso -> plan row
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
  }

  useEffect(() => {
    if (!active) return;
    ensureLoaded();
    // Reload whatever week was last open, not the current week — the tab
    // stays mounted (hidden via CSS) across pane switches now, see
    // AppShell.jsx, so weekOffset persists and shouldn't reset on reactivation.
    loadPlan(weekOffsetRef.current);
    const timer = setInterval(() => {
      if (!document.hidden) loadPlan(weekOffsetRef.current);
    }, POLL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Classic intensity is a plain linear list; expressive/muted use an
  // adaptive grid (same repeat(auto-fit, minmax(...)) mechanism as
  // Handleliste's clusters, for consistency) so "I dag" can stand apart.
  const stackStyle =
    intensity === "classic"
      ? { display: "flex", flexDirection: "column", gap: 8 }
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

      <div style={stackStyle}>
        {days.map((d) => {
          const iso = localIso(d);
          const p = plan[iso];
          const isToday = iso === today;
          const dayName = d.toLocaleDateString("no-NO", { weekday: "long", day: "numeric", month: "short" });
          const dow = (d.getDay() + 6) % 7;
          const recurring = !p?.responsible ? schedule[dow] : null;
          const CardComponent = shouldAnimate ? MotionCard : Card;
          const motionProps = shouldAnimate ? { layout: true, transition } : {};
          return (
            <CardComponent
              key={iso}
              {...motionProps}
              style={
                isToday
                  ? {
                      background: "var(--md-inverse-surface)",
                      color: "var(--md-inverse-on-surface)",
                      borderRadius: "var(--radius-card)",
                      boxShadow: "var(--elevation-shadow-3)",
                    }
                  : { borderRadius: "var(--radius-md)" }
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
                  <div
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: isToday ? "var(--md-headline-emphasized-size)" : "var(--md-title-large-size)",
                      lineHeight: isToday ? "var(--md-headline-emphasized-line)" : "var(--md-title-large-line)",
                      fontWeight: isToday ? "var(--weight-display-max)" : "var(--md-title-emphasized-weight)",
                      color: p?.meal_name ? (isToday ? "var(--md-inverse-on-surface)" : "var(--text-primary)") : "var(--text-tertiary)",
                      fontStyle: p?.meal_name ? "normal" : "italic",
                      margin: "4px 0",
                    }}
                  >
                    {p?.meal_name || "Ingen måltid planlagt"}
                  </div>
                  {p?.responsible ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                      <Avatar
                        name={p.responsible}
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
                        {p.responsible}
                      </span>
                    </div>
                  ) : recurring ? (
                    <div style={{ marginTop: 6 }}>
                      <Tag tone="neutral">Fast: {recurring}</Tag>
                    </div>
                  ) : null}
                </div>
                <Button variant="outline" size="sm" onClick={() => setModal({ type: "plan", iso })}>
                  {p?.meal_name ? "Endre" : "Legg til"}
                </Button>
              </div>
            </CardComponent>
          );
        })}
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
          onSaved={() => {
            setModal(null);
            loadPlan();
          }}
          onOpenIngredientPicker={(ingredients, iso) => setModal({ type: "ingredients", ingredients, iso })}
        />
      )}
      {modal?.type === "browse" && (
        <MealCatalogueBrowseModal
          onClose={() => setModal(null)}
          onOpenEdit={(id) => setModal({ type: "edit", id })}
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
