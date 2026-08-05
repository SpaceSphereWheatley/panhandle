// Plain-Node integration test for the storage module (docs/storage-module-plan.md):
// basic box CRUD, smallest-available-number reuse, the 300-box cap, and the
// reserve endpoint's no-row-created behavior (see CLAUDE.md's Testing
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
  await testClaimingAReservedNumber(BASE);
  // Both of these create boxes, so they must run before testBoxCap — it
  // fills the shared account's list to the 300-box cap and never empties it,
  // after which any create returns STORAGE_BOX_LIMIT.
  await testOutstandingReservationsAreVisibleAndDisposable(BASE);
  await testBoxCap(BASE);
  await testReserveDoesNotCreateRows(BASE);
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

// Covers the reserve-then-fill-in flow the reserve endpoint exists for
// (docs/storage-module-plan.md): a sticker gets printed and stuck on a box
// before the box exists in the app, so creating the box afterward has to be
// able to land on that exact already-reserved number, not the next one from
// the counter.
async function testClaimingAReservedNumber(BASE) {
  const { token: storageToken } = await storageUser(BASE);

  const reserveRes = await fetch(`${BASE}/storage/boxes/reserve`, {
    method: "POST", headers: authHeaders(storageToken), body: JSON.stringify({ count: 3 }),
  });
  const { numbers } = await reserveRes.json();
  const [first, , third] = numbers;

  const claimRes = await fetch(`${BASE}/storage/boxes`, {
    method: "POST", headers: authHeaders(storageToken),
    body: JSON.stringify({ name: "Claimed box", claim_number: first }),
  });
  assert.equal(claimRes.status, 200);
  const claimed = await claimRes.json();
  assert.equal(claimed.number, first, "the created box should land on the exact reserved number, not the next counter value");

  const reclaimRes = await fetch(`${BASE}/storage/boxes`, {
    method: "POST", headers: authHeaders(storageToken),
    body: JSON.stringify({ name: "Duplicate claim", claim_number: first }),
  });
  assert.equal(reclaimRes.status, 400, "a number already claimed by a live box must not be claimable again");
  assert.equal((await reclaimRes.json()).code, "STORAGE_BOX_NUMBER_UNAVAILABLE");

  const invalidRes = await fetch(`${BASE}/storage/boxes`, {
    method: "POST", headers: authHeaders(storageToken),
    body: JSON.stringify({ name: "Invalid claim", claim_number: 0 }),
  });
  assert.equal(invalidRes.status, 400, "a non-positive claim_number must be rejected");
  assert.equal((await invalidRes.json()).code, "STORAGE_BOX_NUMBER_UNAVAILABLE");

  // There's no counter to bound claim_number against anymore — any unused
  // positive integer is claimable directly, not just a previously reserved
  // one. This is also the "type the number in yourself" manual-entry path
  // (BoxEditModal's optional number field on a plain new box).
  const manualRes = await fetch(`${BASE}/storage/boxes`, {
    method: "POST", headers: authHeaders(storageToken),
    body: JSON.stringify({ name: "Manually numbered box", claim_number: 555555 }),
  });
  assert.equal(manualRes.status, 200);
  assert.equal((await manualRes.json()).number, 555555, "an arbitrary unused number should be claimable directly, not just a previously reserved one");

  const stillClaimableRes = await fetch(`${BASE}/storage/boxes`, {
    method: "POST", headers: authHeaders(storageToken),
    body: JSON.stringify({ name: "Third reserved box", claim_number: third }),
  });
  assert.equal(stillClaimableRes.status, 200);
  assert.equal((await stillClaimableRes.json()).number, third, "an unclaimed reserved number in the same batch should still be claimable");

  console.log("  - claim_number lands a new box on an exact number (reserved or arbitrary), rejects an already-claimed or invalid one");
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
  // Not necessarily consecutive — an earlier test (testOutstandingReservations…)
  // deliberately left a reservation outstanding, and that number must stay
  // skipped here (a reservation blocks a second reservation from also
  // claiming it, unlike box auto-allocate, which ignores reservations
  // entirely). Just strictly increasing, and each smaller than the next.
  for (let i = 1; i < numbers.length; i++) {
    assert.ok(numbers[i] > numbers[i - 1], "reserved numbers should be strictly increasing");
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

// Reserved numbers used to be write-only: burned from the counter with
// nothing recording them, so a lost print-out left them unrecoverable and
// invisible. They're now tracked (migration 0028) and stay listed until
// either claimed by a real box or explicitly discarded.
async function testOutstandingReservationsAreVisibleAndDisposable(BASE) {
  const { token } = await storageUser(BASE);

  const before = await (await fetch(`${BASE}/storage/boxes/reserved`, { headers: authHeaders(token) })).json();
  const { numbers } = await (await fetch(`${BASE}/storage/boxes/reserve`, {
    method: "POST", headers: authHeaders(token), body: JSON.stringify({ count: 3 }),
  })).json();

  const listed = await (await fetch(`${BASE}/storage/boxes/reserved`, { headers: authHeaders(token) })).json();
  assert.equal(listed.length, before.length + 3, "a fresh reservation should show up as outstanding");
  for (const n of numbers) {
    assert.ok(listed.some((r) => r.number === n), `reserved number ${n} should be listed`);
  }

  // Claiming one with a real box retires its reservation automatically.
  await fetch(`${BASE}/storage/boxes`, {
    method: "POST", headers: authHeaders(token),
    body: JSON.stringify({ name: "Filled from a reserved sticker", claim_number: numbers[0] }),
  });
  const afterClaim = await (await fetch(`${BASE}/storage/boxes/reserved`, { headers: authHeaders(token) })).json();
  assert.ok(!afterClaim.some((r) => r.number === numbers[0]), "claiming a reserved number should clear its reservation");
  assert.ok(afterClaim.some((r) => r.number === numbers[1]), "the batch's other numbers stay outstanding");

  // Discarding drops it from the list without rewinding the counter — the
  // number stays burned, it's just no longer offered for reprinting.
  const discardRes = await fetch(`${BASE}/storage/boxes/reserved/${numbers[1]}`, {
    method: "DELETE", headers: authHeaders(token),
  });
  assert.equal(discardRes.status, 200);
  const afterDiscard = await (await fetch(`${BASE}/storage/boxes/reserved`, { headers: authHeaders(token) })).json();
  assert.ok(!afterDiscard.some((r) => r.number === numbers[1]), "a discarded reservation should be gone");

  const discardAgain = await fetch(`${BASE}/storage/boxes/reserved/${numbers[1]}`, {
    method: "DELETE", headers: authHeaders(token),
  });
  assert.equal(discardAgain.status, 404, "discarding an already-gone reservation should 404");

  // list_id scoping covers the new route too — a different list's account
  // must not see this list's outstanding reservations.
  const { token: otherStorageToken } = await storageUser2(BASE);
  const otherList = await (await fetch(`${BASE}/storage/boxes/reserved`, { headers: authHeaders(otherStorageToken) })).json();
  assert.ok(!otherList.some((r) => r.number === numbers[1]), "another list must not see this list's outstanding reservations");

  console.log("  - outstanding reservations are listed, cleared by claiming, discardable by hand, and scoped per list");
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
