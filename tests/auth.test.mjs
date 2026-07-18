// Plain-Node integration test for login, token_version invalidation, and
// login/change-password rate limiting (see CLAUDE.md's Testing conventions).
// Spins up the real Worker locally against a local D1 via tests/_helpers.mjs.
//
// Run: node tests/auth.test.mjs
import assert from "node:assert/strict";
import { startWorker, bootstrapAccount } from "./_helpers.mjs";

const PORT = 8800;
// Base36 keeps test labels short even with a descriptive prefix (a 13-digit
// decimal timestamp alone already eats most of a readable line). RUN_ID_NUM
// (the raw epoch ms) is kept separately for the synthetic-IP octet math
// below, which needs a number.
const RUN_ID_NUM = Date.now();
const RUN_ID = RUN_ID_NUM.toString(36);
const PASS = "Test-password-123!";

async function main() {
  const worker = await startWorker({ port: PORT });
  try {
    await runTests(worker.base);
    console.log("\nAll auth tests passed.");
  } finally {
    await worker.teardown();
  }
}

function login(base, username, password, extraHeaders = {}) {
  return fetch(`${base}/login`, {
    method: "POST", headers: { "Content-Type": "application/json", ...extraHeaders },
    body: JSON.stringify({ username, password }),
  });
}

