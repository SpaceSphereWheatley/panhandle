import { createContext, useContext, useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { useAuth } from "./AuthContext.jsx";
import { CATEGORIES, normalizeCategoryOrder } from "../../shared/categories.js";
import { useTranslation } from "./LanguageContext.jsx";

const CategoryOrderContext = createContext(null);

// The list's custom aisle order (TODO #105), from GET /category-order — drives
// how ShoppingListTab groups unbought items, and is edited in the "Butikk"
// Settings subpage. A shared household setting (server-stored per list), not a
// per-device preference. Falls back to the canonical CATEGORIES order until
// loaded and whenever the fetch fails, so the list always renders in a sane
// order. Loaded once on login and after a save; the order changes rarely, so
// there's no polling.
export function CategoryOrderProvider({ children }) {
  const t = useTranslation();
  const { token } = useAuth();
  const [order, setOrder] = useState(CATEGORIES);

  const refresh = useCallback(async () => {
    try {
      const res = await api("/category-order");
      if (Array.isArray(res?.order)) setOrder(normalizeCategoryOrder(res.order));
    } catch {
      /* non-critical, keep whatever order we had */
    }
  }, []);

  useEffect(() => {
    if (token) refresh();
    else setOrder(CATEGORIES);
  }, [token, refresh]);

  // Optimistically applies the new order (so the shopping list re-sorts
  // immediately), then persists it. On failure the caller surfaces the error;
  // a later refresh reconciles with the server if the write didn't land.
  const save = useCallback(async (next) => {
    const normalized = normalizeCategoryOrder(next);
    setOrder(normalized);
    let res;
    try {
      res = await api("/category-order", { method: "POST", body: JSON.stringify({ order: normalized }) });
    } catch {
      return { error: t("common.saveFailed") };
    }
    // TODO(i18n): res.error is a raw server string (worker/index.js), not run through t() — phase 2+.
    if (res?.error) return { error: res.error };
    return {};
  }, [t]);

  return (
    <CategoryOrderContext.Provider value={{ order, refresh, save }}>
      {children}
    </CategoryOrderContext.Provider>
  );
}

export function useCategoryOrder() {
  const ctx = useContext(CategoryOrderContext);
  if (!ctx) throw new Error("useCategoryOrder must be used within CategoryOrderProvider");
  return ctx;
}
