// Plain-Node integration test for the storage module (docs/storage-module-plan.md):
// basic box CRUD, smallest-available-number reuse, the 300-box cap, and
// claiming an arbitrary number directly (see CLAUDE.md's Testing
// conventions). Spins up the real Worker locally against a local D1 via
// tests/_helpers.mjs.
//
// Run: node tests/storage.test.mjs
import assert from "node:assert/strict";
import { startWorker, seedAndLogin, runSql } from "./_helpers.mjs";

const PORT = 8809;
const RUN_ID = Date.now().toString(36);
const PASS = "Test-password-123!";
// Two ordinary accounts, each getting their own fresh list on signup — lets
// testByNumberLookupIsListScoped prove isolation *between two lists*, which
// is the actual security property (list_id, same as every other per-list
// table — there's no separate module gate anymore).
const STORAGE_USERNAME = `st_user_${RUN_ID}`;
const STORAGE_USERNAME_2 = `st_user2_${RUN_ID}`;

async function main() {
  const worker = await startWorker({ port: PORT });
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
  // test below — both are shared, fixed accounts, and seedAndLogin's
  // bootstrap step would collide on the users PK if called more than once
  // for the same username.
  await seedAndLogin(BASE, STORAGE_USERNAME, PASS);
  await seedAndLogin(BASE, STORAGE_USERNAME_2, PASS);

  await testCrudAndItemsRoundTrip(BASE);
  await testNumberingReusesSmallestAvailable(BASE);
  await testByNumberLookupIsListScoped(BASE);
  await testClaimingAnArbitraryNumber(BASE);
  // Creates boxes, so it must run before testBoxCap — that one fills the
  // shared account's list to the 300-box cap and never empties it, after
  // which any create returns STORAGE_BOX_LIMIT.
  await testBoxCap(BASE);
}

async function storageUser(BASE) {
  return login(BASE, STORAGE_USERNAME, PASS);
}

async function storageUser2(BASE) {
  return login(BASE, STORAGE_USERNAME_2, PASS);
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

async function testNumberingReusesSmallestAvailable(BASE) {
  // Every test in this file shares the one bootstrapped account
  // (STORAGE_USERNAME) rather than seeding a fresh one each time.
  const { token: storageToken } = await storageUser(BASE);

  const first = await (await fetch(`${BASE}/storage/boxes`, {
    method: "POST", headers: authHeaders(storageToken), body: JSON.stringify({ name: "Box A (numbering test)" }),
  })).json();
  const second = await (await fetch(`${BASE}/storage/boxes`, {
    method: "POST", headers: authHeaders(storageToken), body: JSON.stringify({ name: "Box B (numbering test)" }),
  })).json();
  // `first` took the smallest number free at its own turn, so `second` (created
  // after `first` is already live) must land on something larger.
  assert.ok(second.number > first.number, "each auto-assigned number should be larger than an already-live one");

  // Delete the lower-numbered box, then create a third — the smallest number
  // that's now free is exactly the one `first` gave up, since nothing smaller
  // than it was ever free (see the assertion above).
  await fetch(`${BASE}/storage/boxes/${first.id}`, { method: "DELETE", headers: authHeaders(storageToken) });
  const third = await (await fetch(`${BASE}/storage/boxes`, {
    method: "POST", headers: authHeaders(storageToken), body: JSON.stringify({ name: "Box C (numbering test)" }),
  })).json();
  assert.equal(third.number, first.number, "a deleted box's number should be reused by the next auto-assigned box");
  assert.notEqual(third.number, second.number);

  console.log("  - deleting a box frees its number for the next auto-assigned box to reuse");
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

// Covers the scan-a-printed-sticker-first flow: a sticker for a
// client-generated number sequence gets printed and stuck on a box before
// the box exists in the app, so creating the box afterward has to be able to
// land on that exact number, not the next one the server would auto-assign.
async function testClaimingAnArbitraryNumber(BASE) {
  const { token: storageToken } = await storageUser(BASE);

  // Any unused positive integer is claimable directly — there's no reserve
  // step or counter to check it against. This is also the "type the number
  // in yourself" manual-entry path (BoxEditModal's optional number field on
  // a plain new box) and the "print a sequence, scan a sticker" path.
  const claimRes = await fetch(`${BASE}/storage/boxes`, {
    method: "POST", headers: authHeaders(storageToken),
    body: JSON.stringify({ name: "Claimed box", claim_number: 777 }),
  });
  assert.equal(claimRes.status, 200);
  const claimed = await claimRes.json();
  assert.equal(claimed.number, 777, "the created box should land on the exact claimed number");

  const reclaimRes = await fetch(`${BASE}/storage/boxes`, {
    method: "POST", headers: authHeaders(storageToken),
    body: JSON.stringify({ name: "Duplicate claim", claim_number: 777 }),
  });
  assert.equal(reclaimRes.status, 400, "a number already claimed by a live box must not be claimable again");
  assert.equal((await reclaimRes.json()).code, "STORAGE_BOX_NUMBER_UNAVAILABLE");

  const invalidRes = await fetch(`${BASE}/storage/boxes`, {
    method: "POST", headers: authHeaders(storageToken),
    body: JSON.stringify({ name: "Invalid claim", claim_number: 0 }),
  });
  assert.equal(invalidRes.status, 400, "a non-positive claim_number must be rejected");
  assert.equal((await invalidRes.json()).code, "STORAGE_BOX_NUMBER_UNAVAILABLE");

  const manualRes = await fetch(`${BASE}/storage/boxes`, {
    method: "POST", headers: authHeaders(storageToken),
    body: JSON.stringify({ name: "Manually numbered box", claim_number: 555555 }),
  });
  assert.equal(manualRes.status, 200);
  assert.equal((await manualRes.json()).number, 555555, "an arbitrary unused number should be claimable directly");

  console.log("  - claim_number lands a new box on an exact arbitrary number, rejects an already-claimed or invalid one");
}

async function testBoxCap(BASE) {
  // Bulk-insert straight to the account's list_id via runSql,
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

main().catch((err) => { console.error(err); process.exitCode = 1; });
