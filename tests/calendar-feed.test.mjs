// Plain-Node integration test for the ICS calendar feed: authenticated
// GET/POST /calendar-feed (scope) and POST/DELETE /calendar-feed/token
// (token lifecycle), plus the public GET /calendar/{token}.ics route (see
// CLAUDE.md's Testing conventions). Spins up the real Worker locally
// against a local D1 via tests/_helpers.mjs.
//
// Run: node tests/calendar-feed.test.mjs
import assert from "node:assert/strict";
import { startWorker, seedAndLogin } from "./_helpers.mjs";

const PORT = 8808;
const RUN_ID = Date.now().toString(36);
const PASS = "Test-password-123!";

async function main() {
  const worker = await startWorker({ port: PORT });
  try {
    await runTests(worker.base);
    console.log("\nAll calendar-feed tests passed.");
  } finally {
    await worker.teardown();
  }
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function addMember(base, ownerToken, label) {
  const email = `${label}@example.test`;
  const res = await fetch(`${base}/list-users`, {
    method: "POST", headers: authHeaders(ownerToken),
    body: JSON.stringify({ email, name: label }),
  });
  assert.equal(res.status, 200, "adding a member should succeed");
  const { username, password } = await res.json();
  const loginRes = await fetch(`${base}/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const { token } = await loginRes.json();
  return { username, token };
}

async function planMeal(base, token, plan_date, meal_name, responsible) {
  const res = await fetch(`${base}/plan`, {
    method: "POST", headers: authHeaders(token),
    body: JSON.stringify({ plan_date, meal_name, responsible }),
  });
  assert.equal(res.status, 200, `planning ${plan_date} should succeed`);
}

async function runTests(BASE) {
  await testInactiveByDefault(BASE);
  await testGenerateActivatesAndRevokeDeactivates(BASE);
  await testScopeUpdateDoesNotRotateToken(BASE);
  await testRegenerateInvalidatesOldToken(BASE);
  await testUnknownTokenReturns404(BASE);
  await testFeedContentTypeAndScopeFiltering(BASE);
}

async function testInactiveByDefault(BASE) {
  const username = `cf_default_${RUN_ID}`;
  const { token } = await seedAndLogin(BASE, username, PASS);

  const res = await fetch(`${BASE}/calendar-feed`, { headers: authHeaders(token) });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { active: false, scope: "all" });

  console.log("  - a fresh account has no active calendar feed, scope defaults to 'all'");
}

async function testGenerateActivatesAndRevokeDeactivates(BASE) {
  const username = `cf_lifecycle_${RUN_ID}`;
  const { token } = await seedAndLogin(BASE, username, PASS);

  const genRes = await fetch(`${BASE}/calendar-feed/token`, { method: "POST", headers: authHeaders(token) });
  assert.equal(genRes.status, 200);
  const { token: feedToken } = await genRes.json();
  assert.ok(feedToken, "POST /calendar-feed/token should return a raw token");

  const afterGen = await fetch(`${BASE}/calendar-feed`, { headers: authHeaders(token) });
  assert.deepEqual(await afterGen.json(), { active: true, scope: "all" });

  const feedRes = await fetch(`${BASE}/calendar/${encodeURIComponent(feedToken)}.ics`);
  assert.equal(feedRes.status, 200, "the generated token should serve a live feed");

  const revokeRes = await fetch(`${BASE}/calendar-feed/token`, { method: "DELETE", headers: authHeaders(token) });
  assert.equal(revokeRes.status, 200);

  const afterRevoke = await fetch(`${BASE}/calendar-feed`, { headers: authHeaders(token) });
  assert.deepEqual(await afterRevoke.json(), { active: false, scope: "all" });

  const feedAfterRevoke = await fetch(`${BASE}/calendar/${encodeURIComponent(feedToken)}.ics`);
  assert.equal(feedAfterRevoke.status, 404);
  assert.equal((await feedAfterRevoke.json()).code, "CALENDAR_TOKEN_NOT_FOUND");

  console.log("  - generating activates the feed and serves ICS; revoking deactivates it and 404s the old link");
}

async function testScopeUpdateDoesNotRotateToken(BASE) {
  const username = `cf_scope_${RUN_ID}`;
  const { token } = await seedAndLogin(BASE, username, PASS);

  const genRes = await fetch(`${BASE}/calendar-feed/token`, { method: "POST", headers: authHeaders(token) });
  const { token: feedToken } = await genRes.json();

  const scopeRes = await fetch(`${BASE}/calendar-feed`, {
    method: "POST", headers: authHeaders(token), body: JSON.stringify({ scope: "mine" }),
  });
  assert.equal(scopeRes.status, 200);
  assert.deepEqual(await scopeRes.json(), { scope: "mine" });

  const settingsAfter = await fetch(`${BASE}/calendar-feed`, { headers: authHeaders(token) });
  assert.deepEqual(await settingsAfter.json(), { active: true, scope: "mine" });

  // The link generated before the scope change must still work unchanged.
  const feedRes = await fetch(`${BASE}/calendar/${encodeURIComponent(feedToken)}.ics`);
  assert.equal(feedRes.status, 200, "changing scope must not invalidate the already-issued token");

  const invalidScope = await fetch(`${BASE}/calendar-feed`, {
    method: "POST", headers: authHeaders(token), body: JSON.stringify({ scope: "everyone" }),
  });
  assert.equal(invalidScope.status, 400);
  assert.equal((await invalidScope.json()).code, "INVALID_REQUEST");

  console.log("  - updating scope doesn't rotate the token, and rejects an invalid scope value");
}

async function testRegenerateInvalidatesOldToken(BASE) {
  const username = `cf_regen_${RUN_ID}`;
  const { token } = await seedAndLogin(BASE, username, PASS);

  const first = await (await fetch(`${BASE}/calendar-feed/token`, { method: "POST", headers: authHeaders(token) })).json();
  const second = await (await fetch(`${BASE}/calendar-feed/token`, { method: "POST", headers: authHeaders(token) })).json();
  assert.notEqual(first.token, second.token);

  const oldRes = await fetch(`${BASE}/calendar/${encodeURIComponent(first.token)}.ics`);
  assert.equal(oldRes.status, 404);

  const newRes = await fetch(`${BASE}/calendar/${encodeURIComponent(second.token)}.ics`);
  assert.equal(newRes.status, 200);

  console.log("  - regenerating invalidates the previous token; the new one still works");
}

async function testUnknownTokenReturns404(BASE) {
  const res = await fetch(`${BASE}/calendar/not-a-real-token.ics`);
  assert.equal(res.status, 404);
  assert.equal((await res.json()).code, "CALENDAR_TOKEN_NOT_FOUND");

  console.log("  - an unrecognized token 404s with CALENDAR_TOKEN_NOT_FOUND");
}

async function testFeedContentTypeAndScopeFiltering(BASE) {
  const ownerUsername = `cf_filter_${RUN_ID}`;
  const { token: ownerToken } = await seedAndLogin(BASE, ownerUsername, PASS);
  const { username: memberUsername, token: memberToken } = await addMember(BASE, ownerToken, `cf_filter_m_${RUN_ID}`);

  await planMeal(BASE, ownerToken, "2026-08-03", "Taco", ownerUsername);
  await planMeal(BASE, ownerToken, "2026-08-04", "Soup", memberUsername);

  const genRes = await fetch(`${BASE}/calendar-feed/token`, { method: "POST", headers: authHeaders(ownerToken) });
  const { token: ownerFeedToken } = await genRes.json();

  const allFeedRes = await fetch(`${BASE}/calendar/${encodeURIComponent(ownerFeedToken)}.ics`);
  assert.equal(allFeedRes.status, 200);
  assert.equal(allFeedRes.headers.get("content-type"), "text/calendar; charset=utf-8");
  const allFeed = await allFeedRes.text();
  assert.match(allFeed, /BEGIN:VCALENDAR/);
  assert.ok((allFeed.match(/BEGIN:VEVENT/g) || []).length === 2, "scope=all should include both members' planned days");
  assert.match(allFeed, /SUMMARY:Taco/);
  assert.match(allFeed, /SUMMARY:Soup/);

  await fetch(`${BASE}/calendar-feed`, {
    method: "POST", headers: authHeaders(ownerToken), body: JSON.stringify({ scope: "mine" }),
  });
  const mineFeed = await (await fetch(`${BASE}/calendar/${encodeURIComponent(ownerFeedToken)}.ics`)).text();
  assert.equal((mineFeed.match(/BEGIN:VEVENT/g) || []).length, 1, "scope=mine should include only the owner's own day");
  assert.match(mineFeed, /SUMMARY:Taco/);
  assert.ok(!mineFeed.includes("Soup"), "scope=mine must not include another member's day");

  console.log("  - the feed is served as text/calendar and scope=mine/all filter rows correctly");
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
