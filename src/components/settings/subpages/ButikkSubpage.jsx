import { useEffect, useRef, useState } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { Card } from "../../../design-system/index.js";
import { useCategoryOrder } from "../../../context/CategoryOrderContext.jsx";
import { useToast } from "../../../context/ToastContext.jsx";
import { clusterFor } from "../../../lib/categoryClusters.js";
import { CATEGORIES, haptic } from "../../../lib/shoppingUtils.js";
import { UiIcon } from "../../UiIcon.jsx";
import { SubpageSection } from "../SubpageSection.jsx";

// "Butikkoppsett" subpage (TODO #105): reorder the shopping-list aisles to
// match the household's actual store layout. Drag handle (framer-motion's
// Reorder.Group/Reorder.Item — already a dependency, elsewhere only used for
// swipe gestures) plus the original up/down buttons, kept alongside since
// Reorder alone isn't keyboard-operable. A shared household setting
// (CategoryOrderContext → GET/POST /category-order), so a change here
// reorders the list for everyone.
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
        <button
          onClick={reset}
          disabled={isDefault}
          style={{
            marginTop: 14,
            background: "none",
            border: "none",
            padding: 0,
            fontFamily: "var(--font-sans)",
            fontSize: 13,
            fontWeight: "var(--weight-semibold)",
            color: isDefault ? "var(--text-tertiary)" : "var(--accent-primary)",
            cursor: isDefault ? "default" : "pointer",
            opacity: isDefault ? 0.5 : 1,
          }}
        >
          Tilbakestill til standardrekkefølge
        </button>
      </SubpageSection>
    </Card>
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
