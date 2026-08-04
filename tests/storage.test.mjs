// Plain-Node integration test for the storage module (docs/storage-module-plan.md):
// the server-side hasStorageAccess gate, basic box CRUD, monotonic never-reused
// numbering, the 300-box cap, and the reserve endpoint's no-row-created behavior
// (see CLAUDE.md's Testing conventions). Spins up the real Worker locally
// against a local D1 via tests/_helpers.mjs.
//
// Run: node tests/storage.test.mjs
import assert from "node:assert/strict";
import { startWorker, seedAndLogin, runSql } from "./_helpers.mjs";

const PORT = 8809;
const RUN_ID = Date.now().toString(36);
const PASS = "Test-password-123!";
// Two allowlisted accounts, each getting their own fresh list on signup —
// lets testByNumberLookupIsListScoped prove isolation *between two gated
// accounts*, which is the actual security property (list_id, not gate
// status). Every other account created in this run is deliberately left
// off the allowlist, so the gate itself gets exercised too.
const STORAGE_USERNAME = `st_beta_${RUN_ID}`;
const STORAGE_USERNAME_2 = `st_beta2_${RUN_ID}`;

async function main() {
  const worker = await startWorker({
    port: PORT,
    extraDevVars: `STORAGE_BETA_USERNAMES=${STORAGE_USERNAME},${STORAGE_USERNAME_2}\n`,
  });
  try {
    await runTests(worker.base);
    console.log("\nAll storage tests passed.");
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
  if (res.status !== 200) throw new Error(`login failed for ${username}: ${res.status} ${await res.text()}`);
  return await res.json();
}

async function runTests(BASE) {
  // Bootstrapped once, up front, then logged into (not re-seeded) by every
  // test below — both are shared, fixed accounts (access is granted by
  // exact username match in .dev.vars, set once at worker startup), and
  // seedAndLogin's bootstrap step would collide on the users PK if called
  // more than once for the same username.
  await seedAndLogin(BASE, STORAGE_USERNAME, PASS);
  await seedAndLogin(BASE, STORAGE_USERNAME_2, PASS);

  await testGateRefusesNonAllowlistedAccount(BASE);
  await testCrudAndItemsRoundTrip(BASE);
  await testNumberingNeverReusesAfterDelete(BASE);
  await testByNumberLookupIsListScoped(BASE);
  await testBoxCap(BASE);
  await testReserveDoesNotCreateRows(BASE);
}

async function storageUser(BASE) {
  return login(BASE, STORAGE_USERNAME, PASS);
}

async function storageUser2(BASE) {
  return login(BASE, STORAGE_USERNAME_2, PASS);
}

async function testGateRefusesNonAllowlistedAccount(BASE) {
  const username = `st_outsider_${RUN_ID}`;
  const { token } = await seedAndLogin(BASE, username, PASS);

  const getRes = await fetch(`${BASE}/storage/boxes`, { headers: authHeaders(token) });
  assert.equal(getRes.status, 403);
  assert.equal((await getRes.json()).code, "STORAGE_NOT_ENABLED");

  const postRes = await fetch(`${BASE}/storage/boxes`, {
    method: "POST", headers: authHeaders(token), body: JSON.stringify({ name: "Tools" }),
  });
  assert.equal(postRes.status, 403);
  assert.equal((await postRes.json()).code, "STORAGE_NOT_ENABLED");

  const reserveRes = await fetch(`${BASE}/storage/boxes/reserve`, {
    method: "POST", headers: authHeaders(token), body: JSON.stringify({ count: 3 }),
  });
  assert.equal(reserveRes.status, 403);
  assert.equal((await reserveRes.json()).code, "STORAGE_NOT_ENABLED");

  console.log("  - an account not on STORAGE_BETA_USERNAMES gets 403 STORAGE_NOT_ENABLED on every /storage/* route");
}

async function testCrudAndItemsRoundTrip(BASE) {
  const { token } = await storageUser(BASE);

  const emptyRes = await fetch(`${BASE}/storage/boxes`, { headers: authHeaders(token) });
  assert.equal(emptyRes.status, 200);
  assert.deepEqual(await emptyRes.json(), []);

  const emptyNameRes = await fetch(`${BASE}/storage/boxes`, {
    method: "POST", headers: authHeaders(token), body: JSON.stringify({ name: "  " }),
  });
  assert.equal(emptyNameRes.status, 400);
  assert.equal((await emptyNameRes.json()).code, "STORAGE_BOX_NAME_REQUIRED");

  const createRes = await fetch(`${BASE}/storage/boxes`, {
    method: "POST", headers: authHeaders(token),
    body: JSON.stringify({ name: "Christmas decorations", location: "Garage", items: ["Lights", "Ornaments"] }),
  });
  assert.equal(createRes.status, 200);
  const created = await createRes.json();
  assert.equal(typeof created.number, "number", "number should be allocated server-side as an integer");
  assert.equal(created.name, "Christmas decorations");
  assert.deepEqual(created.items, ["Lights", "Ornaments"]);
  // number must never be settable from the request body.
  const spoofRes = await fetch(`${BASE}/storage/boxes`, {
    method: "POST", headers: authHeaders(token),
    body: JSON.stringify({ name: "Spoof attempt", number: 999 }),
  });
  const spoofed = await spoofRes.json();
  assert.notEqual(spoofed.number, 999, "the client-supplied number must be ignored");

  const listRes = await fetch(`${BASE}/storage/boxes`, { headers: authHeaders(token) });
  const list = await listRes.json();
  const found = list.find((b) => b.id === created.id);
  assert.ok(found, "GET /storage/boxes should include the created box");
  assert.deepEqual(found.items, ["Lights", "Ornaments"], "GET should assemble items alongside the box");

  const patchRes = await fetch(`${BASE}/storage/boxes/${created.id}`, {
    method: "PATCH", headers: authHeaders(token),
    body: JSON.stringify({ name: "Xmas decor", location: "Attic", items: ["Tree stand"] }),
  });
  assert.equal(patchRes.status, 200);

  const afterPatch = await (await fetch(`${BASE}/storage/boxes`, { headers: authHeaders(token) })).json();
  const patched = afterPatch.find((b) => b.id === created.id);
  assert.equal(patched.name, "Xmas decor");
  assert.equal(patched.location, "Attic");
  assert.deepEqual(patched.items, ["Tree stand"], "items should replace wholesale, not merge");
  assert.equal(patched.number, created.number, "editing must never change the box's number");

  const deleteRes = await fetch(`${BASE}/storage/boxes/${created.id}`, {
    method: "DELETE", headers: authHeaders(token),
  });
  assert.equal(deleteRes.status, 200);

  const afterDelete = await (await fetch(`${BASE}/storage/boxes`, { headers: authHeaders(token) })).json();
  assert.ok(!afterDelete.some((b) => b.id === created.id), "deleted box should be gone");

  const deleteAgainRes = await fetch(`${BASE}/storage/boxes/${created.id}`, {
    method: "DELETE", headers: authHeaders(token),
  });
  assert.equal(deleteAgainRes.status, 404);
  assert.equal((await deleteAgainRes.json()).code, "STORAGE_BOX_NOT_FOUND");

  const patchMissingRes = await fetch(`${BASE}/storage/boxes/${created.id}`, {
    method: "PATCH", headers: authHeaders(token), body: JSON.stringify({ name: "Ghost" }),
  });
  assert.equal(patchMissingRes.status, 404);

  console.log("  - create/list/patch(wholesale items)/delete round-trips correctly, and number can't be spoofed from the body");
}

async function testNumberingNeverReusesAfterDelete(BASE) {
  // Access is granted per-username via .dev.vars, fixed at worker startup,
  // so every test in this file shares the one allowlisted account
  // (STORAGE_USERNAME) rather than seeding a fresh one each time.
  const { token: storageToken } = await storageUser(BASE);

  const first = await (await fetch(`${BASE}/storage/boxes`, {
    method: "POST", headers: authHeaders(storageToken), body: JSON.stringify({ name: "Box A (numbering test)" }),
  })).json();
  const second = await (await fetch(`${BASE}/storage/boxes`, {
    method: "POST", headers: authHeaders(storageToken), body: JSON.stringify({ name: "Box B (numbering test)" }),
  })).json();
  assert.equal(second.number, first.number + 1, "numbers should allocate sequentially");

  // Delete the higher-numbered box, then create a third — MAX(number)+1
  // would reissue `second.number`; the counter must not.
  await fetch(`${BASE}/storage/boxes/${second.id}`, { method: "DELETE", headers: authHeaders(storageToken) });
  const third = await (await fetch(`${BASE}/storage/boxes`, {
    method: "POST", headers: authHeaders(storageToken), body: JSON.stringify({ name: "Box C (numbering test)" }),
  })).json();
  assert.equal(third.number, second.number + 1, "a deleted box's number must never be reissued");

  console.log("  - deleting the highest-numbered box doesn't let a later one reclaim its number");
}

async function testByNumberLookupIsListScoped(BASE) {
  const { token: storageToken } = await storageUser(BASE);
  const { token: otherStorageToken } = await storageUser2(BASE);

  const box = await (await fetch(`${BASE}/storage/boxes`, {
    method: "POST", headers: authHeaders(storageToken), body: JSON.stringify({ name: "Findable box" }),
  })).json();

  const foundRes = await fetch(`${BASE}/storage/boxes/by-number/${box.number}`, { headers: authHeaders(storageToken) });
  assert.equal(foundRes.status, 200);
  assert.equal((await foundRes.json()).id, box.id);

  const notFoundRes = await fetch(`${BASE}/storage/boxes/by-number/999999`, { headers: authHeaders(storageToken) });
  assert.equal(notFoundRes.status, 404);
  assert.equal((await notFoundRes.json()).code, "STORAGE_BOX_NOT_FOUND");

  // The real security property (docs/storage-module-plan.md: "a scanned
  // number that doesn't exist in your list is a clean 'no such box', not
  // someone else's data") — a second, equally-gated account on a different
  // list must not resolve the first account's box number.
  const crossListRes = await fetch(`${BASE}/storage/boxes/by-number/${box.number}`, { headers: authHeaders(otherStorageToken) });
  assert.equal(crossListRes.status, 404, "a box number from a different list must not resolve");
  assert.equal((await crossListRes.json()).code, "STORAGE_BOX_NOT_FOUND");

  console.log("  - GET /storage/boxes/by-number resolves within the caller's own list, 404s for an unknown number and for another list's number");
}

async function testBoxCap(BASE) {
  // Bulk-insert straight to the allowlisted account's list_id via runSql,
  // bypassing the 300 HTTP round trips reaching the cap through the API
  // would otherwise cost.
  const { token: storageToken } = await storageUser(BASE);
  const listRow = await fetch(`${BASE}/storage/boxes`, { headers: authHeaders(storageToken) });
  const before = await listRow.json();
  const liveCount = before.length;
  const toInsert = 300 - liveCount;
  assert.ok(toInsert >= 0, "test assumes fewer than 300 boxes already exist for this list at this point");

  if (toInsert > 0) {
    // Numbers just need to be distinct per list — offset well above
    // anything the counter has allocated so far to avoid a UNIQUE collision.
    const values = Array.from({ length: toInsert }, (_, i) =>
      `((SELECT list_id FROM users WHERE username = '${STORAGE_USERNAME}'), ${100000 + i}, 'cap filler ${i}', '', '')`
    ).join(",\n");
    await runSql(`INSERT INTO storage_boxes (list_id, number, name, location, notes) VALUES\n${values};`);
  }

  const atCapRes = await fetch(`${BASE}/storage/boxes`, { headers: authHeaders(storageToken) });
  assert.equal((await atCapRes.json()).length, 300);

  const overCapRes = await fetch(`${BASE}/storage/boxes`, {
    method: "POST", headers: authHeaders(storageToken), body: JSON.stringify({ name: "301st box" }),
  });
  assert.equal(overCapRes.status, 400);
  assert.equal((await overCapRes.json()).code, "STORAGE_BOX_LIMIT");

  console.log("  - a 301st box is refused with STORAGE_BOX_LIMIT once a list hits the 300-box cap");
}

async function testReserveDoesNotCreateRows(BASE) {
  const { token: storageToken } = await storageUser(BASE);

  // The box cap test above may have already saturated this account's list
  // at 300 — reserve must still work, since it never touches storage_boxes.
  const before = await (await fetch(`${BASE}/storage/boxes`, { headers: authHeaders(storageToken) })).json();

  const reserveRes = await fetch(`${BASE}/storage/boxes/reserve`, {
    method: "POST", headers: authHeaders(storageToken), body: JSON.stringify({ count: 5 }),
  });
  assert.equal(reserveRes.status, 200);
  const { numbers } = await reserveRes.json();
  assert.equal(numbers.length, 5);
  for (let i = 1; i < numbers.length; i++) {
    assert.equal(numbers[i], numbers[i - 1] + 1, "reserved numbers should be sequential");
  }

  const after = await (await fetch(`${BASE}/storage/boxes`, { headers: authHeaders(storageToken) })).json();
  assert.equal(after.length, before.length, "reserving numbers must not create any box rows");

  const oversizedRes = await fetch(`${BASE}/storage/boxes/reserve`, {
    method: "POST", headers: authHeaders(storageToken), body: JSON.stringify({ count: 1000 }),
  });
  const oversized = await oversizedRes.json();
  assert.equal(oversized.numbers.length, 60, "an oversized count should be clamped to 60, not refused");

  console.log("  - reserving numbers burns the counter without creating rows, and clamps an oversized count to 60");
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
