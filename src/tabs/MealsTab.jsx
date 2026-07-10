import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { useRecurring } from "../context/RecurringContext.jsx";
import { localIso, mondayOf, WEEK_MIN, WEEK_MAX } from "../lib/mealUtils.js";
import { MealPlanModal } from "../components/meals/MealPlanModal.jsx";
import { MealFabMenu } from "../components/meals/MealFabMenu.jsx";
import { MealCatalogueBrowseModal } from "../components/meals/MealCatalogueBrowseModal.jsx";
import { MealEditModal } from "../components/meals/MealEditModal.jsx";
import { IngredientPickerModal } from "../components/meals/IngredientPickerModal.jsx";

const POLL_MS = 7000;

export function MealsTab({ onSyncTick, onOffline }) {
  const { schedule, ensureLoaded } = useRecurring();
  const [weekOffset, setWeekOffset] = useState(0);
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
      if (!document.hidden) loadPlan();
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
      <div className="week-nav">
        <button disabled={weekOffset <= WEEK_MIN} onClick={() => shiftWeek(-1)}>‹ Forrige</button>
        <span className="label">
          {monday.toLocaleDateString("no-NO", { day: "numeric", month: "short" })} – {" "}
          {sunday.toLocaleDateString("no-NO", { day: "numeric", month: "short" })}
        </span>
        <button onClick={() => shiftWeek(0)}>Denne uken</button>
        <button disabled={weekOffset >= WEEK_MAX} onClick={() => shiftWeek(1)}>Neste ›</button>
      </div>
      <div style={{ marginBottom: 10 }}>
        <button className="browse-link" onClick={() => setModal({ type: "browse" })}>Alle måltider ›</button>
      </div>

      <div>
        {days.map((d) => {
          const iso = localIso(d);
          const p = plan[iso];
          const isToday = iso === today;
          const dayName = d.toLocaleDateString("no-NO", { weekday: "long", day: "numeric", month: "short" });
          const dow = (d.getDay() + 6) % 7;
          const recurring = !p?.responsible ? schedule[dow] : null;
          return (
            <div className={`day${isToday ? " today" : ""}`} key={iso}>
              <button className="edit" onClick={() => setModal({ type: "plan", iso })}>
                {p?.meal_name ? "Endre" : "Legg til"}
              </button>
              <div className="date">{isToday ? "I dag" : dayName}</div>
              <div className={`meal${p?.meal_name ? "" : " empty"}`}>
                {p?.meal_name || "Ingen måltid planlagt"}
              </div>
              {p?.responsible ? (
                <div className="resp">Ansvarlig: {p.responsible}</div>
              ) : recurring ? (
                <div className="resp recurring">Fast ansvarlig: {recurring}</div>
              ) : null}
            </div>
          );
        })}
      </div>

      <button className="fab" aria-label="Måltider" onClick={() => setModal({ type: "fabMenu" })}>+</button>

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
