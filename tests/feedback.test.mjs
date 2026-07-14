// Plain-Node integration test for POST /feedback (see CLAUDE.md's Testing
// conventions). Spins up the real Worker locally against a local D1 via
// tests/_helpers.mjs.
//
// Coverage gap, by design: an actual successful send requires a real
// RESEND_API_KEY and a live round-trip to Resend's API, same reasoning as
// signup-recovery.test.mjs's documented gap for /register and
// /forgot-password's Turnstile-gated success paths — validated manually on a
// deploy preview instead. This file covers everything reachable without
// that: auth requirement, input validation, the "not configured" case, and
// rate limiting (which is recorded before the RESEND/FEEDBACK_EMAIL checks,
// so it's exercisable without ever reaching sendEmail()).
//
// Run: node tests/feedback.test.mjs
import assert from "node:assert/strict";
import { startWorker, seedAndLogin } from "./_helpers.mjs";

const PORT = 8805;
const RUN_ID = Date.now().toString(36);
const PASS = "Test-password-123!";

async function main() {
  const worker = await startWorker({ port: PORT });
  try {
    await runTests(worker.base);
    console.log("\nAll feedback tests passed.");
  } finally {
    await worker.teardown();
  }
}

function authHeaders(token, extra = {}) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...extra };
}

function sendFeedback(base, token, message, extraHeaders = {}) {
  return fetch(`${base}/feedback`, {
    method: "POST", headers: authHeaders(token, extraHeaders),
    body: JSON.stringify({ message }),
  });
}

async function runTests(BASE) {
  await testRequiresAuth(BASE);
  await testValidation(BASE);
  await testNotConfigured(BASE);
  await testRateLimiting(BASE);
}

async function testRequiresAuth(BASE) {
  const res = await fetch(`${BASE}/feedback`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Hei" }),
  });
  assert.equal(res.status, 401);

  console.log("  - requires authentication (401 with no token)");
}

async function testValidation(BASE) {
  const { token } = await seedAndLogin(BASE, `fb_valid_${RUN_ID}`, PASS);

  const emptyRes = await sendFeedback(BASE, token, "   ", { "CF-Connecting-IP": `10.60.1.1` });
  assert.equal(emptyRes.status, 400);
  assert.match((await emptyRes.json()).error, /melding/i);

  const tooLongRes = await sendFeedback(BASE, token, "x".repeat(4001), { "CF-Connecting-IP": `10.60.1.2` });
  assert.equal(tooLongRes.status, 400);
  assert.match((await tooLongRes.json()).error, /for lang/i);

  console.log("  - rejects an empty/whitespace-only message and one over 4000 characters (400)");
}

async function testNotConfigured(BASE) {
  // This test's own .dev.vars never sets FEEDBACK_EMAIL, matching a fresh
  // deploy before the manual one-time setup CLAUDE.md describes for
  // RESEND_API_KEY/TURNSTILE_SECRET_KEY/SUPERADMIN_USERNAMES.
  const { token } = await seedAndLogin(BASE, `fb_unconfigured_${RUN_ID}`, PASS);

  const res = await sendFeedback(BASE, token, "Dette er en tilbakemelding.", { "CF-Connecting-IP": `10.60.2.1` });
  assert.equal(res.status, 500);
  assert.match((await res.json()).error, /ikke satt opp/i);

  console.log("  - returns a clear 500 (not a silent failure) when FEEDBACK_EMAIL isn't configured");
}

async function testRateLimiting(BASE) {
  const { token } = await seedAndLogin(BASE, `fb_ratelimit_${RUN_ID}`, PASS);
  const ip = `10.60.3.${Date.now() % 250}`;

  // Empty messages fail validation (400) but still count toward the limit —
  // recordAttempt runs right after body parse, before message validation.
  for (let i = 0; i < 5; i++) {
    const res = await sendFeedback(BASE, token, "", { "CF-Connecting-IP": ip });
    assert.equal(res.status, 400, `attempt ${i + 1} should fail validation, not be rate-limited yet`);
  }

  const overRes = await sendFeedback(BASE, token, "Hei", { "CF-Connecting-IP": ip });
  assert.equal(overRes.status, 429);
  assert.match((await overRes.json()).error, /mange tilbakemeldinger/i);

  console.log("  - rate limiting: the 6th attempt within the window is blocked (429), even on invalid messages");
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
