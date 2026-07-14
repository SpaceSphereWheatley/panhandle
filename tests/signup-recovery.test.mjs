// Plain-Node integration test for self-service signup (/register), Google
// sign-in (/auth/google), password recovery (/forgot-password,
// /reset-password), and self-service email (/account, /change-email) — see
// CLAUDE.md's Testing conventions. Spins up the real Worker locally against
// a local D1 via tests/_helpers.mjs.
//
// Coverage gap, by design: /register's and /forgot-password's *success*
// paths require Cloudflare Turnstile to actually verify a token, which means
// a live network round-trip to challenges.cloudflare.com; and a real
// end-to-end /auth/google login requires a freshly-issued Google ID token
// from an actual Google sign-in, which isn't scriptable. Both are validated
// manually on a deploy preview instead (see the PR description). This file
// covers everything reachable without those: input validation, rate
// limiting, the Turnstile/Google-token rejection paths (which fail before
// any external call), and the fully self-contained /account+/change-email
// flow.
//
// Run: node tests/signup-recovery.test.mjs
import assert from "node:assert/strict";
import { startWorker, seedAndLogin } from "./_helpers.mjs";

const PORT = 8802;
const RUN_ID = Date.now().toString(36);
const PASS = "Test-password-123!";

async function main() {
  const worker = await startWorker({ port: PORT });
  try {
    await runTests(worker.base);
    console.log("\nAll signup/recovery tests passed.");
  } finally {
    await worker.teardown();
  }
}

function register(base, body, extraHeaders = {}) {
  return fetch(`${base}/register`, {
    method: "POST", headers: { "Content-Type": "application/json", ...extraHeaders },
    body: JSON.stringify(body),
  });
}

function forgotPassword(base, body, extraHeaders = {}) {
  return fetch(`${base}/forgot-password`, {
    method: "POST", headers: { "Content-Type": "application/json", ...extraHeaders },
    body: JSON.stringify(body),
  });
}

async function runTests(BASE) {
  await testRegisterValidation(BASE);
  await testRegisterMissingTurnstileToken(BASE);
  await testRegisterRateLimiting(BASE);
  await testForgotPasswordMissingTurnstileToken(BASE);
  await testForgotPasswordRateLimiting(BASE);
  await testResetPasswordInvalidToken(BASE);
  await testGoogleAuthRejectsMalformedCredential(BASE);
  await testAccountAndChangeEmail(BASE);
}

async function testRegisterValidation(BASE) {
  // Format validation runs before the Turnstile network round-trip, so these
  // are exercised without needing a real (reachable) Turnstile verification.
  let res = await register(BASE, { username: "!!!", password: PASS, email: "a@b.com" });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /brukernavn/i);

  res = await register(BASE, { username: `reg_shortpw_${RUN_ID}`, password: "short", email: "a@b.com" });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /passord/i);

  res = await register(BASE, { username: `reg_bademail_${RUN_ID}`, password: PASS, email: "not-an-email" });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /e-post/i);

  console.log("  - /register: rejects invalid username, weak password, and malformed email (400) before touching Turnstile");
}

async function testRegisterMissingTurnstileToken(BASE) {
  // No turnstile_token at all short-circuits verifyTurnstile before any
  // network call, so this is reachable even where Turnstile's siteverify
  // endpoint itself isn't.
  const res = await register(BASE, {
    username: `reg_noturnstile_${RUN_ID}`, password: PASS, email: `reg_noturnstile_${RUN_ID}@example.com`,
  });
  assert.equal(res.status, 403);
  assert.match((await res.json()).error, /bot-verifisering/i);

  console.log("  - /register: missing turnstile_token is rejected (403) without needing a live Turnstile round-trip");
}

async function testRegisterRateLimiting(BASE) {
  const ip = `10.50.${Date.now() % 250}.1`;
  // Every call counts toward the limit regardless of outcome (unlike
  // login_attempts, which only counts failures) — 8/hour is the threshold.
  for (let i = 0; i < 8; i++) {
    const res = await register(BASE, {
      username: `reg_rl_${RUN_ID}_${i}`, password: PASS, email: `reg_rl_${RUN_ID}_${i}@example.com`,
    }, { "CF-Connecting-IP": ip });
    assert.equal(res.status, 403, `attempt ${i + 1} should fail on the missing-Turnstile-token check, not be rate-limited yet`);
  }

  const res = await register(BASE, {
    username: `reg_rl_${RUN_ID}_over`, password: PASS, email: `reg_rl_${RUN_ID}_over@example.com`,
  }, { "CF-Connecting-IP": ip });
  assert.equal(res.status, 429);
  assert.match((await res.json()).error, /mange registreringsforsøk/i);

  console.log("  - /register rate limiting: the 9th attempt within the window is blocked (429), even before Turnstile is checked");
}

