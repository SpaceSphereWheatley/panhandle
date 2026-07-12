import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";
import { useRecurring } from "../context/RecurringContext.jsx";
import { localIso, mondayOf, WEEK_MIN, WEEK_MAX } from "../lib/mealUtils.js";
import { MealPlanModal } from "../components/meals/MealPlanModal.jsx";
import { MealFabMenu } from "../components/meals/MealFabMenu.jsx";
import { MealCatalogueBrowseModal } from "../components/meals/MealCatalogueBrowseModal.jsx";
import { MealEditModal } from "../components/meals/MealEditModal.jsx";
import { IngredientPickerModal } from "../components/meals/IngredientPickerModal.jsx";
import { Card, Avatar, Tag, Button, Fab } from "../design-system/index.js";

const POLL_MS = 7000;

// Deterministic-but-varied avatar color per person, since the real data
// model (unlike the design project's toy fake cooks) has no fixed
// per-person color assigned.
const AVATAR_COLORS = ["var(--accent-primary)", "var(--accent-secondary)", "var(--accent-tertiary)", "var(--sage-600)", "var(--terracotta-600)"];
function avatarColorFor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function MealsTab({ onSyncTick, onOffline }) {
  const { schedule, ensureLoaded } = useRecurring();
  const [weekOffset, setWeekOffset] = useState(0);
  const weekOffsetRef = useRef(weekOffset);
  weekOffsetRef.current = weekOffset;
  const [plan, setPlan] = useState({}); // iso -> plan row
  const [monday, setMonday] = useState(() => mondayOf(new Date()));
  // Single active modal for the whole tab, mirroring the vanilla app's one
  // #modalRoot swapping content: { type: "plan"|"fabMenu"|"browse"|"edit"|"ingredients", ... } | null
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
    ensureLoaded();
    loadPlan(0);
    const timer = setInterval(() => {
      if (!document.hidden) loadPlan(weekOffsetRef.current);
    }, POLL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {days.map((d) => {
          const iso = localIso(d);
          const p = plan[iso];
          const isToday = iso === today;
          const dayName = d.toLocaleDateString("no-NO", { weekday: "long", day: "numeric", month: "short" });
          const dow = (d.getDay() + 6) % 7;
          const recurring = !p?.responsible ? schedule[dow] : null;
          return (
            <Card
              key={iso}
              style={isToday ? { border: "2px solid var(--accent-primary)", background: "color-mix(in srgb, var(--accent-primary) 8%, var(--surface-card))" } : undefined}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-2xs)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "var(--tracking-wide)", color: isToday ? "var(--accent-primary)" : "var(--text-tertiary)" }}>
                    {isToday ? "I dag" : dayName}
                  </div>
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-lg)", fontWeight: 700, color: p?.meal_name ? "var(--text-primary)" : "var(--text-tertiary)", fontStyle: p?.meal_name ? "normal" : "italic", margin: "4px 0" }}>
                    {p?.meal_name || "Ingen måltid planlagt"}
                  </div>
                  {p?.responsible ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                      <Avatar name={p.responsible} color={avatarColorFor(p.responsible)} size={24} />
                      <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)" }}>{p.responsible}</span>
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
            </Card>
          );
        })}
      </div>

      <Fab label="Måltider" onClick={() => setModal({ type: "fabMenu" })} />

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
      {modal?.type === "fabMenu" && (
        <MealFabMenu
          onClose={() => setModal(null)}
          onNewMeal={() => setModal({ type: "edit", id: null })}
          onBrowse={() => setModal({ type: "browse" })}
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
