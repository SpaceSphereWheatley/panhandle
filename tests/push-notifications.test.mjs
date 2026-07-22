// Plain-Node integration test for Web Push infrastructure (TODO #7 phases
// 1-2): subscribe/unsubscribe + notification-settings + ping HTTP endpoints
// (auth required, list-scoping), plus runNotificationPass's/sendPushToList's
// DB-interaction logic (dedup, "already planned"/"already has a meal"
// skips, fan-out + exclusion, 404/410 subscription cleanup).
//
// runNotificationPass takes `env`/`nowMs` as plain parameters (see its doc
// comment in worker/index.js), so its logic is exercised here against a
// small fake D1 stub rather than depending on wrangler dev's untested
// scheduled-event simulation (`--test-scheduled`) — there is no other way
// to get a real D1 binding outside the Workers runtime itself, and the fake
// covers exactly the query shapes the notification checks/sendPushToList
// use, so it's a faithful (if implementation-coupled) stand-in.
//
// Run: node tests/push-notifications.test.mjs
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { startWorker, seedAndLogin } from "./_helpers.mjs";
import { runNotificationPass, sendPushToList } from "../worker/index.js";

const PORT = 8802;
const RUN_ID = Date.now().toString(36);
const PASS = "Test-password-123!";

async function main() {
  const worker = await startWorker({ port: PORT });
  try {
    await runHttpTests(worker.base);
    console.log("\nAll push-notification HTTP endpoint tests passed.");
  } finally {
    await worker.teardown();
  }

  await sendPushToListTests();
  await runNotificationPassTests();
  console.log("All notification-pass logic tests passed.");
}

// ---------- HTTP endpoint tests (subscribe/unsubscribe, notification-settings, ping) ----------

