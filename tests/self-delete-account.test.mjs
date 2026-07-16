// Plain-Node integration test for DELETE /account (self-service account
// deletion, phase 1 of TODO's account-lifecycle item — see CLAUDE.md's
// Testing conventions). Spins up the real Worker locally against a local D1
// via tests/_helpers.mjs.
//
// Run: node tests/self-delete-account.test.mjs
import assert from "node:assert/strict";
import { startWorker, seedAndLogin } from "./_helpers.mjs";

const PORT = 8803;
const RUN_ID = Date.now().toString(36);
const PASS = "Test-password-123!";

async function main() {
  const worker = await startWorker({ port: PORT });
  try {
    await runTests(worker.base);
    console.log("\nAll self-delete-account tests passed.");
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
  const { token } = await (await login(base, username, password)).json();
  return { username, password, token };
}

function deleteAccount(base, token, password) {
  return fetch(`${base}/account`, {
    method: "DELETE", headers: authHeaders(token),
    body: JSON.stringify({ current_password: password }),
  });
}

async function runTests(BASE) {
  await testWrongPasswordRefused(BASE);
  await testNonOwnerLeaves(BASE);
  await testOwnerWithAnotherOwnerLeaves(BASE);
  await testSoleOwnerNoOtherMembersCascades(BASE);
  await testSoleOwnerWithMembersCascadesEveryone(BASE);
}

async function testWrongPasswordRefused(BASE) {
  const username = `sda_wrongpw_${RUN_ID}`;
  const { token } = await seedAndLogin(BASE, username, PASS);

  const res = await deleteAccount(BASE, token, "not-the-right-password");
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.match(body.error, /feil passord/i);

  // Account must still exist and the token still work.
  const listRes = await fetch(`${BASE}/list`, { headers: authHeaders(token) });
  assert.equal(listRes.status, 200, "token should still be valid after a refused deletion");

  console.log("  - wrong current_password: refused (401), account untouched");
}

async function testNonOwnerLeaves(BASE) {
  const ownerUsername = `sda_nonowner_o_${RUN_ID}`;
  const { token: ownerToken } = await seedAndLogin(BASE, ownerUsername, PASS);
  const { username: memberUsername, password: memberPassword, token: memberToken } =
    await addMember(BASE, ownerToken, `sda_nonowner_m_${RUN_ID}`);

  const res = await deleteAccount(BASE, memberToken, memberPassword);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.list_deleted, false, "a non-owner leaving must not delete the list");

  assert.equal((await fetch(`${BASE}/list`, { headers: authHeaders(memberToken) })).status, 401,
    "the deleted user's token should stop working immediately");
  assert.equal((await login(BASE, memberUsername, memberPassword)).status, 401,
    "re-login as the deleted user should fail");

  // Owner + list are untouched.
  assert.equal((await fetch(`${BASE}/list`, { headers: authHeaders(ownerToken) })).status, 200,
    "the owner's account/list must be unaffected by a member leaving");
  const listUsers = await (await fetch(`${BASE}/list-users`, { headers: authHeaders(ownerToken) })).json();
  assert.ok(!listUsers.some((u) => u.username.toLowerCase() === memberUsername.toLowerCase()),
    "the departed member should no longer appear in the list");

  console.log("  - non-owner self-delete: leaves the list, doesn't cascade, owner/list untouched");
}

async function testOwnerWithAnotherOwnerLeaves(BASE) {
  const owner1 = `sda_twoowner_o1_${RUN_ID}`;
  const { token: owner1Token } = await seedAndLogin(BASE, owner1, PASS);
  const { username: owner2, password: owner2Password, token: owner2Token } =
    await addMember(BASE, owner1Token, `sda_twoowner_o2_${RUN_ID}`);
  assert.equal(
    (await fetch(`${BASE}/admin/users/${encodeURIComponent(owner2)}/flags`, {
      method: "PATCH", headers: authHeaders(owner1Token), body: JSON.stringify({ is_owner: true }),
    })).status, 200,
    "promoting the member to a second owner should succeed"
  );
  // owner2Token is now stale (flags PATCH bumps token_version) — re-login.
  const { token: owner2FreshToken } = await (await login(BASE, owner2, owner2Password)).json();

  const res = await deleteAccount(BASE, owner1Token, PASS);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.list_deleted, false, "an owner leaving while a co-owner remains must not cascade");

  assert.equal((await fetch(`${BASE}/list`, { headers: authHeaders(owner1Token) })).status, 401);
  assert.equal((await fetch(`${BASE}/list`, { headers: authHeaders(owner2FreshToken) })).status, 200,
    "the remaining owner keeps full access to the still-existing list");

  console.log("  - owner self-delete with a co-owner present: leaves the list, doesn't cascade");
}

async function testSoleOwnerNoOtherMembersCascades(BASE) {
  const username = `sda_solo_${RUN_ID}`;
  const { token } = await seedAndLogin(BASE, username, PASS);

  const res = await deleteAccount(BASE, token, PASS);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.list_deleted, true, "the sole owner of a list with no other members must cascade-delete the list");

  assert.equal((await fetch(`${BASE}/list`, { headers: authHeaders(token) })).status, 401);
  assert.equal((await login(BASE, username, PASS)).status, 401, "re-login should fail — the account is gone");

  console.log("  - sole-owner self-delete (no other members): cascades, deletes the list and own account");
}

async function testSoleOwnerWithMembersCascadesEveryone(BASE) {
  const ownerUsername = `sda_cascade_o_${RUN_ID}`;
  const { token: ownerToken } = await seedAndLogin(BASE, ownerUsername, PASS);
  const { username: memberUsername, password: memberPassword, token: memberToken } =
    await addMember(BASE, ownerToken, `sda_cascade_m_${RUN_ID}`);

  // Add a catalogue item + shopping-list line so there's something concrete
  // to prove got swept away, not just the users.
  const addItemRes = await fetch(`${BASE}/list`, {
    method: "POST", headers: authHeaders(ownerToken),
    body: JSON.stringify({ name: `Cascade test item ${RUN_ID}`, category: "Annet" }),
  });
  assert.equal(addItemRes.status, 200, "seeding a shopping-list item should succeed");

  const res = await deleteAccount(BASE, ownerToken, PASS);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.list_deleted, true, "the sole owner deleting their account must cascade the whole list");

  assert.equal((await fetch(`${BASE}/list`, { headers: authHeaders(ownerToken) })).status, 401,
    "the owner's own token should stop working");
  assert.equal((await fetch(`${BASE}/list`, { headers: authHeaders(memberToken) })).status, 401,
    "a fellow member's token should ALSO stop working — their account was deleted along with the list");
  assert.equal((await login(BASE, ownerUsername, PASS)).status, 401);
  assert.equal((await login(BASE, memberUsername, memberPassword)).status, 401,
    "the member's account itself should no longer exist, not just be removed from the list");

  console.log("  - sole-owner self-delete WITH other members: cascades the whole list, removing every member's account too");
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
