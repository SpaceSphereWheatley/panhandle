// Plain-Node integration test for meal usage stats + suggestions (no test
// framework, no package.json — see CLAUDE.md's "no build step, no Node
// toolchain" constraint). Spins up the real Worker locally against a local
// D1, exercises the actual HTTP API, and asserts on the responses.
//
// Run: node tests/meal-suggestions.test.mjs
//
// Requires `npx` (downloads `wrangler` on first run if not cached).
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = 8799;
const BASE = `http://127.0.0.1:${PORT}/api`;
const DEV_VARS_PATH = path.join(ROOT, ".dev.vars");
const SEED_SECRET = "test-seed-secret";
const JWT_SECRET = "test-jwt-secret-not-for-production";
const TEST_USER = `meal_test_${Date.now()}`;
const TEST_PASS = "Test-password-123!";

function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

async function waitForServer(proc, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/version`);
      if (res.ok) return;
    } catch { /* not up yet */ }
    if (proc.exitCode !== null) throw new Error("wrangler dev exited before becoming ready");
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error("Timed out waiting for wrangler dev to start");
}

async function main() {
  let wroteDevVars = false;
  if (!existsSync(DEV_VARS_PATH)) {
    writeFileSync(DEV_VARS_PATH, `JWT_SECRET=${JWT_SECRET}\nSEED_SECRET=${SEED_SECRET}\n`);
    wroteDevVars = true;
  }

  console.log("Applying local D1 migrations...");
  await run("npx", ["wrangler", "d1", "migrations", "apply", "panhandle", "--local"]);

  console.log("Starting wrangler dev (local)...");
  const proc = spawn("npx", ["wrangler", "dev", "--local", "--port", String(PORT)], {
    cwd: ROOT, stdio: ["ignore", "pipe", "pipe"]
  });
  let stderr = "";
  proc.stderr.on("data", d => { stderr += d; });

  try {
    await waitForServer(proc);
    await runTests();
    console.log("\nAll meal suggestion/usage-stats tests passed.");
  } finally {
    proc.kill();
    if (wroteDevVars) unlinkSync(DEV_VARS_PATH);
  }
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: ROOT, stdio: "inherit" });
    p.on("exit", code => code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`)));
  });
}

async function runTests() {
  // ---- bootstrap a throwaway account ----
  let res = await fetch(`${BASE}/seed`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: SEED_SECRET, accounts: [{ username: TEST_USER, password: TEST_PASS }] })
  });
  assert.equal(res.status, 200, "seed should succeed");

  res = await fetch(`${BASE}/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: TEST_USER, password: TEST_PASS })
  });
  assert.equal(res.status, 200, "login should succeed");
  const { token } = await res.json();
  const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

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