async function runHttpTests(BASE) {
  const userA = `push_a_${RUN_ID}`;
  const userB = `push_b_${RUN_ID}`;
  const { auth: authA } = await seedAndLogin(BASE, userA, PASS);
  const { auth: authB } = await seedAndLogin(BASE, userB, PASS);

  // ---- unauthenticated calls are rejected ----
  const noAuthRes = await fetch(`${BASE}/push/subscribe`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: "https://push.test/x", keys: { p256dh: "a", auth: "b" } }),
  });
  assert.equal(noAuthRes.status, 401, "subscribing without a token should be rejected");

  // ---- POST /push/subscribe validates required fields ----
  const badRes = await fetch(`${BASE}/push/subscribe`, {
    method: "POST", headers: authA, body: JSON.stringify({ endpoint: "https://push.test/x" }),
  });
  assert.equal(badRes.status, 400, "subscribing without keys.p256dh/auth should be rejected");

  // ---- subscribing upserts by endpoint, not by (username, endpoint) ----
  // A push subscription belongs to a browser/device: if two different
  // accounts subscribe with the *same* endpoint (a shared household
  // device), the second subscribe should take over ownership rather than
  // creating a second row — otherwise the first account would keep
  // receiving a list's reminders on a device it no longer owns.
  const sharedEndpoint = `https://push.test/shared-${RUN_ID}`;
  const subscribeAs = (auth, endpoint) => fetch(`${BASE}/push/subscribe`, {
    method: "POST", headers: auth,
    body: JSON.stringify({ endpoint, keys: { p256dh: "p256dh-value", auth: "auth-value" } }),
  });
  assert.equal((await subscribeAs(authA, sharedEndpoint)).status, 200);
  assert.equal((await subscribeAs(authB, sharedEndpoint)).status, 200, "resubscribing the same endpoint as a different user should succeed (takes over ownership)");

  // ---- DELETE /push/subscribe removes it ----
  const delRes = await fetch(`${BASE}/push/subscribe`, {
    method: "DELETE", headers: authB, body: JSON.stringify({ endpoint: sharedEndpoint }),
  });
  assert.equal(delRes.status, 200);
  // Deleting an endpoint that no longer exists is a harmless no-op.
  const delAgainRes = await fetch(`${BASE}/push/subscribe`, {
    method: "DELETE", headers: authB, body: JSON.stringify({ endpoint: sharedEndpoint }),
  });
  assert.equal(delAgainRes.status, 200);

  console.log("  - subscribe requires auth and valid keys");
  console.log("  - resubscribing an endpoint under a different account reassigns ownership");
  console.log("  - unsubscribe is idempotent");

  // ---- GET /notification-settings returns app-level defaults when unset ----
  const defaultsRes = await fetch(`${BASE}/notification-settings`, { headers: authA });
  assert.equal(defaultsRes.status, 200);
  const defaults = await defaultsRes.json();
  assert.deepEqual(defaults, {
    meal_reminder_enabled: true, meal_reminder_time: "18:00",
    weekly_reminder_enabled: true, weekly_reminder_time: "18:00",
    stale_item_days: 7,
  }, "a list with no notification_settings row should see the app-level defaults");

  // ---- POST /notification-settings validates HH:mm in 15-min increments (both reminder times) ----
  const invalidMealTimeRes = await fetch(`${BASE}/notification-settings`, {
    method: "POST", headers: authA,
    body: JSON.stringify({ meal_reminder_enabled: true, meal_reminder_time: "18:07", weekly_reminder_enabled: true, weekly_reminder_time: "18:00" }),
  });
  assert.equal(invalidMealTimeRes.status, 400, "a non-15-minute meal_reminder_time should be rejected");

  const invalidWeeklyTimeRes = await fetch(`${BASE}/notification-settings`, {
    method: "POST", headers: authA,
    body: JSON.stringify({ meal_reminder_enabled: true, meal_reminder_time: "18:00", weekly_reminder_enabled: true, weekly_reminder_time: "18:07" }),
  });
  assert.equal(invalidWeeklyTimeRes.status, 400, "a non-15-minute weekly_reminder_time should be rejected");

  // ---- POST /notification-settings persists and is readable via GET ----
  const saveRes = await fetch(`${BASE}/notification-settings`, {
    method: "POST", headers: authA,
    body: JSON.stringify({
      meal_reminder_enabled: false, meal_reminder_time: "07:30",
      weekly_reminder_enabled: false, weekly_reminder_time: "09:15",
      stale_item_days: 3,
    }),
  });
  assert.equal(saveRes.status, 200);
  const savedRes = await fetch(`${BASE}/notification-settings`, { headers: authA });
  assert.deepEqual(await savedRes.json(), {
    meal_reminder_enabled: false, meal_reminder_time: "07:30",
    weekly_reminder_enabled: false, weekly_reminder_time: "09:15",
    stale_item_days: 3,
  });

  // ---- notification-settings is list-scoped, not global ----
  const otherListRes = await fetch(`${BASE}/notification-settings`, { headers: authB });
  assert.deepEqual(await otherListRes.json(), {
    meal_reminder_enabled: true, meal_reminder_time: "18:00",
    weekly_reminder_enabled: true, weekly_reminder_time: "18:00",
    stale_item_days: 7,
  }, "another list's settings must be unaffected");

  console.log("  - notification-settings defaults, validation, persistence, and list-scoping all check out");

  // ---- POST /push/ping ----
  const noAuthPingRes = await fetch(`${BASE}/push/ping`, { method: "POST" });
  assert.equal(noAuthPingRes.status, 401, "pinging without a token should be rejected");

  const firstPingRes = await fetch(`${BASE}/push/ping`, { method: "POST", headers: authA });
  assert.equal(firstPingRes.status, 200, "a fresh ping should succeed");

  const secondPingRes = await fetch(`${BASE}/push/ping`, { method: "POST", headers: authA });
  assert.equal(secondPingRes.status, 429, "an immediate repeat ping on the same list should be rate-limited");

  // The cooldown is per-list, not global — a different list's first ping
  // should succeed even while userA's list is still cooling down.
  const otherListPingRes = await fetch(`${BASE}/push/ping`, { method: "POST", headers: authB });
  assert.equal(otherListPingRes.status, 200, "a different list's ping should be unaffected by another list's cooldown");

  console.log("  - ping requires auth, succeeds once, and is rate-limited per list (not globally)");
}

