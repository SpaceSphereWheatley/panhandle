// Plain-Node integration test for admin/owner permission logic: last-admin
// demotion protection, last-owner removal protection (both code paths),
// the 10-user list cap, server-forced-zero member flags, and permission
// checks on admin/owner-gated endpoints (see CLAUDE.md's Testing conventions).
// Spins up the real Worker locally against a local D1 via tests/_helpers.mjs.
//
// Run: node tests/admin-owner.test.mjs
import assert from "node:assert/strict";
import { startWorker, seedAndLogin } from "./_helpers.mjs";

const PORT = 8801;
// Base36 keeps test labels short even with a descriptive prefix (a 13-digit
// decimal timestamp alone already eats most of a readable line).
const RUN_ID = Date.now().toString(36);
const PASS = "Test-password-123!";
// The one account this test's own .dev.vars grants isSuperAdmin to — every
// other admin created in this run is an ordinary (list-scoped) admin only.
const SUPERADMIN_USERNAME = `ao_superadmin_${RUN_ID}`;

async function main() {
  const worker = await startWorker({
    port: PORT,
    extraDevVars: `SUPERADMIN_USERNAMES=${SUPERADMIN_USERNAME}\n`,
  });
  try {
    await runTests(worker.base);
    console.log("\nAll admin/owner tests passed.");
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

// Adds a plain member to `ownerToken`'s list, returns {username, password, token}.
// `label` becomes the member's e-mail local part (username always mirrors
// e-mail — see TODO #17) and doubles as their display name.
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

async function patchFlags(base, adminToken, targetUsername, flags) {
  return fetch(`${base}/admin/users/${encodeURIComponent(targetUsername)}/flags`, {
    method: "PATCH", headers: authHeaders(adminToken), body: JSON.stringify(flags),
  });
}

async function runTests(BASE) {
  await testLastAdminProtection(BASE);
  await testLastOwnerProtectionViaFlags(BASE);
  await testLastOwnerProtectionViaDelete(BASE);
  await testTenUserListCap(BASE);
  await testMemberFlagsForcedToZero(BASE);
  await testPermissionChecks(BASE);
  await testCrossListAdminScoping(BASE);
  await testSuperAdminCrossListAccess(BASE);
}

// Last-admin protection is a per-list count (SELECT COUNT(*) WHERE
// is_admin=1 AND list_id=?, mirroring the last-owner guard below), so this
// test is self-contained regardless of ambient DB state from other lists.
async function testLastAdminProtection(BASE) {
  const username = `ao_lastadmin_${RUN_ID}`;
  const { token } = await seedAndLogin(BASE, username, PASS);

  // Exactly one admin on this fresh list (us) — demoting ourselves must be refused.
  const refusedRes = await patchFlags(BASE, token, username, { is_admin: false });
  assert.equal(refusedRes.status, 400);
  const refusedBody = await refusedRes.json();
  assert.match(refusedBody.error, /siste admin/i);

  // Promote a second admin (any member works), then demoting one succeeds.
  const { username: memberUsername } = await addMember(BASE, token, `ao_lastadmin_m_${RUN_ID}`);
  assert.equal((await patchFlags(BASE, token, memberUsername, { is_admin: true })).status, 200);
  const demoteRes = await patchFlags(BASE, token, username, { is_admin: false });
  assert.equal(demoteRes.status, 200, "demoting is allowed once a second admin exists on the same list");

  console.log("  - last-admin protection: refuses to demote a list's sole admin, allows it once a second exists on the same list");
}

// is_owner is scoped per-list (COUNT(*) WHERE is_owner=1 AND list_id=?), and
// a fresh bootstrapAccount() call always creates a brand-new list with
// exactly one owner, so this test is self-contained regardless of ambient
// DB state.
async function testLastOwnerProtectionViaFlags(BASE) {
  const username = `ao_lastowner_flags_${RUN_ID}`;
  const { token } = await seedAndLogin(BASE, username, PASS);

  const refusedRes = await patchFlags(BASE, token, username, { is_owner: false });
  assert.equal(refusedRes.status, 400);
  const refusedBody = await refusedRes.json();
  assert.match(refusedBody.error, /eneste eier/i);

  const { username: memberUsername } = await addMember(BASE, token, `ao_lastowner_flags_m_${RUN_ID}`);
  assert.equal((await patchFlags(BASE, token, memberUsername, { is_owner: true })).status, 200);
  assert.equal(
    (await patchFlags(BASE, token, username, { is_owner: false })).status, 200,
    "removing owner status is allowed once a second owner exists on the list"
  );

  console.log("  - last-owner protection (flags PATCH): refuses to remove the list's sole owner, allows it once a second exists");
}

async function testLastOwnerProtectionViaDelete(BASE) {
  const username = `ao_lastowner_del_${RUN_ID}`;
  const { token } = await seedAndLogin(BASE, username, PASS);

  const refusedRes = await fetch(`${BASE}/list-users/${encodeURIComponent(username)}`, {
    method: "DELETE", headers: authHeaders(token),
  });
  assert.equal(refusedRes.status, 400);
  const refusedBody = await refusedRes.json();
  assert.match(refusedBody.error, /eneste eier/i);

  const { username: memberUsername } = await addMember(BASE, token, `ao_lastowner_del_m_${RUN_ID}`);
  assert.equal((await patchFlags(BASE, token, memberUsername, { is_owner: true })).status, 200);
  const deleteRes = await fetch(`${BASE}/list-users/${encodeURIComponent(username)}`, {
    method: "DELETE", headers: authHeaders(token),
  });
  assert.equal(deleteRes.status, 200, "removing the owner is allowed once a second owner exists on the list");

  console.log("  - last-owner protection (DELETE /list-users): refuses to remove the list's sole owner, allows it once a second exists");
}

async function testTenUserListCap(BASE) {
  const username = `ao_cap_${RUN_ID}`;
  const { token } = await seedAndLogin(BASE, username, PASS);

  // Owner (1) + 8 members = 9; the 9th addMember call brings us to 9 total.
  for (let i = 0; i < 8; i++) {
    const res = await fetch(`${BASE}/list-users`, {
      method: "POST", headers: authHeaders(token),
      body: JSON.stringify({ email: `ao_cap_m${i}_${RUN_ID}@example.test`, name: `ao_cap_m${i}_${RUN_ID}` }),
    });
    assert.equal(res.status, 200, `member ${i + 1}/8 should be added (list at ${i + 2}/10 users)`);
  }
  // 10th user (owner + 9 members) should still succeed.
  assert.equal(
    (await fetch(`${BASE}/list-users`, {
      method: "POST", headers: authHeaders(token),
      body: JSON.stringify({ email: `ao_cap_m9_${RUN_ID}@example.test`, name: `ao_cap_m9_${RUN_ID}` }),
    })).status, 200,
    "the 10th user on the list should be allowed"
  );
  // 11th user should be refused.
  const overflowRes = await fetch(`${BASE}/list-users`, {
    method: "POST", headers: authHeaders(token),
    body: JSON.stringify({ email: `ao_cap_m10_${RUN_ID}@example.test`, name: `ao_cap_m10_${RUN_ID}` }),
  });
  assert.equal(overflowRes.status, 400);
  const overflowBody = await overflowRes.json();
  assert.match(overflowBody.error, /full/i);

  console.log("  - 10-user list cap: allows exactly 10 users on a list, refuses the 11th");
}

async function testMemberFlagsForcedToZero(BASE) {
  const username = `ao_forcezero_${RUN_ID}`;
  const { token } = await seedAndLogin(BASE, username, PASS);
  const memberLabel = `ao_forcezero_m_${RUN_ID}`;
  const memberUsername = `${memberLabel}@example.test`;

  // Attempt self-escalation via the request body — should be silently ignored.
  const res = await fetch(`${BASE}/list-users`, {
    method: "POST", headers: authHeaders(token),
    body: JSON.stringify({ email: memberUsername, name: memberLabel, is_admin: true, is_owner: true }),
  });
  assert.equal(res.status, 200);

  const listUsersRes = await fetch(`${BASE}/list-users`, { headers: authHeaders(token) });
  const listUsers = await listUsersRes.json();
  const created = listUsers.find((u) => u.username.toLowerCase() === memberUsername.toLowerCase());
  assert.ok(created, "the new member should appear in the list-users response");
  assert.equal(created.is_admin, 0, "is_admin must be server-forced to 0 regardless of what the request body sent");
  assert.equal(created.is_owner, 0, "is_owner must be server-forced to 0 regardless of what the request body sent");

  console.log("  - POST /list-users always force-zeroes is_admin/is_owner, even if the request body sets them");
}

async function testPermissionChecks(BASE) {
  const ownerUsername = `ao_perm_owner_${RUN_ID}`;
  const { token: ownerToken } = await seedAndLogin(BASE, ownerUsername, PASS);
  const { username: memberUsername, token: memberToken } = await addMember(BASE, ownerToken, `ao_perm_member_${RUN_ID}`);

  // A plain member (neither admin nor owner) should be refused every
  // admin/owner-gated endpoint.
  const checks = [
    ["POST /admin/owners", () => fetch(`${BASE}/admin/owners`, {
      method: "POST", headers: authHeaders(memberToken), body: JSON.stringify({ email: `ao_perm_x_${RUN_ID}@example.test`, name: `ao_perm_x_${RUN_ID}` }),
    })],
    ["GET /admin/users", () => fetch(`${BASE}/admin/users`, { headers: authHeaders(memberToken) })],
    ["POST /admin/users/{u}/reset-password", () => fetch(`${BASE}/admin/users/${encodeURIComponent(ownerUsername)}/reset-password`, {
      method: "POST", headers: authHeaders(memberToken),
    })],
    ["PATCH /admin/users/{u}/flags", () => patchFlags(BASE, memberToken, ownerUsername, { is_admin: false })],
    ["GET /admin/metrics", () => fetch(`${BASE}/admin/metrics`, { headers: authHeaders(memberToken) })],
    ["POST /list-users", () => fetch(`${BASE}/list-users`, {
      method: "POST", headers: authHeaders(memberToken), body: JSON.stringify({ email: `ao_perm_y_${RUN_ID}@example.test`, name: `ao_perm_y_${RUN_ID}` }),
    })],
    ["DELETE /list-users/{u}", () => fetch(`${BASE}/list-users/${encodeURIComponent(ownerUsername)}`, {
      method: "DELETE", headers: authHeaders(memberToken),
    })],
  ];
  for (const [label, request] of checks) {
    const res = await request();
    assert.equal(res.status, 403, `${label} should be 403 for a plain member`);
  }

  // GET /list-users is open to any member of the list (not admin/owner-gated).
  const listUsersRes = await fetch(`${BASE}/list-users`, { headers: authHeaders(memberToken) });
  assert.equal(listUsersRes.status, 200, "GET /list-users should be readable by any list member");

  // An admin who is NOT on the SUPERADMIN_USERNAMES allowlist (ownerUsername
  // isn't — only SUPERADMIN_USERNAME is, set in this file's .dev.vars) is
  // still refused site-wide metrics even though they pass the ordinary
  // is_admin gate.
  const metricsAsAdminRes = await fetch(`${BASE}/admin/metrics`, { headers: authHeaders(ownerToken) });
  assert.equal(metricsAsAdminRes.status, 403);
  const metricsBody = await metricsAsAdminRes.json();
  assert.match(metricsBody.error, /app-eier/i);

  // Same double-gate for POST /admin/owners — minting a new household is
  // superadmin-only, so a non-superadmin admin is refused too (TODO #90).
  const ownersAsAdminRes = await fetch(`${BASE}/admin/owners`, {
    method: "POST", headers: authHeaders(ownerToken),
    body: JSON.stringify({ email: `ao_perm_z_${RUN_ID}@example.test`, name: `ao_perm_z_${RUN_ID}` }),
  });
  assert.equal(ownersAsAdminRes.status, 403);
  const ownersBody = await ownersAsAdminRes.json();
  assert.match(ownersBody.error, /app-eier/i);

  console.log("  - permission checks: plain members get 403 on every admin/owner endpoint; a non-superadmin admin still can't read /admin/metrics or create a new owner");
}

// TODO #90: is_admin is scoped per-list — an admin on one list must not be
// able to see, reset the password of, or change the flags of a user on a
// different list, and must not be able to mint new households at all
// (that's superadmin-only, see testSuperAdminCrossListAccess below).
async function testCrossListAdminScoping(BASE) {
  const usernameA = `ao_crosslist_a_${RUN_ID}`;
  const usernameB = `ao_crosslist_b_${RUN_ID}`;
  const { token: tokenA } = await seedAndLogin(BASE, usernameA, PASS);
  const { token: tokenB } = await seedAndLogin(BASE, usernameB, PASS);

  // GET /admin/users as a non-superadmin only returns the caller's own list.
  const usersRes = await fetch(`${BASE}/admin/users`, { headers: authHeaders(tokenA) });
  assert.equal(usersRes.status, 200);
  const users = await usersRes.json();
  assert.ok(
    users.some((u) => u.username.toLowerCase() === usernameA.toLowerCase()),
    "GET /admin/users should include the caller's own account"
  );
  assert.ok(
    !users.some((u) => u.username.toLowerCase() === usernameB.toLowerCase()),
    "GET /admin/users must not leak a user from a different list"
  );

  // Reset-password and flags on a different list's user 404 (not 403 —
  // doesn't reveal whether the username exists elsewhere).
  const rpRes = await fetch(`${BASE}/admin/users/${encodeURIComponent(usernameB)}/reset-password`, {
    method: "POST", headers: authHeaders(tokenA),
  });
  assert.equal(rpRes.status, 404, "reset-password on a different list's user should 404, not 403 (no cross-list enumeration)");

  const flagsRes = await patchFlags(BASE, tokenA, usernameB, { is_admin: false });
  assert.equal(flagsRes.status, 404, "flags PATCH on a different list's user should 404, not 403");

  // Same-list actions still work for an ordinary (non-superadmin) admin.
  const { username: memberOfA } = await addMember(BASE, tokenA, `ao_crosslist_am_${RUN_ID}`);
  const sameListRpRes = await fetch(`${BASE}/admin/users/${encodeURIComponent(memberOfA)}/reset-password`, {
    method: "POST", headers: authHeaders(tokenA),
  });
  assert.equal(sameListRpRes.status, 200, "reset-password on the caller's own-list user should still succeed");

  console.log("  - cross-list admin scoping: GET/reset-password/flags are confined to the caller's own list, same-list actions still work");
}

// The literal escalation path TODO #90 named: a second (non-superadmin)
// admin resetting the superadmin's password or flipping their flags, even
// when they share the same list — must be refused regardless of scoping.
// Superadmin itself keeps acting across every list, unchanged from before.
async function testSuperAdminCrossListAccess(BASE) {
  const { token: superToken } = await seedAndLogin(BASE, SUPERADMIN_USERNAME, PASS);
  const otherUsername = `ao_super_other_${RUN_ID}`;
  await seedAndLogin(BASE, otherUsername, PASS);

  // Superadmin can still see, reset, and flag a user on a completely
  // different list — this is unchanged, cross-list behavior for superadmin.
  const usersRes = await fetch(`${BASE}/admin/users`, { headers: authHeaders(superToken) });
  const users = await usersRes.json();
  assert.ok(
    users.some((u) => u.username.toLowerCase() === otherUsername.toLowerCase()),
    "superadmin's GET /admin/users should still see every list"
  );
  const rpRes = await fetch(`${BASE}/admin/users/${encodeURIComponent(otherUsername)}/reset-password`, {
    method: "POST", headers: authHeaders(superToken),
  });
  assert.equal(rpRes.status, 200, "superadmin should still be able to reset a different list's user's password");
  const flagsRes = await patchFlags(BASE, superToken, otherUsername, { is_owner: true });
  assert.equal(flagsRes.status, 200, "superadmin should still be able to flag a different list's user");

  // Superadmin is still the only one who can mint a new household.
  const ownersRes = await fetch(`${BASE}/admin/owners`, {
    method: "POST", headers: authHeaders(superToken),
    body: JSON.stringify({ email: `ao_super_new_${RUN_ID}@example.test`, name: `ao_super_new_${RUN_ID}` }),
  });
  assert.equal(ownersRes.status, 200, "superadmin should still be able to create a new owner/household");

  // A second, ordinary admin promoted within the superadmin's OWN list must
  // still not be able to reset the superadmin's password or change their
  // flags — the direct fix for TODO #90's "reset the superadmin's password
  // and log in as it" escalation scenario.
  const { username: sameListAdmin, password: sameListAdminPassword } = await addMember(BASE, superToken, `ao_super_sibling_${RUN_ID}`);
  assert.equal((await patchFlags(BASE, superToken, sameListAdmin, { is_admin: true })).status, 200);
  // The flags PATCH above bumped token_version, so the token addMember()
  // returned is now stale — re-login for a fresh one.
  const { token: sameListAdminToken } = await login(BASE, sameListAdmin, sameListAdminPassword);

  const escalateRpRes = await fetch(`${BASE}/admin/users/${encodeURIComponent(SUPERADMIN_USERNAME)}/reset-password`, {
    method: "POST", headers: authHeaders(sameListAdminToken),
  });
  assert.equal(escalateRpRes.status, 403, "a same-list, non-superadmin admin must not be able to reset the superadmin's password");
  assert.match((await escalateRpRes.json()).error, /app-eier/i);

  const escalateFlagsRes = await patchFlags(BASE, sameListAdminToken, SUPERADMIN_USERNAME, { is_admin: false });
  assert.equal(escalateFlagsRes.status, 403, "a same-list, non-superadmin admin must not be able to change the superadmin's flags");
  assert.match((await escalateFlagsRes.json()).error, /app-eier/i);

  console.log("  - superadmin: still acts across every list; a same-list non-superadmin admin still can't touch the superadmin's account");
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