async function testForgotPasswordMissingTurnstileToken(BASE) {
  const res = await forgotPassword(BASE, { email: "whoever@example.com" });
  assert.equal(res.status, 403);
  assert.match((await res.json()).error, /bot-verifisering/i);

  console.log("  - /forgot-password: missing turnstile_token is rejected (403) without needing a live Turnstile round-trip");
}

async function testForgotPasswordRateLimiting(BASE) {
  const ip = `10.51.${Date.now() % 250}.1`;
  for (let i = 0; i < 5; i++) {
    const res = await forgotPassword(BASE, { email: `fp_rl_${RUN_ID}_${i}@example.com` }, { "CF-Connecting-IP": ip });
    assert.equal(res.status, 403, `attempt ${i + 1} should fail on the missing-Turnstile-token check, not be rate-limited yet`);
  }

  const res = await forgotPassword(BASE, { email: `fp_rl_${RUN_ID}_over@example.com` }, { "CF-Connecting-IP": ip });
  assert.equal(res.status, 429);
  assert.match((await res.json()).error, /mange forsøk/i);

  console.log("  - /forgot-password rate limiting: the 6th attempt within the window is blocked (429)");
}

async function testResetPasswordInvalidToken(BASE) {
  const res = await fetch(`${BASE}/reset-password`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: "not-a-real-token", new_password: "New-password-456!" }),
  });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /ugyldig eller utløpt/i);

  console.log("  - /reset-password: an unknown/invalid token is rejected (400), fully offline");
}

async function testGoogleAuthRejectsMalformedCredential(BASE) {
  // A garbage credential fails to even parse as a JWT, which is rejected
  // before verifyGoogleIdToken ever fetches Google's JWKS — so this is
  // reachable without a real Google sign-in or live network access.
  const res = await fetch(`${BASE}/auth/google`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential: "not.a.jwt" }),
  });
  assert.equal(res.status, 401);
  assert.match((await res.json()).error, /google-innlogging/i);

  console.log("  - /auth/google: a malformed credential is rejected (401) without needing a live Google token");
}

async function testAccountAndChangeEmail(BASE) {
  const username = `acct_${RUN_ID}`;
  const otherUsername = `acct_other_${RUN_ID}`;
  const { auth } = await seedAndLogin(BASE, username, PASS);
  const { auth: otherAuth } = await seedAndLogin(BASE, otherUsername, PASS);

  let res = await fetch(`${BASE}/account`, { headers: auth });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).email, null, "a /seed-created account starts with no email on file");

  res = await fetch(`${BASE}/change-email`, {
    method: "POST", headers: auth,
    body: JSON.stringify({ current_password: "wrong-password", email: `${username}@example.com` }),
  });
  assert.equal(res.status, 401, "wrong current_password should be rejected");

  res = await fetch(`${BASE}/change-email`, {
    method: "POST", headers: auth,
    body: JSON.stringify({ current_password: PASS, email: "not-an-email" }),
  });
  assert.equal(res.status, 400, "a malformed email should be rejected");

  res = await fetch(`${BASE}/change-email`, {
    method: "POST", headers: auth,
    body: JSON.stringify({ current_password: PASS, email: `${username}@example.com` }),
  });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).email, `${username}@example.com`);

  res = await fetch(`${BASE}/account`, { headers: auth });
  assert.equal((await res.json()).email, `${username}@example.com`, "the saved email should be reflected back by GET /account");

  // otherUsername tries to claim the same email already set on `username`.
  res = await fetch(`${BASE}/change-email`, {
    method: "POST", headers: otherAuth,
    body: JSON.stringify({ current_password: PASS, email: `${username}@example.com` }),
  });
  assert.equal(res.status, 409, "an email already in use by another account should be rejected");

  console.log("  - /account + /change-email: starts empty, requires correct current password, validates format, saves and reflects the new email, and enforces cross-account email uniqueness");
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