// ---------- sendPushToList exclusion tests (fake D1, real VAPID crypto) ----------

async function genEcKeys(algorithm, usages) {
  const kp = await webcrypto.subtle.generateKey({ name: algorithm, namedCurve: "P-256" }, true, usages);
  return kp;
}

async function genVapidPrivateJwk() {
  const kp = await genEcKeys("ECDSA", ["sign", "verify"]);
  return JSON.stringify(await webcrypto.subtle.exportKey("jwk", kp.privateKey));
}

async function genSubscriberKeys() {
  const kp = await genEcKeys("ECDH", ["deriveBits"]);
  const raw = await webcrypto.subtle.exportKey("raw", kp.publicKey);
  return {
    p256dh: Buffer.from(raw).toString("base64url"),
    auth: Buffer.from(webcrypto.getRandomValues(new Uint8Array(16))).toString("base64url"),
  };
}

// A minimal fake D1 covering exactly the query shapes the notification
// checks/sendPushToList use (see worker/index.js) — not a general SQL
// engine, just enough to exercise the real control flow deterministically.
function makeFakeDB(initial) {
  const state = {
    notificationSettings: initial.notificationSettings ?? [],
    mealPlans: initial.mealPlans ?? [],
    pushSubscriptions: initial.pushSubscriptions ?? [],
    notificationLog: [],
  };

  function prepare(sql) {
    let binds = [];
    return {
      bind(...args) { binds = args; return this; },
      async first() { return select(sql, binds)[0] ?? null; },
      async all() { return { results: select(sql, binds) }; },
      async run() { return exec(sql, binds); },
    };
  }

  function select(sql, binds) {
    if (sql.includes("FROM notification_settings")) return state.notificationSettings;
    if (sql.includes("FROM meal_plan")) {
      const [list_id, a, b] = binds;
      if (sql.includes("BETWEEN")) {
        // checkWeeklyReminders' query is a COUNT(*) aggregate consumed via
        // .first() as { n }, not raw rows — mirror that shape here.
        const rows = state.mealPlans.filter((r) => r.list_id === list_id && r.plan_date >= a && r.plan_date <= b && r.meal_id !== null);
        return [{ n: rows.length }];
      }
      return state.mealPlans.filter((r) => r.list_id === list_id && r.plan_date === a);
    }
    if (sql.includes("FROM push_subscriptions")) {
      const [list_id] = binds;
      return state.pushSubscriptions.filter((r) => r.list_id === list_id);
    }
    throw new Error("fake DB: unhandled SELECT: " + sql);
  }

  function exec(sql, binds) {
    if (sql.includes("INSERT OR IGNORE INTO notification_log")) {
      // `type` is a literal in the SQL text ('meal_reminder'/'weekly_reminder'),
      // not a bind param — extract it so this fake respects the real
      // UNIQUE(list_id, type, target_date) constraint, not just (list_id, target_date).
      const [list_id, target_date] = binds;
      const type = sql.match(/'([a-z_]+)'/)?.[1] ?? null;
      if (state.notificationLog.some((r) => r.list_id === list_id && r.type === type && r.target_date === target_date)) {
        return { meta: { changes: 0 } };
      }
      state.notificationLog.push({ list_id, type, target_date });
      return { meta: { changes: 1 } };
    }
    if (sql.includes("DELETE FROM push_subscriptions WHERE endpoint")) {
      const [endpoint] = binds;
      const before = state.pushSubscriptions.length;
      state.pushSubscriptions = state.pushSubscriptions.filter((s) => s.endpoint !== endpoint);
      return { meta: { changes: before - state.pushSubscriptions.length } };
    }
    throw new Error("fake DB: unhandled exec: " + sql);
  }

  return { db: { prepare }, state };
}

