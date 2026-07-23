import { useEffect, useRef, useState } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { Button, Card, Input, IconButton } from "../../../design-system/index.js";
import { useCategoryOrder } from "../../../context/CategoryOrderContext.jsx";
import { useToast } from "../../../context/ToastContext.jsx";
import { api } from "../../../lib/api.js";
import { clusterFor } from "../../../lib/categoryClusters.js";
import { CATEGORIES, haptic } from "../../../lib/shoppingUtils.js";
import { UiIcon } from "../../UiIcon.jsx";
import { SubpageSection } from "../SubpageSection.jsx";
import { FieldLabel } from "../FieldLabel.jsx";

const STALE_ITEM_DAYS_MIN = 1;
const STALE_ITEM_DAYS_MAX = 90;

// "Butikkoppsett" subpage — how the shopping list behaves for the household:
// the aisle order (TODO #105) and the stale-item marker threshold. Both are
// shared per-list settings, so a change here applies to everyone.
//
// The stale-item threshold is stored on /notification-settings (the app's only
// per-list preference store), which upserts all five fields in one write — so
// this page fetches the current reminder settings on mount and re-sends them
// unchanged alongside the new stale_item_days. Only one Settings subpage is
// mounted at a time, so those carried-through values are always fresh.
export function ButikkSubpage() {
  const { order, refresh, save } = useCategoryOrder();
  const toast = useToast();
  const [localOrder, setLocalOrder] = useState(order);
  const localOrderRef = useRef(localOrder);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Resync from context whenever it changes (initial load, after move()/reset(),
  // after a drag-triggered save resolves) — never mid-drag, since dragging only
  // touches localOrder until release.
  useEffect(() => {
    setLocalOrder(order);
  }, [order]);

  useEffect(() => {
    localOrderRef.current = localOrder;
  }, [localOrder]);

  async function move(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= localOrder.length) return;
    const next = [...localOrder];
    [next[index], next[target]] = [next[target], next[index]];
    haptic();
    const res = await save(next);
    if (res.error) toast(res.error, { error: true });
  }

  async function handleDragSettled() {
    haptic();
    const res = await save(localOrderRef.current);
    if (res.error) toast(res.error, { error: true });
  }

  async function reset() {
    haptic();
    const res = await save(CATEGORIES);
    if (res.error) toast(res.error, { error: true });
    else toast("Tilbakestilt til standard.");
  }

  const isDefault = localOrder.length === CATEGORIES.length && localOrder.every((c, i) => c === CATEGORIES[i]);

  return (
    <Card padding="lg" style={{ overflow: "hidden" }}>
      <SubpageSection
        label="Rekkefølge på varegrupper"
        description="Sett varegruppene i samme rekkefølge som butikken deres, så følger handlelisten ruten dere faktisk går. Endringen gjelder for hele husstanden."
      >
        <Reorder.Group as="div" axis="y" values={localOrder} onReorder={setLocalOrder}>
          {localOrder.map((cat, i) => (
            <CategoryRow
              key={cat}
              cat={cat}
              index={i}
              total={localOrder.length}
              onMove={move}
              onDragSettled={handleDragSettled}
            />
          ))}
        </Reorder.Group>
        <div style={{ marginTop: 12 }}>
          <Button variant="ghost" size="sm" onClick={reset} disabled={isDefault}>
            Tilbakestill til standardrekkefølge
          </Button>
        </div>
      </SubpageSection>

      <StaleItemSection toast={toast} />
    </Card>
  );
}

