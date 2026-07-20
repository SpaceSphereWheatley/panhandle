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

function login(base, username, password) {
  return fetch(`${base}/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
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
  await testChangeEmailRenamesUsernameEverywhere(BASE);
}

async function testRegisterValidation(BASE) {
  // Format validation runs before the Turnstile network round-trip, so these
  // are exercised without needing a real (reachable) Turnstile verification.
  // Username is always the e-mail (see TODO #17) — there's no separate
  // username field to validate anymore, just name/password/email.
  let res = await register(BASE, { name: "", password: PASS, email: "a@b.com" });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /navn/i);

  res = await register(BASE, { name: `Reg Shortpw ${RUN_ID}`, password: "short", email: "a@b.com" });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /passord/i);

  res = await register(BASE, { name: `Reg Bademail ${RUN_ID}`, password: PASS, email: "not-an-email" });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /e-post/i);

  console.log("  - /register: rejects missing name, weak password, and malformed email (400) before touching Turnstile");
}

async function testRegisterMissingTurnstileToken(BASE) {
  // No turnstile_token at all short-circuits verifyTurnstile before any
  // network call, so this is reachable even where Turnstile's siteverify
  // endpoint itself isn't.
  const res = await register(BASE, {
    name: `Reg Noturnstile ${RUN_ID}`, password: PASS, email: `reg_noturnstile_${RUN_ID}@example.com`,
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
      name: `Reg Rl ${RUN_ID} ${i}`, password: PASS, email: `reg_rl_${RUN_ID}_${i}@example.com`,
    }, { "CF-Connecting-IP": ip });
    assert.equal(res.status, 403, `attempt ${i + 1} should fail on the missing-Turnstile-token check, not be rate-limited yet`);
  }

  const res = await register(BASE, {
    name: `Reg Rl ${RUN_ID} over`, password: PASS, email: `reg_rl_${RUN_ID}_over@example.com`,
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
  assert.equal((await res.json()).email, null, "an admin/owner-bootstrapped account starts with no email on file");

  res = await fetch(`${BASE}/change-email`, {
    method: "POST", headers: auth,
    body: JSON.stringify({ current_password: "wrong-password", email: `${username}@example.com` }),
  });
  // 403 (not 401): the token is valid, the supplied current_password is
  // wrong — /change-email returns 403 there on purpose, since api()
  // force-logs-out on any 401 (see worker/index.js's /change-email note).
  assert.equal(res.status, 403, "wrong current_password should be rejected");

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
  const changeBody = await res.json();
  assert.equal(changeBody.email, `${username}@example.com`);
  // Username always mirrors e-mail (see TODO #17) — changing it renames the
  // account, so the old token's `sub` (the pre-change username) is now
  // dangling and a fresh one comes back in the body instead, same pattern as
  // /change-password.
  assert.equal(changeBody.username, `${username}@example.com`, "username should now mirror the new e-mail");
  assert.ok(changeBody.token, "/change-email should return a fresh token since the username changed");
  assert.equal(
    res.headers.get("X-Refresh-Token"), null,
    "change-email must not also carry X-Refresh-Token; the body token is authoritative (the header one would carry the stale pre-rename username)"
  );

  assert.equal((await fetch(`${BASE}/list-users`, { headers: auth })).status, 401,
    "the pre-change-email token (old username) should be invalidated");
  const freshAuth = { Authorization: `Bearer ${changeBody.token}`, "Content-Type": "application/json" };
  assert.equal((await fetch(`${BASE}/list-users`, { headers: freshAuth })).status, 200,
    "the fresh token from change-email's response body should work");

  res = await fetch(`${BASE}/account`, { headers: freshAuth });
  assert.equal((await res.json()).email, `${username}@example.com`, "the saved email should be reflected back by GET /account");

  // otherUsername tries to claim the same email already set on `username`.
  res = await fetch(`${BASE}/change-email`, {
    method: "POST", headers: otherAuth,
    body: JSON.stringify({ current_password: PASS, email: `${username}@example.com` }),
  });
  assert.equal(res.status, 409, "an email already in use by another account should be rejected");

  console.log("  - /account + /change-email: starts empty, requires correct current password, validates format, saves and reflects the new email, renames the username (fresh token in the body, old token invalidated), and enforces cross-account email uniqueness");
}

// /change-email's username rename isn't a single-column UPDATE — username is
// copied by value into list_items.added_by and meal_plan.responsible (see
// TODO #17's renameUsername helper), so a stale value left behind in either
// would silently mis-attribute past activity to a username nobody can log in
// as anymore.
async function testChangeEmailRenamesUsernameEverywhere(BASE) {
  const username = `ren_${RUN_ID}`;
  const { auth, token } = await seedAndLogin(BASE, username, PASS);

  const addRes = await fetch(`${BASE}/list`, {
    method: "POST", headers: auth,
    body: JSON.stringify({ name: `Rename test item ${RUN_ID}`, category: "Annet" }),
  });
  assert.equal(addRes.status, 200, "seeding a shopping-list item should succeed");

  // GET /plan opportunistically prunes rows older than 14 days on every read
  // (see CLAUDE.md's Data flow) — today's date keeps this row alive for the
  // GET below instead of getting swept before it can be asserted on.
  const planDate = new Date().toISOString().slice(0, 10);
  const planRes = await fetch(`${BASE}/plan`, {
    method: "POST", headers: auth,
    body: JSON.stringify({ plan_date: planDate, meal_name: `Rename test meal ${RUN_ID}`, responsible: username }),
  });
  assert.equal(planRes.status, 200, "seeding a meal-plan day should succeed");

  const newEmail = `${username}@example.com`;
  const changeRes = await fetch(`${BASE}/change-email`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ current_password: PASS, email: newEmail }),
  });
  assert.equal(changeRes.status, 200);
  const { token: freshToken } = await changeRes.json();
  const freshAuth = { Authorization: `Bearer ${freshToken}` };

  const list = await (await fetch(`${BASE}/list`, { headers: freshAuth })).json();
  const item = list.find((i) => i.name === `Rename test item ${RUN_ID}`);
  assert.ok(item, "the seeded item should still be on the list");
  assert.equal(item.added_by, newEmail, "list_items.added_by should be renamed to the new e-mail, not left as the old username");

  const plan = await (await fetch(`${BASE}/plan?from=${planDate}&to=${planDate}`, { headers: freshAuth })).json();
  assert.equal(plan[0]?.responsible, newEmail, "meal_plan.responsible should be renamed to the new e-mail, not left as the old username");

  assert.equal((await login(BASE, username, PASS)).status, 401, "logging in with the old (pre-rename) username should fail");
  assert.equal((await login(BASE, newEmail, PASS)).status, 200, "logging in with the new e-mail should succeed");

  console.log("  - /change-email cascades the username rename into list_items.added_by and meal_plan.responsible, and the old username can no longer log in");
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
