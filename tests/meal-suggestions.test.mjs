// Plain-Node integration test for meal usage stats + suggestions (no test
// framework — see CLAUDE.md's Testing conventions). Spins up the real Worker
// locally against a local D1, exercises the actual HTTP API, and asserts on
// the responses.
//
// Run: node tests/meal-suggestions.test.mjs
//
// Requires `npx` (downloads `wrangler` on first run if not cached).
import assert from "node:assert/strict";
import { startWorker, seedAndLogin } from "./_helpers.mjs";

const PORT = 8799;
const TEST_USER = `meal_test_${Date.now()}`;
const TEST_PASS = "Test-password-123!";

function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const worker = await startWorker({ port: PORT });
  try {
    await runTests(worker.base);
    console.log("\nAll meal suggestion/usage-stats tests passed.");
  } finally {
    await worker.teardown();
  }
}

async function runTests(BASE) {
  const { auth } = await seedAndLogin(BASE, TEST_USER, TEST_PASS);

  const postPlan = (plan_date, meal_name, extra = {}) =>
    fetch(`${BASE}/plan`, { method: "POST", headers: auth, body: JSON.stringify({ plan_date, meal_name, ...extra }) });

  // ---- plan "Taco" twice, both more than the 10-day suggestion cooldown ago ----
  const tacoFirst = isoDaysAgo(20);
  const tacoSecond = isoDaysAgo(12);
  assert.equal((await postPlan(tacoFirst, "Taco")).status, 200);
  assert.equal((await postPlan(tacoSecond, "Taco")).status, 200);

  let meals = await (await fetch(`${BASE}/meals`, { headers: auth })).json();
  let taco = meals.find(m => m.name === "Taco");
  assert.ok(taco, "Taco should exist in meal_catalogue");
  assert.equal(taco.times_planned, 2, "times_planned should be 2 after two distinct-date assignments");
  assert.equal(taco.last_planned, tacoSecond, "last_planned should track the most recent plan_date");

  // ---- re-saving the same date/meal (e.g. just changing responsible) must not double-count ----
  assert.equal((await postPlan(tacoSecond, "Taco", { responsible: "Test" })).status, 200);
  meals = await (await fetch(`${BASE}/meals`, { headers: auth })).json();
  taco = meals.find(m => m.name === "Taco");
  assert.equal(taco.times_planned, 2, "re-saving the same date/meal should not increment times_planned");

  // ---- plan "Pasta" once, today (too recent to suggest) ----
  assert.equal((await postPlan(isoDaysAgo(0), "Pasta")).status, 200);

  // ---- suggestions: Taco (popular, stale) should appear; Pasta (recent) should not ----
  const suggestions = await (await fetch(`${BASE}/meals/suggestions`, { headers: auth })).json();
  const names = suggestions.map(m => m.name);
  assert.ok(names.includes("Taco"), `expected suggestions to include Taco, got: ${names.join(", ")}`);
  assert.ok(!names.includes("Pasta"), `expected suggestions to exclude recently-planned Pasta, got: ${names.join(", ")}`);

  console.log("  - times_planned/last_planned tracked correctly");
  console.log("  - no double-count on same-date/same-meal re-save");
  console.log("  - suggestions surface stale-but-popular meals and exclude recent ones");

  // ---- meal editor: add a meal directly (no day assignment) ----
  let addRes = await fetch(`${BASE}/meals`, {
    method: "POST", headers: auth, body: JSON.stringify({ name: "Lasagne", ingredients: ["Kjøttdeig", "Pasta"] })
  });
  assert.equal(addRes.status, 200, "adding a new meal should succeed");
  const { id: lasagneId } = await addRes.json();

  meals = await (await fetch(`${BASE}/meals`, { headers: auth })).json();
  let lasagne = meals.find(m => m.id === lasagneId);
  assert.ok(lasagne, "Lasagne should exist in meal_catalogue after POST /meals");
  assert.deepEqual(JSON.parse(lasagne.ingredients), ["Kjøttdeig", "Pasta"]);

  // ---- adding a duplicate name (case-insensitive) should fail ----
  addRes = await fetch(`${BASE}/meals`, {
    method: "POST", headers: auth, body: JSON.stringify({ name: "lasagne" })
  });
  assert.equal(addRes.status, 400, "adding a duplicate meal name should be rejected");

  // ---- editing: rename and update ingredients ----
  const patchRes = await fetch(`${BASE}/meals/${lasagneId}`, {
    method: "PATCH", headers: auth, body: JSON.stringify({ name: "Lasagna", ingredients: ["Kjøttdeig"] })
  });
  assert.equal(patchRes.status, 200, "editing a meal should succeed");
  meals = await (await fetch(`${BASE}/meals`, { headers: auth })).json();
  lasagne = meals.find(m => m.id === lasagneId);
  assert.equal(lasagne.name, "Lasagna", "rename should take effect");
  assert.deepEqual(JSON.parse(lasagne.ingredients), ["Kjøttdeig"], "ingredient edit should take effect");

  // ---- deleting removes it from the catalogue ----
  const delRes = await fetch(`${BASE}/meals/${lasagneId}`, { method: "DELETE", headers: auth });
  assert.equal(delRes.status, 200, "deleting a meal should succeed");
  meals = await (await fetch(`${BASE}/meals`, { headers: auth })).json();
  assert.ok(!meals.some(m => m.id === lasagneId), "deleted meal should no longer appear in meal_catalogue");

  console.log("  - meal editor: add/rename/edit-ingredients/delete all work, duplicate names rejected");
}

main().catch(err => { console.error(err); process.exitCode = 1; });