// Stale-item marker threshold. Its text-vs-value decoupling (staleItemDaysText
// mirrors raw typing; only a fully valid value updates/saves the real number)
// keeps a controlled re-render from snapping the field back to the old value
// mid-edit. Reminder fields are held opaquely and re-sent unchanged.
function StaleItemSection({ toast }) {
  const [staleItemDays, setStaleItemDays] = useState(7);
  const [staleItemDaysText, setStaleItemDaysText] = useState("7");
  const reminderRef = useRef({
    meal_reminder_enabled: true,
    meal_reminder_time: "18:00",
    weekly_reminder_enabled: true,
    weekly_reminder_time: "18:00",
  });

  useEffect(() => {
    api("/notification-settings").then((res) => {
      if (res.error) return;
      reminderRef.current = {
        meal_reminder_enabled: res.meal_reminder_enabled,
        meal_reminder_time: res.meal_reminder_time,
        weekly_reminder_enabled: res.weekly_reminder_enabled,
        weekly_reminder_time: res.weekly_reminder_time,
      };
      setStaleItemDays(res.stale_item_days);
      setStaleItemDaysText(String(res.stale_item_days));
    });
  }, []);

  async function saveDays(days) {
    try {
      const res = await api("/notification-settings", {
        method: "POST",
        body: JSON.stringify({ ...reminderRef.current, stale_item_days: days }),
      });
      if (res.error) toast(res.error, { error: true });
    } catch {
      toast("Noe gikk galt", { error: true });
    }
  }

  function onChangeText(e) {
    const text = e.target.value;
    setStaleItemDaysText(text);
    const days = Number(text);
    if (text.trim() === "" || !Number.isInteger(days) || days < STALE_ITEM_DAYS_MIN || days > STALE_ITEM_DAYS_MAX) return;
    setStaleItemDays(days);
    saveDays(days);
  }

  function onBlurText() {
    const days = Number(staleItemDaysText);
    const resolved =
      staleItemDaysText.trim() !== "" && Number.isInteger(days)
        ? Math.min(STALE_ITEM_DAYS_MAX, Math.max(STALE_ITEM_DAYS_MIN, days))
        : staleItemDays;
    setStaleItemDaysText(String(resolved));
    if (resolved !== staleItemDays) {
      setStaleItemDays(resolved);
      saveDays(resolved);
    }
  }

  function adjust(delta) {
    const next = Math.min(STALE_ITEM_DAYS_MAX, Math.max(STALE_ITEM_DAYS_MIN, staleItemDays + delta));
    setStaleItemDaysText(String(next));
    if (next === staleItemDays) return;
    setStaleItemDays(next);
    saveDays(next);
  }

  return (
    <SubpageSection
      label="Gamle varer på handlelisten"
      description="Varer som har ligget ukjøpt lenger enn dette får en diskré markering i handlelisten. Gjelder hele husstanden."
    >
      <FieldLabel htmlFor="stale-item-days">Antall dager</FieldLabel>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <IconButton icon="minus" size="sm" variant="subtle" label="Reduser antall dager" onClick={() => adjust(-1)} />
        <Input
          id="stale-item-days"
          type="number"
          inputMode="numeric"
          min={STALE_ITEM_DAYS_MIN}
          max={STALE_ITEM_DAYS_MAX}
          value={staleItemDaysText}
          onChange={onChangeText}
          onBlur={onBlurText}
          style={{ maxWidth: 76 }}
        />
        <IconButton icon="plus" size="sm" variant="subtle" label="Øk antall dager" onClick={() => adjust(1)} />
      </div>
    </SubpageSection>
  );
}

function CategoryRow({ cat, index, total, onMove, onDragSettled }) {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      as="div"
      value={cat}
      dragListener={false}
      dragControls={dragControls}
      onDragEnd={onDragSettled}
      whileDrag={{ boxShadow: "var(--shadow-raised)", background: "var(--surface-sunken)", scale: 1.02, zIndex: 1 }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 0",
        borderBottom: "1px solid var(--border-default)",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0,
          width: 12,
          height: 12,
          borderRadius: "50%",
          background: clusterFor(cat).bg,
          border: `2px solid ${clusterFor(cat).on}`,
        }}
      />
      <span style={{ flex: 1, fontWeight: 600, color: "var(--text-primary)" }}>{cat}</span>
      <span
        aria-hidden="true"
        onPointerDown={(e) => dragControls.start(e)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          flexShrink: 0,
          touchAction: "none",
          cursor: "grab",
          color: "var(--text-tertiary)",
        }}
      >
        <UiIcon name="dots-six-vertical" size={18} />
      </span>
      <button
        onClick={() => onMove(index, -1)}
        disabled={index === 0}
        aria-label={`Flytt ${cat} opp`}
        title="Flytt opp"
        style={reorderBtnStyle(index === 0)}
      >
        <UiIcon name="caret-up" size={16} />
      </button>
      <button
        onClick={() => onMove(index, 1)}
        disabled={index === total - 1}
        aria-label={`Flytt ${cat} ned`}
        title="Flytt ned"
        style={reorderBtnStyle(index === total - 1)}
      >
        <UiIcon name="caret-down" size={16} />
      </button>
    </Reorder.Item>
  );
}

function reorderBtnStyle(disabled) {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
    flexShrink: 0,
    borderRadius: 10,
    border: "1px solid var(--border-default)",
    background: "var(--surface-sunken)",
    color: disabled ? "var(--text-tertiary)" : "var(--text-primary)",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.4 : 1,
  };
}
