import { cap } from "../lib/shoppingUtils.js";
import { enqueue, newTempId } from "../lib/writeQueue.js";
import { useAuth } from "../context/AuthContext.jsx";

// Wraps the offline write-queue call sites shared across ShoppingListTab's
// mutation functions (addItem/addSuggestedItem, toggleItem, toggleImportant).
// Deliberately thin: the actual replay/flush logic lives in
// src/lib/writeQueue.js (already unit-tested there) and in useShoppingList's
// loadList; this hook only owns the "queue this op and drop/mirror the
// optimistic local state" side of a mutation that failed with a network
// error.
//
// `setItems`/`refreshPendingWrites` are plain callbacks rather than a config
// object — both are tightly-related, not the "3+ loosely-related externals"
// case that justifies one (see useShoppingList's own doc comment for that
// precedent). `currentUser` isn't threaded in either: ShoppingListTab already
// sits inside AuthProvider, so this hook reads useAuth() itself, same as the
// component used to.
export function useOfflineQueue(setItems, refreshPendingWrites) {
  const { user: currentUser } = useAuth();

  // Shared by addItem/addSuggestedItem's offline paths: persist the add to the
  // write queue for replay, and drop a matching optimistic row on the list
  // (with a temp id — see writeQueue.newTempId) so it shows immediately and
  // survives a reload while still offline.
  function queueOfflineAdd({ name, category, notes, qty, exact }) {
    const tempId = newTempId();
    enqueue({ kind: "add", tempId, body: { name, qty: qty || 1, category, notes, exact } });
    const optimistic = {
      id: tempId,
      bought: 0,
      important: 0,
      added_by: currentUser,
      added_at: new Date().toISOString(),
      bought_at: null,
      qty: qty || 1,
      notes: notes ?? null,
      // The server capitalizes non-exact names; mirror that so the optimistic
      // row reads the same before and after it syncs.
      name: exact ? name : cap(name),
      category,
    };
    setItems((prev) => [...prev, optimistic]);
    refreshPendingWrites();
  }

  function enqueueToggle(id) {
    enqueue({ kind: "toggle", targetId: id });
    refreshPendingWrites();
  }

  function enqueueImportant(id, important) {
    enqueue({ kind: "important", targetId: id, important });
    refreshPendingWrites();
  }

  return { queueOfflineAdd, enqueueToggle, enqueueImportant };
}