async function sendPushToListTests() {
  const VAPID_PRIVATE_KEY = await genVapidPrivateJwk();
  const baseEnv = { VAPID_PRIVATE_KEY, FEEDBACK_EMAIL: "test@example.com" };

  const alice = { endpoint: "https://push.test/alice", ...(await genSubscriberKeys()), list_id: 5, username: "alice" };
  const bob = { endpoint: "https://push.test/bob", ...(await genSubscriberKeys()), list_id: 5, username: "bob" };
  const { db } = makeFakeDB({ pushSubscriptions: [alice, bob] });

  let calledEndpoints = [];
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (endpoint) => { calledEndpoints.push(endpoint); return new Response(null, { status: 201 }); };
  try {
    await sendPushToList({ ...baseEnv, DB: db }, 5, { title: "hi" }, { excludeUsernames: ["alice"] });
    assert.equal(calledEndpoints.length, 1, "should send to exactly one (non-excluded) subscription");
    assert.equal(calledEndpoints[0], bob.endpoint, "should send to bob, not the excluded alice");
  } finally {
    globalThis.fetch = origFetch;
  }
  console.log("  - sendPushToList excludes the given usernames' subscriptions and sends to the rest");
}

// ---------- runNotificationPass logic tests (fake D1, real VAPID crypto) ----------