function authedGet(base, path, token) {
  return fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}` } });
}

async function tokenFor(base, username, password) {
  const res = await login(base, username, password);
  assert.equal(res.status, 200, `login for ${username} should succeed`);
  return (await res.json()).token;
}

// Adds a plain member to `ownerToken`'s list via POST /list-users, logs them
// in, and returns their username + token. Owner-only endpoint, so ownerToken
// must belong to an owner. `label` becomes the member's e-mail local part
// (username always mirrors e-mail — see TODO #17) and display name.
async function addMemberAndLogin(base, ownerToken, label) {
  const email = `${label}@example.test`;
  const res = await fetch(`${base}/list-users`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ownerToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, name: label }),
  });
  assert.equal(res.status, 200, "adding a member should succeed");
  const { username, password } = await res.json();
  return { username, password, token: await tokenFor(base, username, password) };
}

async function runTests(BASE) {
  await testLoginSuccessAndFailure(BASE);
  await testLoginRateLimiting(BASE);
  await testTokenVersionOnChangePassword(BASE);
  await testTokenVersionOnAdminResetPassword(BASE);
  await testTokenVersionOnFlagsPatch(BASE);
  await testChangePasswordRateLimiting(BASE);
  await testSlidingRefreshTokenHeader(BASE);
  await testChangePasswordMinLength(BASE);
}

async function testLoginSuccessAndFailure(BASE) {
  const username = `auth_login_${RUN_ID}`;
  await bootstrapAccount(BASE, username, PASS);

  let res = await login(BASE, username, PASS);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.user, username);
  assert.equal(body.is_admin, 1, "a freshly bootstrapped account is admin of its own list");
  assert.equal(body.is_owner, 1, "a freshly bootstrapped account is owner of its own list");
  assert.ok(body.token);
  assert.equal(typeof body.list_id, "number");

  res = await login(BASE, username, "wrong-password");
  assert.equal(res.status, 401);
  const wrongPassBody = await res.json();

  res = await login(BASE, `auth_nonexistent_${RUN_ID}`, "whatever");
  assert.equal(res.status, 401);
  const unknownUserBody = await res.json();
  assert.equal(
    unknownUserBody.error, wrongPassBody.error,
    "wrong-password and unknown-username must return an identical generic error (no username enumeration)"
  );

  console.log("  - login: success returns correct fields; wrong password and unknown username are both 401 with an identical generic error");
}

async function testLoginRateLimiting(BASE) {
  // A synthetic, unique-to-this-run IP so this test's lockout doesn't pollute
  // the shared "unknown" bucket used by every other unheadered request in
  // this file/other test files sharing the same local D1.
  const ip = `10.42.${RUN_ID_NUM % 250}.1`;
  const username = `auth_ratelimit_${RUN_ID}`;
  await bootstrapAccount(BASE, username, PASS);

  for (let i = 0; i < 10; i++) {
    const res = await login(BASE, username, "wrong", { "CF-Connecting-IP": ip });
    assert.equal(res.status, 401, `attempt ${i + 1} should be a normal failed login, not yet rate-limited`);
  }

  // The 11th attempt, even with the correct password, must be blocked.
  const res = await login(BASE, username, PASS, { "CF-Connecting-IP": ip });
  assert.equal(res.status, 429);
  const body = await res.json();
  assert.match(body.error, /mange innloggingsforsøk/i);

  console.log("  - login rate limiting: the 11th attempt within the window is blocked (429), even with the correct password");
}

async function testTokenVersionOnChangePassword(BASE) {
  const username = `auth_tv_pw_${RUN_ID}`;
  await bootstrapAccount(BASE, username, PASS);
  const token = await tokenFor(BASE, username, PASS);

  const changeRes = await fetch(`${BASE}/change-password`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ current_password: PASS, new_password: "New-password-456!" }),
  });
  assert.equal(changeRes.status, 200);
  const changeBody = await changeRes.json();
  assert.ok(changeBody.token, "change-password should return a fresh token in the response body");
  assert.equal(
    changeRes.headers.get("X-Refresh-Token"), null,
    "change-password must not also carry X-Refresh-Token; the body token is authoritative"
  );

  assert.equal(
    (await authedGet(BASE, "/list-users", token)).status, 401,
    "the pre-change-password token should be invalidated"
  );
  assert.equal(
    (await authedGet(BASE, "/list-users", changeBody.token)).status, 200,
    "the fresh token from change-password's response body should work"
  );

  console.log("  - token_version bump: changing your own password invalidates the old token");
}

async function testTokenVersionOnAdminResetPassword(BASE) {
  const adminUsername = `auth_tv_admin_${RUN_ID}`;
  await bootstrapAccount(BASE, adminUsername, PASS);
  const adminToken = await tokenFor(BASE, adminUsername, PASS);
  const { username: memberUsername, token: memberTokenBefore } =
    await addMemberAndLogin(BASE, adminToken, `auth_tv_member_${RUN_ID}`);

  const resetRes = await fetch(`${BASE}/admin/users/${encodeURIComponent(memberUsername)}/reset-password`, {
    method: "POST", headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
  });
  assert.equal(resetRes.status, 200);
  const { password: newPassword } = await resetRes.json();

  assert.equal(
    (await authedGet(BASE, "/list-users", memberTokenBefore)).status, 401,
    "the member's pre-reset token should be invalidated once an admin resets their password"
  );
  assert.equal((await login(BASE, memberUsername, newPassword)).status, 200, "the new password should work");

  console.log("  - token_version bump: an admin resetting a target's password invalidates the target's old token");
}

async function testTokenVersionOnFlagsPatch(BASE) {
  const adminUsername = `auth_tv_flagsadmin_${RUN_ID}`;
  await bootstrapAccount(BASE, adminUsername, PASS);
  const adminToken = await tokenFor(BASE, adminUsername, PASS);
  const { username: memberUsername, token: memberTokenBefore } =
    await addMemberAndLogin(BASE, adminToken, `auth_tv_flagsmember_${RUN_ID}`);

  const patchRes = await fetch(`${BASE}/admin/users/${encodeURIComponent(memberUsername)}/flags`, {
    method: "PATCH", headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ is_owner: true }),
  });
  assert.equal(patchRes.status, 200);

  assert.equal(
    (await authedGet(BASE, "/list-users", memberTokenBefore)).status, 401,
    "the target's pre-PATCH token should be invalidated after any flag change"
  );

  console.log("  - token_version bump: an admin flags PATCH invalidates the target's old token");
}

async function testChangePasswordRateLimiting(BASE) {
  // Distinct synthetic IP from testLoginRateLimiting's, so the two lockouts
  // don't interfere with each other.
  const ip = `10.43.${RUN_ID_NUM % 250}.1`;
  const username = `auth_cp_ratelimit_${RUN_ID}`;
  await bootstrapAccount(BASE, username, PASS);
  const token = await tokenFor(BASE, username, PASS);

  for (let i = 0; i < 10; i++) {
    const res = await fetch(`${BASE}/change-password`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "CF-Connecting-IP": ip },
      body: JSON.stringify({ current_password: "wrong-current-password", new_password: "New-password-999!" }),
    });
    // 403, not 401: the token is valid, only the current_password is wrong
    // (a 401 would trip the frontend's force-logout-on-expiry path).
    assert.equal(res.status, 403, `attempt ${i + 1} should be a normal wrong-current-password failure`);
  }

  const res = await fetch(`${BASE}/change-password`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "CF-Connecting-IP": ip },
    body: JSON.stringify({ current_password: PASS, new_password: "New-password-999!" }),
  });
  assert.equal(
    res.status, 429,
    "change-password shares /login's per-IP throttle: the 11th attempt is blocked even with the correct current password"
  );

  console.log("  - change-password rate limiting: shares the same per-IP throttle as /login");
}

async function testSlidingRefreshTokenHeader(BASE) {
  const username = `auth_refresh_${RUN_ID}`;
  await bootstrapAccount(BASE, username, PASS);
  const token = await tokenFor(BASE, username, PASS);

  const res = await authedGet(BASE, "/list-users", token);
  assert.equal(res.status, 200);
  const refreshed = res.headers.get("X-Refresh-Token");
  assert.ok(refreshed, "authenticated responses should carry a fresh X-Refresh-Token header");
  assert.equal((await authedGet(BASE, "/list-users", refreshed)).status, 200, "the refreshed token should itself be usable");

  console.log("  - sliding expiry: authenticated responses carry a usable X-Refresh-Token header");
}

async function testChangePasswordMinLength(BASE) {
  // Standardized to match /register and /reset-password's 8-char floor (see
  // TODO #83) — previously change-password only required 6.
  const username = `auth_cp_minlen_${RUN_ID}`;
  await bootstrapAccount(BASE, username, PASS);
  const token = await tokenFor(BASE, username, PASS);

  const shortRes = await fetch(`${BASE}/change-password`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ current_password: PASS, new_password: "Sh0rt-1" }),
  });
  assert.equal(shortRes.status, 400, "a 7-char new password should be rejected");
  const shortBody = await shortRes.json();
  assert.match(shortBody.error, /minst 8 tegn/i);

  const okRes = await fetch(`${BASE}/change-password`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ current_password: PASS, new_password: "8-chars!" }),
  });
  assert.equal(okRes.status, 200, "an 8-char new password should be accepted");

  console.log("  - change-password: rejects new passwords under 8 chars, matching /register and /reset-password");
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
