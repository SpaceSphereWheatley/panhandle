// Tiny localStorage read/write pair for hydrating a tab's UI instantly from
// last-known data on mount (stale-while-revalidate), instead of always
// starting blank and waiting on the network. Not namespaced per-user/list —
// same convention as the app's other localStorage keys (ph_view,
// ph_bought_collapsed).
export function readCache(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function writeCache(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full/unavailable — cache is a nice-to-have, not required */
  }
}
