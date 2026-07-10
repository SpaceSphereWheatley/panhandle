import { createContext, useContext, useCallback, useRef, useState } from "react";
import { api } from "../lib/api.js";

const RecurringContext = createContext(null);

// day_of_week (0=Mon…6=Sun) -> responsible, from GET /recurring. Cached and
// lazily (re)loaded — mirrors the vanilla app's module-level recurringSchedule.
export function RecurringProvider({ children }) {
  const [schedule, setSchedule] = useState({});
  const loadedRef = useRef(false);

  const ensureLoaded = useCallback(async () => {
    if (loadedRef.current) return;
    await reload();
  }, []);

  async function reload() {
    try {
      const rows = await api("/recurring");
      const next = {};
      for (const r of rows) next[r.day_of_week] = r.responsible;
      setSchedule(next);
      loadedRef.current = true;
    } catch {
      /* non-critical, ignore */
    }
  }

  async function saveDay(dow, responsible) {
    let res;
    try {
      res = await api("/recurring", { method: "POST", body: JSON.stringify({ day_of_week: dow, responsible }) });
    } catch {
      return { error: "Kunne ikke lagre – sjekk nettforbindelsen" };
    }
    if (res?.error) return { error: res.error };
    setSchedule((prev) => {
      const next = { ...prev };
      if (responsible) next[dow] = responsible;
      else delete next[dow];
      return next;
    });
    return {};
  }

  return (
    <RecurringContext.Provider value={{ schedule, ensureLoaded, reload, saveDay }}>
      {children}
    </RecurringContext.Provider>
  );
}

export function useRecurring() {
  const ctx = useContext(RecurringContext);
  if (!ctx) throw new Error("useRecurring must be used within RecurringProvider");
  return ctx;
}
