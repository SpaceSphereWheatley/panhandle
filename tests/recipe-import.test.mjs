// Plain-Node integration test for POST /recipe-import (see CLAUDE.md's Testing
// conventions). Spins up the real Worker locally against a local D1 via
// tests/_helpers.mjs.
//
// Coverage gap, by design: actually fetching a live third-party recipe URL
// and asserting a successful parse isn't covered here — there's no
// HTTP-mocking infra in this repo's integration harness, and pointing at a
// real recipe site would make this flaky/slow (an 8s fetch timeout budget)
// and dependent on someone else's markup never changing. The JSON-LD
// extraction logic itself (parseRecipeFromHtml) is covered by no-network
// fixtures in tests/worker-unit.test.mjs; a real end-to-end fetch is
// validated manually on a deploy preview against 1-2 real recipe URLs before
// merging, same reasoning as feedback.test.mjs's documented gap around a real
// Resend send. This file covers everything reachable without live network:
// auth requirement, input validation, and rate limiting (which is recorded
// before URL validation, so it's exercisable with garbage URLs).
//
// Run: node tests/recipe-import.test.mjs
import assert from "node:assert/strict";
import { startWorker, seedAndLogin } from "./_helpers.mjs";

const PORT = 8809;
const RUN_ID = Date.now().toString(36);
const PASS = "Test-password-123!";

async function main() {
  const worker = await startWorker({ port: PORT });
  try {
    await runTests(worker.base);
    console.log("\nAll recipe-import tests passed.");
  } finally {
    await worker.teardown();
  }
}

function authHeaders(token, extra = {}) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...extra };
}

function importRecipe(base, token, url, extraHeaders = {}) {
  return fetch(`${base}/recipe-import`, {
    method: "POST", headers: authHeaders(token, extraHeaders),
    body: JSON.stringify({ url }),
  });
}

async function runTests(BASE) {
  await testRequiresAuth(BASE);
  await testValidation(BASE);
  await testRateLimiting(BASE);
}

async function testRequiresAuth(BASE) {
  const res = await fetch(`${BASE}/recipe-import`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: "https://example.com/recipe" }),
  });
  assert.equal(res.status, 401);

  console.log("  - requires authentication (401 with no token)");
}

async function testValidation(BASE) {
  const { token } = await seedAndLogin(BASE, `ri_valid_${RUN_ID}`, PASS);

  const missingRes = await importRecipe(BASE, token, undefined, { "CF-Connecting-IP": "10.61.1.1" });
  assert.equal(missingRes.status, 400);
  assert.equal((await missingRes.json()).code, "INVALID_RECIPE_URL");

  const notUrlRes = await importRecipe(BASE, token, "not a url", { "CF-Connecting-IP": "10.61.1.2" });
  assert.equal(notUrlRes.status, 400);
  assert.equal((await notUrlRes.json()).code, "INVALID_RECIPE_URL");

  const fileSchemeRes = await importRecipe(BASE, token, "file:///etc/passwd", { "CF-Connecting-IP": "10.61.1.3" });
  assert.equal(fileSchemeRes.status, 400);
  assert.equal((await fileSchemeRes.json()).code, "INVALID_RECIPE_URL");

  const jsSchemeRes = await importRecipe(BASE, token, "javascript:alert(1)", { "CF-Connecting-IP": "10.61.1.4" });
  assert.equal(jsSchemeRes.status, 400);
  assert.equal((await jsSchemeRes.json()).code, "INVALID_RECIPE_URL");

  console.log("  - rejects a missing url, a non-URL string, and disallowed schemes (400 INVALID_RECIPE_URL)");
}

async function testRateLimiting(BASE) {
  const { token } = await seedAndLogin(BASE, `ri_ratelimit_${RUN_ID}`, PASS);
  const ip = `10.61.2.${Date.now() % 250}`;

  // Invalid URLs fail validation (400) but still count toward the limit —
  // recordAttempt runs right after body parse, before URL validation.
  for (let i = 0; i < 20; i++) {
    const res = await importRecipe(BASE, token, "not a url", { "CF-Connecting-IP": ip });
    assert.equal(res.status, 400, `attempt ${i + 1} should fail validation, not be rate-limited yet`);
  }

  const overRes = await importRecipe(BASE, token, "not a url", { "CF-Connecting-IP": ip });
  assert.equal(overRes.status, 429);
  assert.equal((await overRes.json()).code, "TOO_MANY_RECIPE_IMPORTS");

  console.log("  - rate limiting: the 21st attempt within the window is blocked (429), even on invalid urls");
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
