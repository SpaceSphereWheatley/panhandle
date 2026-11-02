// Plain-Node integration test for shopping-item suggestions' snooze/hide
// controls (no test framework — see CLAUDE.md's Testing conventions):
// PATCH /catalogue/{id}/suggestion and GET /catalogue/suggestions/hidden,
// plus their effect on GET /catalogue/suggestions and their list scoping.
//
// Run: node tests/item-suggestions.test.mjs
import assert from "node:assert/strict";
import { startWorker, seedAndLogin, runSql } from "./_helpers.mjs";

const PORT = 8814;
const STAMP = Date.now();
const USER_A = `sugg_a_${STAMP}`;
const USER_B = `sugg_b_${STAMP}`;
const PASS = "Test-password-123!";

async function main() {
  const worker = await startWorker({ port: PORT });
  try {
    await runTests(worker.base);
    console.log("\nAll item-suggestion tests passed.");
  } finally {
    await worker.teardown();
  }
}

async function runTests(BASE) {
  const { auth: authA } = await seedAndLogin(BASE, USER_A, PASS);
  const { auth: authB } = await seedAndLogin(BASE, USER_B, PASS);

  const get = (path, auth) => fetch(`${BASE}${path}`, { headers: auth });
  const patch = (id, body, auth = authA) =>
    fetch(`${BASE}/catalogue/${id}/suggestion`, { method: "PATCH", headers: auth, body: JSON.stringify(body) });
  const suggestedNames = async () => (await (await get("/catalogue/suggestions", authA)).json()).map((s) => s.name);

  // Put "Milk" in A's catalogue and buy it, then backdate its stats so it's
  // overdue (bought 3x, every ~5 days, last 20 days ago).
  const add = await (await fetch(`${BASE}/list`, {
    method: "POST", headers: authA, body: JSON.stringify({ name: "Milk", qty: 1, category: "Dairy" }),
  })).json();
  assert.equal((await fetch(`${BASE}/list/${add.id}/toggle`, { method: "POST", headers: authA })).status, 200);
  await runSql(
    "UPDATE item_catalogue SET times_bought = 3, first_bought = datetime('now', '-30 days'), " +
    `last_bought = datetime('now', '-15 days') WHERE name = 'Milk' AND list_id = (SELECT list_id FROM users WHERE username = '${USER_A}');`
  );

  let suggestions = await (await get("/catalogue/suggestions", authA)).json();
  const milk = suggestions.find((s) => s.name === "Milk");
  assert.ok(milk, `Milk should be suggested, got: ${suggestions.map((s) => s.name).join(", ")}`);
  console.log("  - overdue item is suggested");

  // ---- validation ----
  for (const body of [{}, { snooze_days: 91 }, { snooze_days: -1 }, { muted: "yes" }, { snooze_days: 7, muted: true }]) {
    const res = await patch(milk.id, body);
    assert.equal(res.status, 400, `expected 400 for ${JSON.stringify(body)}`);
    assert.equal((await res.json()).code, "INVALID_REQUEST");
  }
  assert.equal((await patch(999999, { snooze_days: 7 })).status, 404, "unknown id should 404");
  console.log("  - invalid bodies rejected, unknown id 404s");

  // ---- another household can't touch it ----
  const cross = await patch(milk.id, { muted: true }, authB);
  assert.equal(cross.status, 404, "another list's member must get 404, not modify the row");
  assert.ok((await suggestedNames()).includes("Milk"), "cross-list attempt must not have hidden it");
  console.log("  - cross-household update refused (404)");

  // ---- snooze / unsnooze ----
  assert.equal((await patch(milk.id, { snooze_days: 7 })).status, 200);
  assert.ok(!(await suggestedNames()).includes("Milk"), "snoozed item should disappear");
  assert.equal((await patch(milk.id, { snooze_days: 0 })).status, 200);
  assert.ok((await suggestedNames()).includes("Milk"), "clearing the snooze should bring it back");
  // An expired snooze no longer filters.
  await runSql(`UPDATE item_catalogue SET suggest_snoozed_until = datetime('now', '-1 hour') WHERE id = ${milk.id};`);
  assert.ok((await suggestedNames()).includes("Milk"), "an expired snooze should not hide the item");
  console.log("  - snooze hides, clearing/expiry restores");

  // ---- mute / hidden list / unmute ----
  assert.equal((await patch(milk.id, { muted: true })).status, 200);
  assert.ok(!(await suggestedNames()).includes("Milk"), "muted item should disappear");
  let hidden = await (await get("/catalogue/suggestions/hidden", authA)).json();
  assert.deepEqual(hidden.map((h) => h.name), ["Milk"]);
  const hiddenB = await (await get("/catalogue/suggestions/hidden", authB)).json();
  assert.deepEqual(hiddenB, [], "B must not see A's hidden items");
  assert.equal((await patch(milk.id, { muted: false })).status, 200);
  assert.ok((await suggestedNames()).includes("Milk"), "unmuting should bring it back");
  hidden = await (await get("/catalogue/suggestions/hidden", authA)).json();
  assert.deepEqual(hidden, []);
  console.log("  - mute hides, appears in hidden list (own list only), unmute restores");

  const listA = `(SELECT list_id FROM users WHERE username = '${USER_A}')`;

  // ---- reported interval is whole days, at least 1 ----
  suggestions = await (await get("/catalogue/suggestions", authA)).json();
  const milkRow = suggestions.find((s) => s.name === "Milk");
  assert.equal(milkRow.avg_interval_days, 7.5, "15 calendar days over 2 gaps");
  assert.equal(milkRow.days_since, 15);
  console.log("  - interval and days-since are whole Oslo calendar days");

  // ---- abandoned items drop out: overdue by more than max(3x interval, 14 days) ----
  await runSql(
    "UPDATE item_catalogue SET times_bought = 3, first_bought = datetime('now', '-70 days'), " +
    `last_bought = datetime('now', '-60 days') WHERE name = 'Milk' AND list_id = ${listA};`
  );
  assert.ok(!(await suggestedNames()).includes("Milk"), "55 days overdue on a 5-day interval is abandoned");
  console.log("  - long-abandoned item is no longer suggested");

  // ---- a purchase counts at most once per day ----
  // Tick, untick, tick again, then re-add and buy again: all one day, so
  // times_bought must stay 1. Backdating first/last afterwards would make a
  // (wrongly) double-counted item suggestible — it must not be.
  const eggs = await (await fetch(`${BASE}/list`, {
    method: "POST", headers: authA, body: JSON.stringify({ name: "Eggs", qty: 1, category: "Dairy" }),
  })).json();
  const toggleEggs = () => fetch(`${BASE}/list/${eggs.id}/toggle`, { method: "POST", headers: authA });
  for (let i = 0; i < 3; i++) assert.equal((await toggleEggs()).status, 200); // bought, unbought, bought
  await fetch(`${BASE}/list`, { method: "POST", headers: authA, body: JSON.stringify({ name: "Eggs", qty: 1, category: "Dairy" }) });
  assert.equal((await fetch(`${BASE}/list/mark-all-bought`, { method: "POST", headers: authA })).status, 200);
  await runSql(
    "UPDATE item_catalogue SET first_bought = datetime('now', '-20 days'), last_bought = datetime('now', '-10 days') " +
    `WHERE name = 'Eggs' AND list_id = ${listA};`
  );
  assert.ok(!(await suggestedNames()).includes("Eggs"), "same-day re-purchases must count once (times_bought stays 1)");
  console.log("  - repeated same-day purchases count once");

  // ...but a purchase on a later day does count.
  await runSql(`UPDATE item_catalogue SET last_bought = datetime('now', '-2 days') WHERE name = 'Eggs' AND list_id = ${listA};`);
  await fetch(`${BASE}/list`, { method: "POST", headers: authA, body: JSON.stringify({ name: "Eggs", qty: 1, category: "Dairy" }) });
  assert.equal((await fetch(`${BASE}/list/mark-all-bought`, { method: "POST", headers: authA })).status, 200);
  await runSql(`UPDATE item_catalogue SET last_bought = datetime('now', '-10 days') WHERE name = 'Eggs' AND list_id = ${listA};`);
  assert.ok((await suggestedNames()).includes("Eggs"), "a purchase on a new day should count (times_bought 2)");
  console.log("  - a purchase on a new day counts");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