async function runNotificationPassTests() {
  const VAPID_PRIVATE_KEY = await genVapidPrivateJwk();
  const baseEnv = { VAPID_PRIVATE_KEY, FEEDBACK_EMAIL: "test@example.com" };

  // ---- meal reminder scenarios (2026-07-15T16:00:00Z = 18:00 Oslo, a Wednesday) ----
  // 2026-07-15 is a Wednesday (dow 2, not Sunday), so checkWeeklyReminders's
  // dow-gate short-circuits before touching these fixtures at all.
  const NOW_MS = Date.parse("2026-07-15T16:00:00Z");
  const DUE_TIME = "18:00";
  const TOMORROW = "2026-07-16";

  // ---- scenario A: due, unplanned, one subscription -> sends once, dedups on a second pass ----
  {
    const sub = { endpoint: "https://push.test/list-1-device", ...(await genSubscriberKeys()), list_id: 1, username: "a1" };
    const { db, state } = makeFakeDB({
      notificationSettings: [{ list_id: 1, meal_reminder_time: DUE_TIME }],
      mealPlans: [],
      pushSubscriptions: [sub],
    });
    let fetchCalls = 0;
    const origFetch = globalThis.fetch;
    globalThis.fetch = async (...args) => { fetchCalls++; return new Response(null, { status: 201 }); };
    try {
      await runNotificationPass({ ...baseEnv, DB: db }, NOW_MS);
      assert.equal(fetchCalls, 1, "a due, unplanned list with one subscription should send exactly one push");
      assert.deepEqual(state.notificationLog, [{ list_id: 1, type: "meal_reminder", target_date: TOMORROW }]);

      await runNotificationPass({ ...baseEnv, DB: db }, NOW_MS);
      assert.equal(fetchCalls, 1, "a second pass at the same time must not double-send (dedup)");
    } finally {
      globalThis.fetch = origFetch;
    }
  }
  console.log("  - due + unplanned list sends once and dedups a repeat pass (meal reminder)");

  // ---- scenario B: due but already planned -> no send ----
  {
    const sub = { endpoint: "https://push.test/list-2-device", ...(await genSubscriberKeys()), list_id: 2, username: "b1" };
    const { db, state } = makeFakeDB({
      notificationSettings: [{ list_id: 2, meal_reminder_time: DUE_TIME }],
      mealPlans: [{ list_id: 2, plan_date: TOMORROW, meal_id: 42 }],
      pushSubscriptions: [sub],
    });
    let fetchCalls = 0;
    const origFetch = globalThis.fetch;
    globalThis.fetch = async () => { fetchCalls++; return new Response(null, { status: 201 }); };
    try {
      await runNotificationPass({ ...baseEnv, DB: db }, NOW_MS);
      assert.equal(fetchCalls, 0, "a list with tomorrow already planned should not receive a reminder");
      assert.deepEqual(state.notificationLog, []);
    } finally {
      globalThis.fetch = origFetch;
    }
  }
  console.log("  - already-planned list is skipped (meal reminder)");

  // ---- scenario C: not due (wrong configured time) -> no send ----
  {
    const sub = { endpoint: "https://push.test/list-3-device", ...(await genSubscriberKeys()), list_id: 3, username: "c1" };
    const { db, state } = makeFakeDB({
      notificationSettings: [{ list_id: 3, meal_reminder_time: "09:00" }],
      mealPlans: [],
      pushSubscriptions: [sub],
    });
    let fetchCalls = 0;
    const origFetch = globalThis.fetch;
    globalThis.fetch = async () => { fetchCalls++; return new Response(null, { status: 201 }); };
    try {
      await runNotificationPass({ ...baseEnv, DB: db }, NOW_MS);
      assert.equal(fetchCalls, 0, "a list whose configured reminder time doesn't match now should not fire");
      assert.deepEqual(state.notificationLog, []);
    } finally {
      globalThis.fetch = origFetch;
    }
  }
  console.log("  - list not due at the current local time is skipped (meal reminder)");

  // ---- scenario D: push service reports the subscription is gone (410) -> row is cleaned up ----
  {
    const sub = { endpoint: "https://push.test/list-4-device", ...(await genSubscriberKeys()), list_id: 4, username: "d1" };
    const { db, state } = makeFakeDB({
      notificationSettings: [{ list_id: 4, meal_reminder_time: DUE_TIME }],
      mealPlans: [],
      pushSubscriptions: [sub],
    });
    const origFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(null, { status: 410 });
    try {
      await runNotificationPass({ ...baseEnv, DB: db }, NOW_MS);
      assert.deepEqual(state.pushSubscriptions, [], "a 410 response should delete the expired subscription row");
    } finally {
      globalThis.fetch = origFetch;
    }
  }
  console.log("  - an expired (410) subscription is pruned (meal reminder)");

  // ---- weekly reminder scenarios (2026-02-01T17:00:00Z = 18:00 Oslo, a Sunday) ----
  // meal_reminder_time is deliberately set away from "18:00" in these
  // fixtures so checkMealReminders' own (unrelated) due-check never fires
  // alongside checkWeeklyReminders in the same runNotificationPass call.
  const SUNDAY_NOW_MS = Date.parse("2026-02-01T17:00:00Z");
  const WEEK_START = "2026-02-02"; // the Monday after this Sunday
  const WEEK_END = "2026-02-08";

  // ---- scenario E: due, week completely unplanned -> sends once, dedups on a repeat pass ----
  {
    const sub = { endpoint: "https://push.test/list-5-device", ...(await genSubscriberKeys()), list_id: 5, username: "e1" };
    const { db, state } = makeFakeDB({
      notificationSettings: [{ list_id: 5, meal_reminder_time: "23:45", weekly_reminder_time: DUE_TIME }],
      mealPlans: [],
      pushSubscriptions: [sub],
    });
    let fetchCalls = 0;
    const origFetch = globalThis.fetch;
    globalThis.fetch = async () => { fetchCalls++; return new Response(null, { status: 201 }); };
    try {
      await runNotificationPass({ ...baseEnv, DB: db }, SUNDAY_NOW_MS);
      assert.equal(fetchCalls, 1, "a due list with a completely unplanned upcoming week should send exactly one push");
      assert.deepEqual(state.notificationLog, [{ list_id: 5, type: "weekly_reminder", target_date: WEEK_START }]);

      await runNotificationPass({ ...baseEnv, DB: db }, SUNDAY_NOW_MS);
      assert.equal(fetchCalls, 1, "a second pass at the same time must not double-send (dedup)");
    } finally {
      globalThis.fetch = origFetch;
    }
  }
  console.log("  - due + completely-unplanned week sends once and dedups a repeat pass (weekly reminder)");

  // ---- scenario F: due but the week already has at least one planned meal -> no send ----
  {
    const sub = { endpoint: "https://push.test/list-6-device", ...(await genSubscriberKeys()), list_id: 6, username: "f1" };
    const { db, state } = makeFakeDB({
      notificationSettings: [{ list_id: 6, meal_reminder_time: "23:45", weekly_reminder_time: DUE_TIME }],
      mealPlans: [{ list_id: 6, plan_date: WEEK_START, meal_id: 7 }],
      pushSubscriptions: [sub],
    });
    let fetchCalls = 0;
    const origFetch = globalThis.fetch;
    globalThis.fetch = async () => { fetchCalls++; return new Response(null, { status: 201 }); };
    try {
      await runNotificationPass({ ...baseEnv, DB: db }, SUNDAY_NOW_MS);
      assert.equal(fetchCalls, 0, "a week with at least one planned meal should not receive the weekly reminder");
      assert.deepEqual(state.notificationLog, []);
    } finally {
      globalThis.fetch = origFetch;
    }
  }
  console.log("  - a week with at least one planned meal is skipped (weekly reminder)");

  // ---- scenario G: not Sunday -> no send, regardless of configured time ----
  {
    const sub = { endpoint: "https://push.test/list-7-device", ...(await genSubscriberKeys()), list_id: 7, username: "g1" };
    const { db, state } = makeFakeDB({
      notificationSettings: [{ list_id: 7, meal_reminder_time: "23:45", weekly_reminder_time: DUE_TIME }],
      mealPlans: [],
      pushSubscriptions: [sub],
    });
    let fetchCalls = 0;
    const origFetch = globalThis.fetch;
    globalThis.fetch = async () => { fetchCalls++; return new Response(null, { status: 201 }); };
    try {
      // NOW_MS (from the meal-reminder scenarios) is a Wednesday.
      await runNotificationPass({ ...baseEnv, DB: db }, NOW_MS);
      assert.equal(fetchCalls, 0, "the weekly reminder should never fire on a non-Sunday");
      assert.deepEqual(state.notificationLog, []);
    } finally {
      globalThis.fetch = origFetch;
    }
  }
  console.log("  - weekly reminder never fires on a non-Sunday");

  // ---- scenario H: Sunday, both reminders due, week + tomorrow unplanned ->
  // only the weekly one fires; the daily meal reminder is suppressed (#91) ----
  {
    const sub = { endpoint: "https://push.test/list-8-device", ...(await genSubscriberKeys()), list_id: 8, username: "h1" };
    const { db, state } = makeFakeDB({
      // Both reminder times land on this same 18:00-Oslo tick.
      notificationSettings: [{ list_id: 8, meal_reminder_time: DUE_TIME, weekly_reminder_time: DUE_TIME }],
      mealPlans: [],
      pushSubscriptions: [sub],
    });
    let fetchCalls = 0;
    const origFetch = globalThis.fetch;
    globalThis.fetch = async () => { fetchCalls++; return new Response(null, { status: 201 }); };
    try {
      await runNotificationPass({ ...baseEnv, DB: db }, SUNDAY_NOW_MS);
      assert.equal(fetchCalls, 1, "a fully-unplanned Sunday must send exactly one push, not two back-to-back");
      // Only the weekly reminder was logged — the daily meal reminder was
      // suppressed for this list on this tick, not merely deduped.
      assert.deepEqual(state.notificationLog, [{ list_id: 8, type: "weekly_reminder", target_date: WEEK_START }]);
    } finally {
      globalThis.fetch = origFetch;
    }
  }
  console.log("  - fully-unplanned Sunday sends only the weekly reminder, suppressing the daily one (#91)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
