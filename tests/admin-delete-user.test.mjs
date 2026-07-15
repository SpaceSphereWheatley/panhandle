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

function deleteUser(base, adminToken, targetUsername, body) {
  return fetch(`${base}/admin/users/${encodeURIComponent(targetUsername)}`, {
    method: "DELETE", headers: authHeaders(adminToken),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

async function runTests(BASE) {
  const { token: superToken } = await seedAndLogin(BASE, SUPERADMIN_USERNAME, PASS);
  await testPermissionChecks(BASE, superToken);
  await testDeletesPlainMember(BASE, superToken);
  await testRefusesLastAdmin(BASE, superToken);
  await testRefusesLastOwnerWithoutConfirmation(BASE);
  await testLastOwnerCascadeWithConfirmation(BASE);
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
// account is always the sole owner of its own brand-new list. Without the
// delete_list confirmation flag, deleting a list's last owner is still
// refused outright (same "eneste eier" guard as PATCH .../flags and
// DELETE /list-users) — the flag has to be an explicit, opt-in choice, never
// the default.
async function testRefusesLastOwnerWithoutConfirmation(BASE) {
  const ownerUsername = `adu_lastowner_noconfirm_${RUN_ID}`;
  await seedAndLogin(BASE, ownerUsername, PASS);
  const { token: superToken } = await seedAndLogin(BASE, SUPERADMIN_USERNAME, PASS);

  const refusedRes = await deleteUser(BASE, superToken, ownerUsername);
  assert.equal(refusedRes.status, 400);
  const refusedBody = await refusedRes.json();
  assert.match(refusedBody.error, /eneste eier/i);

  // The account and its list are untouched by the refused attempt.
  assert.equal((await login(BASE, ownerUsername, PASS)).status, 200,
    "the refused last-owner account should still exist and be able to log in");

  console.log("  - refuses to delete a list's last owner without body.delete_list");
}

// With body.delete_list: true, deleting a list's last owner cascades into
// deleting the entire list (every table scoped by list_id) instead of being
// refused — same outcome as a last owner self-deleting via DELETE /account,
// just triggered by a superadmin acting on someone else's account.
async function testLastOwnerCascadeWithConfirmation(BASE) {
  const ownerUsername = `adu_lastowner_cascade_${RUN_ID}`;
  const { token: ownerToken } = await seedAndLogin(BASE, ownerUsername, PASS);
  const { token: superToken } = await seedAndLogin(BASE, SUPERADMIN_USERNAME, PASS);
  const { username: memberUsername, password: memberPassword } =
    await addMember(BASE, ownerToken, `adu_lastowner_cascade_m_${RUN_ID}`);

  const deleteRes = await deleteUser(BASE, superToken, ownerUsername, { delete_list: true });
  assert.equal(deleteRes.status, 200);
  const deleteBody = await deleteRes.json();
  assert.equal(deleteBody.list_deleted, true, "response should report the whole list was deleted");

  assert.equal((await login(BASE, ownerUsername, PASS)).status, 401,
    "the deleted owner's account should no longer exist");
  assert.equal((await login(BASE, memberUsername, memberPassword)).status, 401,
    "every other member of the cascade-deleted list should also be gone");

  console.log("  - body.delete_list cascades: deletes the last owner AND their entire list (all members included)");
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
