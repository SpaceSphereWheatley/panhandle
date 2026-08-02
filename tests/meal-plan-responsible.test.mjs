// Plain-Node integration test for TODO-88: `/plan` and `/recurring` reject a
// `responsible` value that happens to equal a real username belonging to a
// *different* list, while still accepting free text and same-list usernames
// (see CLAUDE.md's Testing conventions).
//
// Run: node tests/meal-plan-responsible.test.mjs
import assert from "node:assert/strict";
import { startWorker, seedAndLogin } from "./_helpers.mjs";

const PORT = 8808;
const RUN_ID = Date.now().toString(36);
const PASS = "Test-password-123!";

async function main() {
  const worker = await startWorker({ port: PORT });
  try {
    await runTests(worker.base);
    console.log("\nAll meal-plan-responsible tests passed.");
  } finally {
    await worker.teardown();
  }
}

function postPlan(base, auth, body) {
  return fetch(`${base}/plan`, { method: "POST", headers: auth, body: JSON.stringify(body) });
}

function postRecurring(base, auth, body) {
  return fetch(`${base}/recurring`, { method: "POST", headers: auth, body: JSON.stringify(body) });
}

async function runTests(BASE) {
  const mineUsernameStr = `resp_mine_${RUN_ID}`;
  const otherUsernameStr = `resp_other_${RUN_ID}`;
  const { auth: mineAuth } = await seedAndLogin(BASE, mineUsernameStr, PASS);
  await seedAndLogin(BASE, otherUsernameStr, PASS);

  // Free text unrelated to any real account: always fine (the planner's
  // "Other..." fallback, e.g. a babysitter or visiting relative).
  const freeText = await postPlan(BASE, mineAuth, { plan_date: "2030-01-07", responsible: "Babysitter" });
  assert.equal(freeText.status, 200, "arbitrary free-text responsible must still work");

  // A same-list member's own username: always fine.
  const sameList = await postPlan(BASE, mineAuth, { plan_date: "2030-01-08", responsible: mineUsernameStr });
  assert.equal(sameList.status, 200, "a same-list member's username must still work");

  // A real username belonging to a *different* list: rejected.
  const crossTenant = await postPlan(BASE, mineAuth, { plan_date: "2030-01-09", responsible: otherUsernameStr });
  assert.equal(crossTenant.status, 400);
  assert.equal((await crossTenant.json()).code, "RESPONSIBLE_ACCOUNT_MISMATCH");

  // Same rule applies to /recurring.
  const recurFreeText = await postRecurring(BASE, mineAuth, { day_of_week: 0, responsible: "Babysitter" });
  assert.equal(recurFreeText.status, 200);

  const recurCrossTenant = await postRecurring(BASE, mineAuth, { day_of_week: 1, responsible: otherUsernameStr });
  assert.equal(recurCrossTenant.status, 400);
  assert.equal((await recurCrossTenant.json()).code, "RESPONSIBLE_ACCOUNT_MISMATCH");

  console.log("  - /plan and /recurring accept free text and same-list usernames, reject another list's real username");
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
