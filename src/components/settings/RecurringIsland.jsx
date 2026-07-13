import { useEffect, useState } from "react";
import { useListUsers } from "../../context/ListUsersContext.jsx";
import { useRecurring } from "../../context/RecurringContext.jsx";
import { WEEKDAYS_NO } from "../../lib/mealUtils.js";
import { Card } from "../../design-system/index.js";

// Island 2 (part 2) — "Vårt Hjem": weekly recurring meal responsibility.
// Short and single-purpose enough to show directly, no accordion.
export function RecurringIsland() {
  const { people, refresh } = useListUsers();
  const { schedule, ensureLoaded, saveDay } = useRecurring();
  const [otherDrafts, setOtherDrafts] = useState({});

  useEffect(() => {
    refresh();
    ensureLoaded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSelectChange(dow, value) {
    if (value === "__other__") {
      setOtherDrafts((prev) => ({ ...prev, [dow]: schedule[dow] || "" }));
      return;
    }
    setOtherDrafts((prev) => {
      const next = { ...prev };
      delete next[dow];
      return next;
    });
    await saveDay(dow, value);
  }

  async function onOtherBlur(dow, value) {
    const val = value.trim();
    await saveDay(dow, val || "");
    if (!val) {
      setOtherDrafts((prev) => {
        const next = { ...prev };
        delete next[dow];
        return next;
      });
    }
  }

  return (
    <Card padding="lg" style={{ marginBottom: 16 }}>
      <div style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>Fast ansvarlig per ukedag</div>
      <div style={{ fontSize: 13, color: "var(--text-tertiary)", margin: "4px 0 12px" }}>
        Velg hvem som har ansvar for å lage middag på de ulike dagene. Dette vises som forslag når du planlegger,
        og du kan alltid endre det for en enkelt dag.
      </div>
      <div>
        {WEEKDAYS_NO.map((day, dow) => {
          const current = schedule[dow] || "";
          const isOther = dow in otherDrafts || (current && !people.includes(current));
          const selectValue = isOther ? "__other__" : current;
          return (
            <div style={{ padding: "10px 0", borderBottom: "1px solid var(--border-default)" }} key={day}>
              <div style={{ fontWeight: 600, marginBottom: 6, color: "var(--text-primary)" }}>{day}</div>
              <select
                value={selectValue}
                onChange={(e) => onSelectChange(dow, e.target.value)}
                style={{ width: "100%", padding: 10, fontSize: 15, borderRadius: 10, border: "1px solid var(--border-default)", background: "var(--surface-sunken)", color: "var(--text-primary)" }}
              >
                <option value="">Ingen</option>
                {people.map((p) => (
                  <option value={p} key={p}>{p}</option>
                ))}
                <option value="__other__">Annet...</option>
              </select>
              {isOther && (
                <input
                  type="text"
                  placeholder="Beskriv ansvaret"
                  style={{ display: "block", marginTop: 8, width: "100%", padding: 10, fontSize: 15, borderRadius: 10, border: "1px solid var(--border-default)", background: "var(--surface-sunken)", color: "var(--text-primary)" }}
                  defaultValue={current}
                  onBlur={(e) => onOtherBlur(dow, e.target.value)}
                />
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
