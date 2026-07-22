// Durable outbound write queue for offline shopping-list mutations (TODO #113).
//
// The app is optimistic-UI-first: an add/toggle/important flip updates local
// state immediately and fires the request in the background. With no
// connectivity that request used to just fail and the change was reverted —
// so a mutation made mid-shop in a low-signal aisle was silently lost. This
// module persists those mutations to localStorage and replays them, in order,
// once the device is back online, so nothing dropped.
//
// Scope: the three shopping-list writes that happen while actually shopping —
// add (POST /list), toggle-bought (POST /list/:id/toggle), and mark-important
// (PATCH /list/:id). Edit/delete-from-catalogue stay online-only (they show a
// toast on failure) — reconciling a rename/delete against concurrent edits is
// a thornier case than the "add / toggle" path #113 names, and not the
// mid-shop scenario.
//
// Reuses localCache's JSON round-trip. Delivery is at-least-once: an op is
// removed only after its request resolves, so an app killed between the
// server accepting a write and the queue being trimmed can replay it once
// more. Re-adding an identical unbought item merges into the existing line
// (server-side, see POST /list), so a duplicated add bumps quantity rather
// than truly duplicating — an accepted trade for not needing server-side
// op-id dedup.
import { readCache, writeCache } from "./localCache.js";

const QUEUE_KEY = "ph_write_queue_v1";
const TEMP_PREFIX = "tmp_";

function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(16) + Math.random().toString(16).slice(2);
}

// A client-side placeholder id for an item added while offline, before the
// server has assigned the real one. Toggles/important flips made against that
// same not-yet-synced item reference this id, and the flush below maps it to
// the real id once the queued add is replayed.
export function newTempId() {
  return TEMP_PREFIX + uid();
}

export function isTempId(id) {
  return typeof id === "string" && id.startsWith(TEMP_PREFIX);
}

export function loadQueue() {
  const q = readCache(QUEUE_KEY, []);
  return Array.isArray(q) ? q : [];
}

function saveQueue(ops) {
  writeCache(QUEUE_KEY, ops);
}

export function queueLength() {
  return loadQueue().length;
}

export function clearQueue() {
  saveQueue([]);
}

// Append a mutation to the queue. `op` is one of:
//   { kind: "add", tempId, body }                — POST /list
//   { kind: "toggle", targetId }                 — POST /list/:id/toggle
//   { kind: "important", targetId, important }   — PATCH /list/:id
// `targetId` may be a real numeric id or the tempId of an earlier queued add.
export function enqueue(op) {
  const full = { opId: uid(), ...op };
  const ops = loadQueue();
  ops.push(full);
  saveQueue(ops);
  return full;
}

function resolveTarget(id, tempMap) {
  return isTempId(id) ? tempMap.get(id) : id;
}

async function replayOp(op, apiFn, tempMap) {
  if (op.kind === "add") {
    const res = await apiFn("/list", { method: "POST", body: JSON.stringify(op.body) });
    // Record the real id the server assigned so later ops in this same flush
    // that referenced the temp id can resolve to it. A server old enough to
    // predate the id-in-response change (the ~1-min deploy window) omits it —
    // the add still lands, the dependent op below is dropped rather than sent
    // to /list/undefined.
    if (op.tempId != null && res && res.id != null) tempMap.set(op.tempId, res.id);
    return;
  }
  const id = resolveTarget(op.targetId, tempMap);
  if (id == null || isTempId(id)) return; // dependency add never yielded an id — drop
  if (op.kind === "toggle") {
    await apiFn(`/list/${id}/toggle`, { method: "POST" });
  } else if (op.kind === "important") {
    await apiFn(`/list/${id}`, { method: "PATCH", body: JSON.stringify({ important: op.important }) });
  }
}

// Replay queued ops FIFO against `apiFn` (the app's api() helper). Returns
// { drained } — true once the queue is empty. Stops early, leaving the rest
// queued, the moment a call throws a network/auth error (i.e. still offline or
// the session expired). A call that *resolves* — even to a { error } body — is
// treated as terminal for that op (it won't succeed on a later retry), so the
// op is dropped and the queue keeps draining rather than wedging forever on a
// poisoned entry.
//
// The queue is re-read from storage before each removal (not mutated in place)
// so a mutation enqueued while an await is in flight isn't clobbered.
export async function flushQueue(apiFn) {
  const tempMap = new Map();
  for (;;) {
    const ops = loadQueue();
    if (ops.length === 0) return { drained: true };
    const op = ops[0];
    try {
      await replayOp(op, apiFn, tempMap);
    } catch (e) {
      if (e && (e.message === "network" || e.message === "unauth")) {
        return { drained: false };
      }
      // Any other throw: fall through and drop the poisoned op.
    }
    saveQueue(loadQueue().filter((o) => o.opId !== op.opId));
  }
}
