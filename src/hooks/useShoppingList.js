import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";
import { useToast } from "../context/ToastContext.jsx";
import { useTranslation } from "../context/LanguageContext.jsx";
import { readCache, writeCache } from "../lib/localCache.js";
import { flushQueue, queueLength } from "../lib/writeQueue.js";

const POLL_MS = 7000;
// Last-fetched list, hydrated on mount so a returning user sees real items
// instantly instead of a skeleton/spinner on every cold open — see
// loadList()/CLAUDE.md's loading-UI notes.
const ITEMS_CACHE_KEY = "ph_cache_items_v1";

// Owns the shopping list's server-mirrored state (catalogue, items,
// suggestions, presence, the stale-item threshold) and the load/poll/cache
// machinery around it — extracted out of ShoppingListTab.jsx so the ordering
// guarantee in loadList() below (queue-flush before fetch, no overwrite on
// failure) is independently unit-testable instead of only reachable via a
// full component mount. See useShoppingList.test.js.
//
// Deliberately does NOT own the mutation functions (addItem, toggleItem,
// toggleImportant, markAllBought) — each is entangled with animation
// bookkeeping (resolvingIds/scheduleResolve, pendingCelebrateId, etc.) that
// has to stay in the component, so those keep calling setItems/loadList
// directly rather than being wrapped here. See CLAUDE.md's Interaction
// patterns section for why that choreography can't move.
//
// Presence is also NOT a separate hook/timer: the POST /presence call is the
// third sequential await inside loadList, sharing its poll/active/online
// gating, and is skipped entirely if the write queue didn't drain that tick.
// An independent usePresence would change that behavior, so presentUsers is
// just another piece of state loadList refreshes at the same point it always
// has.
export function useShoppingList({ active, onSyncTick, onOffline }) {
  const toast = useToast();
  const t = useTranslation();

  const [catalogue, setCatalogue] = useState([]);
  const [items, setItems] = useState(() => readCache(ITEMS_CACHE_KEY, []));
  // Other members who've polled the list in the last ~20s (see POST
  // /presence) — usernames, resolved to display names/colors for the avatar
  // row below the summary line.
  const [presentUsers, setPresentUsers] = useState([]);
  // Only true for a genuine cold load with nothing cached yet — once
  // hydrated from ITEMS_CACHE_KEY, subsequent fetches are silent background
  // refreshes rather than a loading state.
  const [loading, setLoading] = useState(() => readCache(ITEMS_CACHE_KEY, null) === null);
  const [suggestedItems, setSuggestedItems] = useState([]);
  // Stale-item marker threshold (days), a per-list preference — see
  // /notification-settings and NotificationsSubpage.jsx. Falls back to the app
  // default until the first fetch resolves.
  const [staleItemDays, setStaleItemDays] = useState(7);
  // Count of offline writes waiting to be replayed (see src/lib/writeQueue.js
  // and TODO #113). Drives the "usendte" pill so a mid-shop add/toggle made
  // with no signal reads as saved-and-pending, not lost. Seeded from any
  // queue that survived an app close.
  const [pendingWrites, setPendingWrites] = useState(() => queueLength());

  function refreshPendingWrites() {
    setPendingWrites(queueLength());
  }

  async function loadCatalogue() {
    try {
      setCatalogue(await api("/catalogue"));
    } catch {
      // Non-fatal: matching/autocomplete degrades to whatever catalogue is
      // already in state (empty on a first-load failure) rather than
      // crashing — but still worth telling the user, unlike loadList's
      // /catalogue/suggestions catch below, since this is the catalogue the
      // whole add/autocomplete flow depends on, not a nice-to-have.
      toast(t("shoppingList.toast.genericError"), { error: true });
    }
  }

  async function loadList() {
    // Replay any queued offline writes first, so the fetch below already
    // reflects them (the queued add is replayed → its real row comes back in
    // the snapshot, replacing our temp-id optimistic item). If the flush
    // can't drain the queue we're still offline: keep the optimistic state
    // and skip the fetch rather than overwriting it with stale server data.
    if (queueLength() > 0) {
      const { drained } = await flushQueue(api);
      setPendingWrites(queueLength());
      if (!drained) {
        onOffline();
        return;
      }
    }
    let fetched;
    try {
      fetched = await api("/list");
      onSyncTick();
    } catch {
      onOffline();
      return;
    }
    setItems(fetched);
    try {
      setSuggestedItems(await api("/catalogue/suggestions"));
    } catch {
      setSuggestedItems([]);
    }
    try {
      setPresentUsers(await api("/presence", { method: "POST" }));
    } catch {
      /* non-critical, keep whatever we had */
    }
  }

  useEffect(() => {
    if (!active) return;
    // Independent, not chained: loadCatalogue() now catches its own errors
    // (see above) rather than rejecting, but even before that fix, chaining
    // via .then(loadList) meant a failed catalogue load silently skipped
    // loadList too — the shopping list itself never appearing over one
    // unrelated catalogue hiccup. The loading spinner only waits on loadList,
    // the one that actually gates what's on screen.
    loadCatalogue();
    loadList().finally(() => setLoading(false));
    const timer = setInterval(() => {
      if (!document.hidden) loadList();
    }, POLL_MS);
    // Replay queued offline writes the moment connectivity returns, rather
    // than waiting up to POLL_MS for the next tick (loadList flushes first).
    const onOnline = () => loadList();
    window.addEventListener("online", onOnline);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", onOnline);
    };
  }, [active]);

  // Persist the current (possibly optimistic) list on every change, not just
  // after a server fetch, so an offline-added/toggled item survives a reload
  // while still offline — its replay op lives in the write queue, and this
  // keeps the matching optimistic row on screen until that op syncs. Skips the
  // initial run so a cold open with nothing cached doesn't write an empty
  // array over the "no cache yet" signal `loading` reads on the next open.
  const didHydrate = useRef(false);
  useEffect(() => {
    if (!didHydrate.current) {
      didHydrate.current = true;
      return;
    }
    writeCache(ITEMS_CACHE_KEY, items);
  }, [items]);

  useEffect(() => {
    if (!active) return;
    api("/notification-settings").then((res) => {
      if (!res.error) setStaleItemDays(res.stale_item_days);
    });
  }, [active]);

  return {
    catalogue,
    items, setItems,
    suggestedItems, setSuggestedItems,
    presentUsers,
    staleItemDays,
    loading,
    pendingWrites, refreshPendingWrites,
    loadCatalogue,
    loadList,
  };
}
