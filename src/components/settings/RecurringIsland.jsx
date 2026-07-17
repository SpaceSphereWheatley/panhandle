import { useEffect, useState } from "react";
import { useListUsers } from "../../context/ListUsersContext.jsx";
import { useRecurring } from "../../context/RecurringContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { Input } from "../../design-system/index.js";
import { WEEKDAYS_NO } from "../../lib/mealUtils.js";
import { SubpageSection } from "./SubpageSection.jsx";

// "Vårt hjem" subpage, part 2: weekly recurring meal responsibility,
// always-open like MembersIsland's sub-sections (no accordions — see
// SubpageSection.jsx). Content-only — no own Card wrapper, see
// MembersIsland.jsx / HjemSubpage.jsx.
export function RecurringIsland() {
  const { people, nameFor, refresh } = useListUsers();
  const { schedule, ensureLoaded, saveDay } = useRecurring();
  const toast = useToast();
  const [otherDrafts, setOtherDrafts] = useState({});

  useEffect(() => {
    refresh();
    ensureLoaded();
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
    const res = await saveDay(dow, value);
    if (res.error) toast(res.error, { error: true });
    else toast("Lagret.");
  }

  async function onOtherBlur(dow, value) {
    const val = value.trim();
    // Blur fires on every focus loss, not just an edit — skip the round trip
    // (and the new "Lagret." toast) when nothing actually changed, so tabbing
    // through the field without typing doesn't spam a confirmation.
    if (val === (schedule[dow] || "")) return;
    const res = await saveDay(dow, val || "");
    if (res.error) toast(res.error, { error: true });
    else toast("Lagret.");
    if (!val) {
      setOtherDrafts((prev) => {
        const next = { ...prev };
        delete next[dow];
        return next;
      });
    }
  }

  return (
    <SubpageSection label="Fast ansvarlig per ukedag">
      <div style={{ fontSize: 13, color: "var(--text-tertiary)", margin: "0 0 12px" }}>
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
              <div id={`recurring-day-${dow}`} style={{ fontWeight: 600, marginBottom: 6, color: "var(--text-primary)" }}>{day}</div>
              <select
                value={selectValue}
                onChange={(e) => onSelectChange(dow, e.target.value)}
                aria-labelledby={`recurring-day-${dow}`}
                style={{ width: "100%", padding: 10, fontSize: 15, borderRadius: 10, border: "1px solid var(--border-default)", background: "var(--surface-sunken)", color: "var(--text-primary)" }}
              >
                <option value="">Ingen</option>
                {people.map((p) => (
                  <option value={p} key={p}>{nameFor(p)}</option>
                ))}
                <option value="__other__">Annet...</option>
              </select>
              {isOther && (
                <Input
                  type="text"
                  placeholder="Beskriv ansvaret"
                  aria-label={`Beskriv ansvar for ${day}`}
                  style={{ marginTop: 8 }}
                  defaultValue={current}
                  onBlur={(e) => onOtherBlur(dow, e.target.value)}
                />
              )}
            </div>
          );
        })}
      </div>
    </SubpageSection>
  );
}
