import { useEffect, useState } from "react";
import { useListUsers } from "../../context/ListUsersContext.jsx";
import { useRecurring } from "../../context/RecurringContext.jsx";
import { WEEKDAYS_NO } from "../../lib/mealUtils.js";

export function RecurringSettings() {
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
    <div className="setrow">
      <div className="k" style={{ marginBottom: 4 }}>Fast ansvarlig per ukedag</div>
      <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 12 }}>
        Velg hvem som har ansvar for å lage middag på de ulike dagene. Dette vises som forslag når du planlegger,
        og du kan alltid endre det for en enkelt dag.
      </div>
      <div>
        {WEEKDAYS_NO.map((day, dow) => {
          const current = schedule[dow] || "";
          const isOther = dow in otherDrafts || (current && !people.includes(current));
          const selectValue = isOther ? "__other__" : current;
          return (
            <div className="setrow" style={{ padding: "10px 0", borderBottom: "1px solid var(--border-default)" }} key={day}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>{day}</div>
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
    </div>
  );
}
