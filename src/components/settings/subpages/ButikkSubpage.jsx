import { useEffect } from "react";
import { Card } from "../../../design-system/index.js";
import { useCategoryOrder } from "../../../context/CategoryOrderContext.jsx";
import { useToast } from "../../../context/ToastContext.jsx";
import { clusterFor } from "../../../lib/categoryClusters.js";
import { CATEGORIES, haptic } from "../../../lib/shoppingUtils.js";
import { UiIcon } from "../../UiIcon.jsx";
import { SubpageSection } from "../SubpageSection.jsx";

// "Butikk" subpage (TODO #105): reorder the shopping-list aisles to match the
// household's actual store layout. Up/down buttons rather than drag-and-drop —
// no new dependency, works with touch and keyboard, and the list is short (13
// fixed categories). A shared household setting (CategoryOrderContext →
// GET/POST /category-order), so a change here reorders the list for everyone.
export function ButikkSubpage() {
  const { order, refresh, save } = useCategoryOrder();
  const toast = useToast();

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function move(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    haptic();
    const res = await save(next);
    if (res.error) toast(res.error, { error: true });
  }

  async function reset() {
    haptic();
    const res = await save(CATEGORIES);
    if (res.error) toast(res.error, { error: true });
    else toast("Tilbakestilt til standard.");
  }

  const isDefault = order.length === CATEGORIES.length && order.every((c, i) => c === CATEGORIES[i]);

  return (
    <Card padding="lg" style={{ overflow: "hidden" }}>
      <SubpageSection label="Rekkefølge på varegrupper">
        <div style={{ fontSize: 13, color: "var(--text-tertiary)", margin: "0 0 12px" }}>
          Sett varegruppene i samme rekkefølge som butikken deres, så følger
          handlelisten ruten dere faktisk går. Endringen gjelder for hele
          husstanden.
        </div>
        <div>
          {order.map((cat, i) => (
            <div
              key={cat}
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
              <button
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label={`Flytt ${cat} opp`}
                title="Flytt opp"
                style={reorderBtnStyle(i === 0)}
              >
                <UiIcon name="caret-up" size={16} />
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === order.length - 1}
                aria-label={`Flytt ${cat} ned`}
                title="Flytt ned"
                style={reorderBtnStyle(i === order.length - 1)}
              >
                <UiIcon name="caret-down" size={16} />
              </button>
            </div>
          ))}
        </div>
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
