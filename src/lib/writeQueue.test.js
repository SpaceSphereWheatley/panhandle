import { describe, it, expect, beforeEach } from "vitest";
import {
  loadQueue,
  enqueue,
  queueLength,
  clearQueue,
  flushQueue,
  newTempId,
  isTempId,
} from "./writeQueue.js";

// Mimics api.js's throw contract: a rejected fetch surfaces as
// Error("network"), a 401 as Error("unauth"); everything else resolves to the
// parsed JSON body (even a { error } one).
function networkError() {
  return new Error("network");
}

describe("temp ids", () => {
  it("mints unique, recognizable temp ids", () => {
    const a = newTempId();
    const b = newTempId();
    expect(a).not.toBe(b);
    expect(isTempId(a)).toBe(true);
    expect(isTempId(42)).toBe(false);
    expect(isTempId("42")).toBe(false);
  });
});

describe("enqueue / loadQueue", () => {
  beforeEach(() => localStorage.clear());

  it("persists ops in FIFO order with a generated opId", () => {
    enqueue({ kind: "add", tempId: "tmp_a", body: { name: "Melk" } });
    enqueue({ kind: "toggle", targetId: 5 });
    const q = loadQueue();
    expect(q).toHaveLength(2);
    expect(q[0].kind).toBe("add");
    expect(q[1].kind).toBe("toggle");
    expect(q[0].opId).toBeTruthy();
    expect(q[0].opId).not.toBe(q[1].opId);
    expect(queueLength()).toBe(2);
  });

  it("clearQueue empties it", () => {
    enqueue({ kind: "toggle", targetId: 1 });
    clearQueue();
    expect(queueLength()).toBe(0);
  });

  it("tolerates a corrupt stored value", () => {
    localStorage.setItem("ph_write_queue_v1", "{not json");
    expect(loadQueue()).toEqual([]);
  });
});

describe("flushQueue", () => {
  beforeEach(() => localStorage.clear());

  it("drains an empty queue without calling the api", async () => {
    const calls = [];
    const res = await flushQueue((p) => (calls.push(p), Promise.resolve({ ok: true })));
    expect(res).toEqual({ drained: true });
    expect(calls).toEqual([]);
  });

  it("replays ops FIFO and empties the queue on success", async () => {
    enqueue({ kind: "add", tempId: "tmp_a", body: { name: "Melk", qty: 1 } });
    enqueue({ kind: "important", targetId: 7, important: true });
    const calls = [];
    const api = (path, opts) => {
      calls.push([path, opts?.method]);
      return Promise.resolve({ ok: true, id: 100 });
    };
    const res = await flushQueue(api);
    expect(res).toEqual({ drained: true });
    expect(calls).toEqual([
      ["/list", "POST"],
      ["/list/7", "PATCH"],
    ]);
    expect(queueLength()).toBe(0);
  });

  it("maps a temp id from an add's response onto a later op in the same flush", async () => {
    enqueue({ kind: "add", tempId: "tmp_x", body: { name: "Brød", qty: 2 } });
    enqueue({ kind: "toggle", targetId: "tmp_x" });
    const calls = [];
    const api = (path) => {
      calls.push(path);
      if (path === "/list") return Promise.resolve({ ok: true, id: 55 });
      return Promise.resolve({ ok: true });
    };
    await flushQueue(api);
    // The toggle resolved the temp id to the real 55 the add came back with.
    expect(calls).toEqual(["/list", "/list/55/toggle"]);
    expect(queueLength()).toBe(0);
  });

  it("stops on a network error and leaves the failing op (and rest) queued", async () => {
    enqueue({ kind: "toggle", targetId: 1 });
    enqueue({ kind: "toggle", targetId: 2 });
    let n = 0;
    const api = () => {
      n += 1;
      if (n === 1) return Promise.resolve({ ok: true });
      throw networkError();
    };
    const res = await flushQueue(api);
    expect(res).toEqual({ drained: false });
    // First op sent & removed; second stayed for the next attempt.
    const q = loadQueue();
    expect(q).toHaveLength(1);
    expect(q[0].targetId).toBe(2);
  });

  it("resumes cleanly on a second flush after reconnect", async () => {
    enqueue({ kind: "toggle", targetId: 2 });
    const ok = () => Promise.resolve({ ok: true });
    const res = await flushQueue(ok);
    expect(res).toEqual({ drained: true });
    expect(queueLength()).toBe(0);
  });

  it("drops a dependent op whose add never yielded an id (deploy-window edge)", async () => {
    enqueue({ kind: "add", tempId: "tmp_z", body: { name: "Ost" } });
    enqueue({ kind: "toggle", targetId: "tmp_z" });
    const calls = [];
    const api = (path) => {
      calls.push(path);
      // Old server: add succeeds but returns no id.
      return Promise.resolve({ ok: true });
    };
    await flushQueue(api);
    // Add sent; toggle dropped (couldn't resolve the temp id) — not sent to
    // /list/undefined/toggle.
    expect(calls).toEqual(["/list"]);
    expect(queueLength()).toBe(0);
  });

  it("drops a poisoned op that resolves to an error and keeps draining", async () => {
    enqueue({ kind: "add", tempId: "tmp_bad", body: { name: "" } });
    enqueue({ kind: "toggle", targetId: 9 });
    const calls = [];
    const api = (path) => {
      calls.push(path);
      if (path === "/list") return Promise.resolve({ error: "Tomt navn" });
      return Promise.resolve({ ok: true });
    };
    const res = await flushQueue(api);
    expect(res).toEqual({ drained: true });
    // The bad add was dropped (a retry wouldn't help), the toggle still ran.
    expect(calls).toEqual(["/list", "/list/9/toggle"]);
    expect(queueLength()).toBe(0);
  });

  it("preserves an op appended mid-flush (re-reads the queue before trimming)", async () => {
    enqueue({ kind: "toggle", targetId: 1 });
    let appended = false;
    const api = (path) => {
      // Simulate the user enqueuing another write while the first is in flight.
      if (!appended) {
        appended = true;
        enqueue({ kind: "toggle", targetId: 2 });
      }
      return Promise.resolve({ ok: true });
    };
    const res = await flushQueue(api);
    expect(res).toEqual({ drained: true });
    expect(queueLength()).toBe(0);
  });
});
