// Tiny localStorage read/write pair for hydrating a tab's UI instantly from
// last-known data on mount (stale-while-revalidate), instead of always
// starting blank and waiting on the network. Not namespaced per-user/list —
// same convention as the app's other localStorage keys (ph_view,
// ph_bought_collapsed) — instead, clearCache() below wipes every ph_cache_*
// entry on logout so the next user on a shared device never briefly sees it.
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

// On a shared household device, a stale ph_cache_* entry would otherwise
// hydrate the next user's UI with the previous user's (different list's)
// data until the first network refresh — called from AuthContext's logout.
export function clearCache(prefix = "ph_cache_") {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(prefix)) localStorage.removeItem(key);
    }
  } catch {
    /* storage unavailable — nothing to clear */
  }
}
