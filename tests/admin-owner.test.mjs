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

async function main() {
  const worker = await startWorker({ port: PORT });
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
}

// Last-admin protection is a GLOBAL count (SELECT COUNT(*) WHERE is_admin=1
// across all lists), and this local D1 persists across separate test-file
// runs, so we can't assume we're the only admin in the DB. Instead: demote
// every other admin down to just ours first (always safe, since our own
// admin flag keeps the true count >=2 until the very last one), so the test
// is deterministic regardless of what earlier test runs left behind.
async function testLastAdminProtection(BASE) {
  const username = `ao_lastadmin_${RUN_ID}`;
  const { token: seedToken } = await seedAndLogin(BASE, username, PASS);

  const usersRes = await fetch(`${BASE}/admin/users`, { headers: authHeaders(seedToken) });
  assert.equal(usersRes.status, 200);
  const allUsers = await usersRes.json();
  const otherAdmins = allUsers.filter(
    (u) => u.is_admin && u.username.toLowerCase() !== username.toLowerCase()
  );
  for (const u of otherAdmins) {
    const res = await patchFlags(BASE, seedToken, u.username, { is_admin: false });
    assert.equal(res.status, 200, `demoting other admin ${u.username} should succeed while >=2 admins remain`);
  }

  // Now exactly one admin (us) remains — demoting ourselves must be refused.
  const refusedRes = await patchFlags(BASE, seedToken, username, { is_admin: false });
  assert.equal(refusedRes.status, 400);
  const refusedBody = await refusedRes.json();
  assert.match(refusedBody.error, /siste admin/i);

  // Promote a second admin (any member works), then demoting one succeeds.
  const { username: memberUsername, token: memberToken } = await addMember(BASE, seedToken, `ao_lastadmin_m_${RUN_ID}`);
  assert.equal((await patchFlags(BASE, seedToken, memberUsername, { is_admin: true })).status, 200);
  const demoteRes = await patchFlags(BASE, seedToken, username, { is_admin: false });
  assert.equal(demoteRes.status, 200, "demoting is allowed once a second admin exists");

  // memberToken is now stale (token_version bumped by the promotion above);
  // re-login isn't needed further, this test only asserts the demotion path.
  void memberToken;

  console.log("  - last-admin protection: refuses to demote the sole remaining admin, allows it once a second exists");
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

  // An admin who is NOT on the SUPERADMIN_USERNAMES allowlist (the default,
  // since it's unset in this test's .dev.vars) is still refused site-wide
  // metrics even though they pass the ordinary is_admin gate.
  const metricsAsAdminRes = await fetch(`${BASE}/admin/metrics`, { headers: authHeaders(ownerToken) });
  assert.equal(metricsAsAdminRes.status, 403);
  const metricsBody = await metricsAsAdminRes.json();
  assert.match(metricsBody.error, /app-eier/i);

  console.log("  - permission checks: plain members get 403 on every admin/owner endpoint; a non-superadmin admin still can't read /admin/metrics");
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
