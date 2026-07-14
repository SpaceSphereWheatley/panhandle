// Plain-Node integration test for DELETE /admin/users/{u} (super-admin
// account deletion — see CLAUDE.md's Testing conventions). Spins up the real
// Worker locally against a local D1 via tests/_helpers.mjs.
//
// Run: node tests/admin-delete-user.test.mjs
import assert from "node:assert/strict";
import { startWorker, seedAndLogin } from "./_helpers.mjs";

const PORT = 8804;
const RUN_ID = Date.now().toString(36);
const PASS = "Test-password-123!";
// The one account this test's own .dev.vars grants isSuperAdmin to — every
// other admin created in this run (or left behind by earlier test files
// against the same local D1) is an ordinary admin only.
const SUPERADMIN_USERNAME = `adu_superadmin_${RUN_ID}`;

async function main() {
  const worker = await startWorker({ port: PORT, extraDevVars: `SUPERADMIN_USERNAMES=${SUPERADMIN_USERNAME}\n` });
  try {
    await runTests(worker.base);
    console.log("\nAll admin-delete-user tests passed.");
  } finally {
    await worker.teardown();
  }
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function login(base, username, password) {
  return fetch(`${base}/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
}

async function addMember(base, ownerToken, username) {
  const res = await fetch(`${base}/list-users`, {
    method: "POST", headers: authHeaders(ownerToken),
    body: JSON.stringify({ username }),
  });
  assert.equal(res.status, 200, "adding a member should succeed");
  const { password } = await res.json();
  const { token } = await (await login(base, username, password)).json();
  return { username, password, token };
}

function patchFlags(base, adminToken, targetUsername, flags) {
  return fetch(`${base}/admin/users/${encodeURIComponent(targetUsername)}/flags`, {
    method: "PATCH", headers: authHeaders(adminToken), body: JSON.stringify(flags),
  });
}

function deleteUser(base, adminToken, targetUsername) {
  return fetch(`${base}/admin/users/${encodeURIComponent(targetUsername)}`, {
    method: "DELETE", headers: authHeaders(adminToken),
  });
}

async function runTests(BASE) {
  const { token: superToken } = await seedAndLogin(BASE, SUPERADMIN_USERNAME, PASS);
  await testPermissionChecks(BASE, superToken);
  await testDeletesPlainMember(BASE, superToken);
  await testRefusesLastAdmin(BASE, superToken);
  await testRefusesLastOwner(BASE, superToken);
}

async function testPermissionChecks(BASE, superToken) {
  const ownerUsername = `adu_perm_owner_${RUN_ID}`;
  const { token: ownerToken } = await seedAndLogin(BASE, ownerUsername, PASS);
  const { token: memberToken } = await addMember(BASE, ownerToken, `adu_perm_member_${RUN_ID}`);

  assert.equal((await deleteUser(BASE, memberToken, ownerUsername)).status, 403,
    "a plain member should be refused");

  // ownerToken is_admin=1 (seed makes the first account admin+owner) but is
  // NOT on the SUPERADMIN_USERNAMES allowlist — should still be refused,
  // same as /admin/metrics's existing double-gate.
  const adminOnlyRes = await deleteUser(BASE, ownerToken, `adu_perm_member_${RUN_ID}`);
  assert.equal(adminOnlyRes.status, 403);
  const adminOnlyBody = await adminOnlyRes.json();
  assert.match(adminOnlyBody.error, /app-eier/i);

  // The real superadmin can reach the endpoint (target doesn't exist, but
  // that's a 404 from further down the handler, not a 403 — proves the gate
  // itself passed).
  assert.equal((await deleteUser(BASE, superToken, `adu_perm_nonexistent_${RUN_ID}`)).status, 404);

  console.log("  - permission checks: plain members and non-superadmin admins get 403; a real superadmin passes the gate");
}

async function testDeletesPlainMember(BASE, superToken) {
  const ownerUsername = `adu_plain_owner_${RUN_ID}`;
  const { token: ownerToken } = await seedAndLogin(BASE, ownerUsername, PASS);
  const { username: memberUsername, password: memberPassword } =
    await addMember(BASE, ownerToken, `adu_plain_member_${RUN_ID}`);

  const res = await deleteUser(BASE, superToken, memberUsername);
  assert.equal(res.status, 200);

  assert.equal((await login(BASE, memberUsername, memberPassword)).status, 401,
    "the deleted member's account should no longer exist");
  assert.equal((await fetch(`${BASE}/list`, { headers: authHeaders(ownerToken) })).status, 200,
    "the owner's own account/list is unaffected by a superadmin deleting a fellow member");

  console.log("  - deletes a plain (non-admin, non-owner) member outright, no guards involved");
}

// Global admin count persists across every earlier test file run against
// this same local D1 (see admin-owner.test.mjs's own note on this), so —
// exactly like that file's testLastAdminProtection — the only deterministic
// way to test "refuses the last admin" is to demote every other admin down
// to just the target first, then attempt self-deletion via the superadmin
// endpoint (the caller IS the target here: it's the only way the is_admin
// gate can pass while the target is simultaneously the sole remaining admin).
async function testRefusesLastAdmin(BASE, superToken) {
  const usersRes = await fetch(`${BASE}/admin/users`, { headers: authHeaders(superToken) });
  const allUsers = await usersRes.json();
  const otherAdmins = allUsers.filter(
    (u) => u.is_admin && u.username.toLowerCase() !== SUPERADMIN_USERNAME.toLowerCase()
  );
  for (const u of otherAdmins) {
    const res = await patchFlags(BASE, superToken, u.username, { is_admin: false });
    assert.equal(res.status, 200, `demoting other admin ${u.username} should succeed while >=2 admins remain`);
  }

  // Now exactly one admin (the superadmin) remains — deleting them must be refused.
  const refusedRes = await deleteUser(BASE, superToken, SUPERADMIN_USERNAME);
  assert.equal(refusedRes.status, 400);
  const refusedBody = await refusedRes.json();
  assert.match(refusedBody.error, /siste admin/i);

  // Promote a second admin+owner (the superadmin's seeded account is both,
  // so both guards need a second person cleared before deletion succeeds).
  const { username: secondAdmin } = await addMember(BASE, superToken, `adu_lastadmin_second_${RUN_ID}`);
  assert.equal((await patchFlags(BASE, superToken, secondAdmin, { is_admin: true, is_owner: true })).status, 200);
  const deleteRes = await deleteUser(BASE, superToken, SUPERADMIN_USERNAME);
  assert.equal(deleteRes.status, 200, "deleting is allowed once a second admin+owner exists");
  assert.equal((await login(BASE, SUPERADMIN_USERNAME, PASS)).status, 401);

  console.log("  - refuses to delete the last admin (even via self-deletion), allows it once a second admin exists");
}

// is_owner is scoped per-list, so — unlike the last-admin case above — this
// doesn't need the same demote-everyone-else isolation: a freshly seeded
// account is always the sole owner of its own brand-new list. The
// SUPERADMIN_USERNAME account was deleted by testRefusesLastAdmin (usernames
// are free again once deleted), so it's re-seeded here as this test's actor.
// The target is deliberately promoted to admin too (alongside the actor),
// so the global admin count is guaranteed >=2 regardless of ambient state —
// otherwise the is_admin guard (checked first in the handler) could
// short-circuit before the is_owner guard actually gets exercised.
async function testRefusesLastOwner(BASE) {
  const ownerUsername = `adu_lastowner_${RUN_ID}`;
  await seedAndLogin(BASE, ownerUsername, PASS);
  const { token: superToken } = await seedAndLogin(BASE, SUPERADMIN_USERNAME, PASS);
  assert.equal((await patchFlags(BASE, superToken, ownerUsername, { is_admin: true })).status, 200);
  // Promoting bumps token_version — (re-)login for a fresh token.
  const { token: ownerToken } = await (await login(BASE, ownerUsername, PASS)).json();

  const refusedRes = await deleteUser(BASE, superToken, ownerUsername);
  assert.equal(refusedRes.status, 400);
  const refusedBody = await refusedRes.json();
  assert.match(refusedBody.error, /eneste eier/i);

  // Add a second owner on the same list, then the deletion succeeds.
  const { username: secondOwner } = await addMember(BASE, ownerToken, `adu_lastowner_second_${RUN_ID}`);
  assert.equal((await patchFlags(BASE, superToken, secondOwner, { is_owner: true })).status, 200);
  const deleteRes = await deleteUser(BASE, superToken, ownerUsername);
  assert.equal(deleteRes.status, 200, "deleting is allowed once a second owner exists on the list");

  console.log("  - refuses to delete a list's last owner, allows it once a second owner exists");
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
