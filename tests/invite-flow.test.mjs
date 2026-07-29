// Plain-Node integration test for the invite-link flow: owner-only
// GET/POST/DELETE /list-invites, and public GET /list-invites/:token,
// POST /invite-signup, POST /invite-google (see CLAUDE.md's Testing
// conventions). Spins up the real Worker locally against a local D1 via
// tests/_helpers.mjs.
//
// Every test that calls /invite-signup or /invite-google is given its own
// fake CF-Connecting-IP so it doesn't share the invite_redeem rate-limit
// bucket with any other test in this file (same technique
// signup-recovery.test.mjs uses for its own rate-limit tests) — otherwise
// tests running earlier in the file exhaust the 8/hour bucket for tests
// running later.
//
// Run: node tests/invite-flow.test.mjs
import assert from "node:assert/strict";
import { startWorker, seedAndLogin, runSql } from "./_helpers.mjs";

const PORT = 8806;
const RUN_ID = Date.now().toString(36);
const PASS = "Test-password-123!";

async function main() {
  const worker = await startWorker({ port: PORT });
  try {
    await runTests(worker.base);
    console.log("\nAll invite-flow tests passed.");
  } finally {
    await worker.teardown();
  }
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function login(base, username, password) {
  const res = await fetch(`${base}/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  assert.equal(res.status, 200, `login for ${username} should succeed`);
  return await res.json();
}

// Adds a plain member the old way (POST /list-users, still present and
// unchanged) — used here only to fill a list up for the cap tests and to
// get a non-owner token for the permission-checks test.
async function addMember(base, ownerToken, label) {
  const email = `${label}@example.test`;
  const res = await fetch(`${base}/list-users`, {
    method: "POST", headers: authHeaders(ownerToken),
    body: JSON.stringify({ email, name: label }),
  });
  assert.equal(res.status, 200, "adding a member should succeed");
  const { username, password } = await res.json();
  const { token } = await login(base, username, password);
  return { username, password, token };
}

async function generateInvite(base, ownerToken) {
  const res = await fetch(`${base}/list-invites`, { method: "POST", headers: authHeaders(ownerToken) });
  assert.equal(res.status, 200, "generating an invite should succeed");
  return await res.json();
}

async function redeemInvite(base, token, fields, ip) {
  return fetch(`${base}/invite-signup`, {
    method: "POST", headers: { "Content-Type": "application/json", "CF-Connecting-IP": ip },
    body: JSON.stringify({ token, ...fields }),
  });
}

function inviteFields(label) {
  return { name: label, email: `${label}@example.test`, password: PASS };
}

async function runTests(BASE) {
  await testGenerateShowsActiveAndRevokeClearsIt(BASE);
  await testNonOwnerCannotManageInvites(BASE);
  await testRegenerateInvalidatesOldToken(BASE);
  await testPasswordRedemptionJoinsCorrectList(BASE);
  await testExpiredTokenRejected(BASE);
  await testCapEnforcedAtRedemptionTime(BASE);
  await testInviteSignupValidation(BASE);
  await testInviteSignupRateLimiting(BASE);
  await testInviteGoogleRejectsMalformedCredential(BASE);
  await testInvitePreviewEndpoint(BASE);
}

async function testGenerateShowsActiveAndRevokeClearsIt(BASE) {
  const username = `if_basic_${RUN_ID}`;
  const { token } = await seedAndLogin(BASE, username, PASS);

  const initial = await fetch(`${BASE}/list-invites`, { headers: authHeaders(token) });
  assert.equal(initial.status, 200);
  assert.deepEqual(await initial.json(), { active: false, expires_at: null });

  const generated = await generateInvite(BASE, token);
  assert.ok(generated.token, "POST /list-invites should return a raw token");
  assert.ok(generated.expires_at > Date.now(), "expires_at should be in the future");

  const afterGenerate = await fetch(`${BASE}/list-invites`, { headers: authHeaders(token) });
  const afterGenerateBody = await afterGenerate.json();
  assert.equal(afterGenerateBody.active, true);
  assert.equal(afterGenerateBody.expires_at, generated.expires_at);

  const revokeRes = await fetch(`${BASE}/list-invites`, { method: "DELETE", headers: authHeaders(token) });
  assert.equal(revokeRes.status, 200);

  const afterRevoke = await fetch(`${BASE}/list-invites`, { headers: authHeaders(token) });
  assert.deepEqual(await afterRevoke.json(), { active: false, expires_at: null });

  console.log("  - generate shows active+expiry; revoke clears it back to inactive");
}

async function testNonOwnerCannotManageInvites(BASE) {
  const ownerUsername = `if_nonowner_${RUN_ID}`;
  const { token: ownerToken } = await seedAndLogin(BASE, ownerUsername, PASS);
  const { token: memberToken } = await addMember(BASE, ownerToken, `if_nonowner_m_${RUN_ID}`);

  const getRes = await fetch(`${BASE}/list-invites`, { headers: authHeaders(memberToken) });
  assert.equal(getRes.status, 403);
  assert.equal((await getRes.json()).code, "REQUIRES_OWNER");

  const postRes = await fetch(`${BASE}/list-invites`, { method: "POST", headers: authHeaders(memberToken) });
  assert.equal(postRes.status, 403);
  assert.equal((await postRes.json()).code, "REQUIRES_OWNER");

  const deleteRes = await fetch(`${BASE}/list-invites`, { method: "DELETE", headers: authHeaders(memberToken) });
  assert.equal(deleteRes.status, 403);
  assert.equal((await deleteRes.json()).code, "REQUIRES_OWNER");

  console.log("  - a plain member gets 403 REQUIRES_OWNER on GET/POST/DELETE /list-invites");
}

async function testRegenerateInvalidatesOldToken(BASE) {
  const ip = "10.60.1.1";
  const username = `if_regen_${RUN_ID}`;
  const { token } = await seedAndLogin(BASE, username, PASS);

  const first = await generateInvite(BASE, token);
  const second = await generateInvite(BASE, token);
  assert.notEqual(first.token, second.token);

  const oldRedeem = await redeemInvite(BASE, first.token, inviteFields(`if_regen_old_${RUN_ID}`), ip);
  assert.equal(oldRedeem.status, 400);
  assert.equal((await oldRedeem.json()).code, "INVALID_OR_EXPIRED_INVITE");

  const newRedeem = await redeemInvite(BASE, second.token, inviteFields(`if_regen_new_${RUN_ID}`), ip);
  assert.equal(newRedeem.status, 200, "the newest token should still redeem successfully");

  console.log("  - regenerating an invite invalidates the previous token, the new one still works");
}

async function testPasswordRedemptionJoinsCorrectList(BASE) {
  const ip = "10.60.1.2";
  const ownerUsername = `if_join_${RUN_ID}`;
  const { token: ownerToken } = await seedAndLogin(BASE, ownerUsername, PASS);
  const invite = await generateInvite(BASE, ownerToken);

  const fields = inviteFields(`if_join_new_${RUN_ID}`);
  const res = await redeemInvite(BASE, invite.token, fields, ip);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.user, fields.email);
  assert.equal(body.is_owner, 0, "a redeemed invite must never grant owner");
  assert.equal(body.is_admin, 0, "a redeemed invite must never grant admin");
  assert.ok(body.token, "successful redemption should log the new member in immediately");

  // The new member should now show up in the owner's own list-users.
  const listUsersRes = await fetch(`${BASE}/list-users`, { headers: authHeaders(ownerToken) });
  const listUsers = await listUsersRes.json();
  assert.ok(
    listUsers.some((u) => u.username.toLowerCase() === fields.email.toLowerCase()),
    "the redeemed member should appear in the inviting owner's list"
  );

  // Single-use: the same token can't be redeemed again.
  const replay = await redeemInvite(BASE, invite.token, inviteFields(`if_join_replay_${RUN_ID}`), ip);
  assert.equal(replay.status, 400);
  assert.equal((await replay.json()).code, "INVALID_OR_EXPIRED_INVITE");

  console.log("  - password-path redemption joins the inviter's list as a plain member, and is single-use");
}

async function testExpiredTokenRejected(BASE) {
  const ip = "10.60.1.3";
  const username = `if_expired_${RUN_ID}`;
  const { token } = await seedAndLogin(BASE, username, PASS);
  const invite = await generateInvite(BASE, token);

  // Backdate expires_at directly — waiting 7 real days isn't practical.
  // token_hash isn't known to this test (only the raw token is, and the
  // server only ever stores its hash), so target the sole row for this list
  // instead: expires_at is not unique across lists, but list_id is, and this
  // test's list only ever has one invite row.
  const listIdRes = await fetch(`${BASE}/list-invites`, { headers: authHeaders(token) });
  assert.equal((await listIdRes.json()).active, true, "sanity check: invite should still be active before backdating");
  await runSql(
    `UPDATE list_invites SET expires_at = 1 WHERE token_hash = (SELECT token_hash FROM list_invites WHERE list_id = (SELECT list_id FROM users WHERE username = '${username}' COLLATE NOCASE));`
  );

  const res = await redeemInvite(BASE, invite.token, inviteFields(`if_expired_new_${RUN_ID}`), ip);
  assert.equal(res.status, 400);
  assert.equal((await res.json()).code, "INVALID_OR_EXPIRED_INVITE");

  console.log("  - an expired invite token is rejected");
}

async function testCapEnforcedAtRedemptionTime(BASE) {
  const ip = "10.60.1.4";
  const username = `if_cap_${RUN_ID}`;
  const { token } = await seedAndLogin(BASE, username, PASS);
  const invite = await generateInvite(BASE, token);

  // Fill the list to 10 (owner + 9 members) via the still-present
  // POST /list-users, while the invite generated above stays untouched.
  for (let i = 0; i < 9; i++) {
    const res = await fetch(`${BASE}/list-users`, {
      method: "POST", headers: authHeaders(token),
      body: JSON.stringify({ email: `if_cap_m${i}_${RUN_ID}@example.test`, name: `if_cap_m${i}_${RUN_ID}` }),
    });
    assert.equal(res.status, 200);
  }

  const overflow = await redeemInvite(BASE, invite.token, inviteFields(`if_cap_overflow_${RUN_ID}`), ip);
  assert.equal(overflow.status, 400);
  assert.equal((await overflow.json()).code, "LIST_FULL");

  // The invite must still be untouched by the failed cap check — free a
  // slot and confirm the same token still redeems.
  const removeRes = await fetch(`${BASE}/list-users/${encodeURIComponent(`if_cap_m0_${RUN_ID}@example.test`)}`, {
    method: "DELETE", headers: authHeaders(token),
  });
  assert.equal(removeRes.status, 200);

  const afterFreeing = await redeemInvite(BASE, invite.token, inviteFields(`if_cap_success_${RUN_ID}`), ip);
  assert.equal(afterFreeing.status, 200, "the same invite token should still redeem once a slot frees up");

  console.log("  - the 10-user cap is enforced at redemption time, not just generation time, and a failed cap check doesn't consume the invite");
}

async function testInviteSignupValidation(BASE) {
  const ip = "10.60.1.5";
  const username = `if_valid_${RUN_ID}`;
  const { token } = await seedAndLogin(BASE, username, PASS);
  const invite = await generateInvite(BASE, token);

  const missingName = await redeemInvite(BASE, invite.token, { name: "", email: `if_valid_a_${RUN_ID}@example.test`, password: PASS }, ip);
  assert.equal(missingName.status, 400);
  assert.equal((await missingName.json()).code, "ENTER_NAME");

  const shortPassword = await redeemInvite(BASE, invite.token, { name: "A", email: `if_valid_b_${RUN_ID}@example.test`, password: "short" }, ip);
  assert.equal(shortPassword.status, 400);
  assert.equal((await shortPassword.json()).code, "PASSWORD_TOO_SHORT");

  const badEmail = await redeemInvite(BASE, invite.token, { name: "A", email: "not-an-email", password: PASS }, ip);
  assert.equal(badEmail.status, 400);
  assert.equal((await badEmail.json()).code, "INVALID_EMAIL");

  console.log("  - /invite-signup validates name/password/email before touching the token");
}

async function testInviteSignupRateLimiting(BASE) {
  const ip = "10.60.1.6";
  const username = `if_ratelimit_${RUN_ID}`;
  const { token } = await seedAndLogin(BASE, username, PASS);
  const invite = await generateInvite(BASE, token);

  // 8/hour/IP — burn all 8 with a request that fails validation fast (still
  // counted, since recordAttempt runs regardless of outcome) so this test
  // doesn't need 8 real accounts.
  for (let i = 0; i < 8; i++) {
    const res = await redeemInvite(BASE, invite.token, { name: "", email: "", password: "" }, ip);
    assert.equal(res.status, 400, `attempt ${i + 1}/8 should fail validation, not be rate-limited yet`);
  }
  const overLimit = await redeemInvite(BASE, invite.token, { name: "", email: "", password: "" }, ip);
  assert.equal(overLimit.status, 429);
  assert.equal((await overLimit.json()).code, "TOO_MANY_SIGNUP_ATTEMPTS");

  console.log("  - /invite-signup rate-limits to 8 attempts/hour/IP");
}

async function testInviteGoogleRejectsMalformedCredential(BASE) {
  const ip = "10.60.1.7";
  const username = `if_googlebad_${RUN_ID}`;
  const { token } = await seedAndLogin(BASE, username, PASS);
  const invite = await generateInvite(BASE, token);

  const res = await fetch(`${BASE}/invite-google`, {
    method: "POST", headers: { "Content-Type": "application/json", "CF-Connecting-IP": ip },
    body: JSON.stringify({ token: invite.token, credential: "not.a.jwt" }),
  });
  assert.equal(res.status, 401);
  assert.equal((await res.json()).code, "GOOGLE_SIGNIN_FAILED");

  console.log("  - /invite-google rejects a malformed credential (full success/rejection paths need a real Google ID token — validate on a deploy preview, same known gap as /auth/google's own tests)");
}

async function testInvitePreviewEndpoint(BASE) {
  const username = `if_preview_${RUN_ID}`;
  const { token } = await seedAndLogin(BASE, username, PASS);
  const invite = await generateInvite(BASE, token);

  const previewRes = await fetch(`${BASE}/list-invites/${encodeURIComponent(invite.token)}`);
  assert.equal(previewRes.status, 200);
  const preview = await previewRes.json();
  assert.equal(preview.inviter_name, username, "inviter_name should fall back to username when no display name is set");

  const badPreviewRes = await fetch(`${BASE}/list-invites/not-a-real-token`);
  assert.equal(badPreviewRes.status, 400);
  assert.equal((await badPreviewRes.json()).code, "INVALID_OR_EXPIRED_INVITE");

  console.log("  - GET /list-invites/:token previews a valid invite and rejects an invalid one");
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
