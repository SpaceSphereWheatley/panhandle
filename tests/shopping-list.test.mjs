// Plain-Node integration test for POST /list's re-add dedup behavior (see
// CLAUDE.md's Testing conventions). Spins up the real Worker locally against
// a local D1 via tests/_helpers.mjs.
//
// Covers the "recently bought" duplicate bug: re-adding the same item after
// it's already bought must reopen that same list_items row instead of
// inserting a fresh one, so re-buying a staple across several days doesn't
// pile up repeated entries in "Recently bought" (sorted by bought_at) — it
// should just re-sort to the top the next time it's bought.
//
// Run: node tests/shopping-list.test.mjs
import assert from "node:assert/strict";
import { startWorker, seedAndLogin } from "./_helpers.mjs";

const PORT = 8807;
const RUN_ID = Date.now().toString(36);
const PASS = "Test-password-123!";

async function main() {
  const worker = await startWorker({ port: PORT });
  try {
    await runTests(worker.base);
    console.log("\nAll shopping-list tests passed.");
  } finally {
    await worker.teardown();
  }
}

function addItem(base, auth, body) {
  return fetch(`${base}/list`, { method: "POST", headers: auth, body: JSON.stringify(body) });
}

function toggleItem(base, auth, id) {
  return fetch(`${base}/list/${id}/toggle`, { method: "POST", headers: auth });
}

function getList(base, auth) {
  return fetch(`${base}/list`, { headers: auth }).then((r) => r.json());
}

function deleteItem(base, auth, id) {
  return fetch(`${base}/list/${id}`, { method: "DELETE", headers: auth });
}

function patchItem(base, auth, id, body) {
  return fetch(`${base}/list/${id}`, { method: "PATCH", headers: auth, body: JSON.stringify(body) });
}

async function runTests(BASE) {
  await testReaddAfterBoughtReopensRow(BASE);
  await testReaddWhileUnboughtStillMergesQty(BASE);
  await testToggleAndDeleteOnMissingOrOtherListItemReturn404(BASE);
  await testEditedByTracksOnlyDeliberateEdits(BASE);
}

async function testReaddAfterBoughtReopensRow(BASE) {
  const { auth } = await seedAndLogin(BASE, `sl_rebuy_${RUN_ID}`, PASS);

  const add1 = await addItem(BASE, auth, { name: "Milk", qty: 1, category: "Dairy" });
  assert.equal(add1.status, 200);
  const { id: firstId } = await add1.json();

  const toggle1 = await toggleItem(BASE, auth, firstId);
  assert.equal(toggle1.status, 200);

  // Re-add the same item the next day, after it's already bought.
  const add2 = await addItem(BASE, auth, { name: "Milk", qty: 1, category: "Dairy" });
  assert.equal(add2.status, 200);
  const body2 = await add2.json();
  assert.equal(body2.id, firstId, "re-adding a bought item should reopen the same row, not insert a new one");

  let list = await getList(BASE, auth);
  let milkRows = list.filter((it) => it.id === firstId || it.name === "Milk");
  assert.equal(milkRows.length, 1, "only one Milk row should exist on the list after re-adding");
  assert.equal(milkRows[0].bought, 0, "the reopened row should be unbought again");

  const toggle2 = await toggleItem(BASE, auth, firstId);
  assert.equal(toggle2.status, 200);

  list = await getList(BASE, auth);
  milkRows = list.filter((it) => it.name === "Milk");
  assert.equal(milkRows.length, 1, "re-buying the same item must not create a second 'Recently bought' entry");
  assert.equal(milkRows[0].bought, 1);

  console.log("  - re-adding an already-bought item reopens its row instead of duplicating it");
}

async function testReaddWhileUnboughtStillMergesQty(BASE) {
  const { auth } = await seedAndLogin(BASE, `sl_merge_${RUN_ID}`, PASS);

  const add1 = await addItem(BASE, auth, { name: "Bread", qty: 1, category: "Bakery" });
  const { id: firstId } = await add1.json();

  const add2 = await addItem(BASE, auth, { name: "Bread", qty: 2, category: "Bakery" });
  assert.equal(add2.status, 200);
  const body2 = await add2.json();
  assert.equal(body2.duplicate, true);
  assert.equal(body2.id, firstId);
  assert.equal(body2.qty, 3);

  console.log("  - adding the same still-unbought item keeps bumping qty on the existing row (unchanged behavior)");
}

// TODO-87: toggle/delete used to report 200 ok for an id that matched
// nothing (nonexistent, or scoped to a different list), masking the fact
// that nothing actually happened. Both now 404.
async function testToggleAndDeleteOnMissingOrOtherListItemReturn404(BASE) {
  const { auth } = await seedAndLogin(BASE, `sl_404_${RUN_ID}`, PASS);
  const { auth: otherAuth } = await seedAndLogin(BASE, `sl_404_other_${RUN_ID}`, PASS);

  const toggleMissing = await toggleItem(BASE, auth, 999999999);
  assert.equal(toggleMissing.status, 404);
  assert.equal((await toggleMissing.json()).code, "ITEM_NOT_FOUND");

  const deleteMissing = await deleteItem(BASE, auth, 999999999);
  assert.equal(deleteMissing.status, 404);
  assert.equal((await deleteMissing.json()).code, "ITEM_NOT_FOUND");

  const add = await addItem(BASE, otherAuth, { name: "Eggs", qty: 1, category: "Dairy" });
  const { id: otherListItemId } = await add.json();

  const toggleOtherList = await toggleItem(BASE, auth, otherListItemId);
  assert.equal(toggleOtherList.status, 404, "toggling another list's item id must not silently succeed");

  const deleteOtherList = await deleteItem(BASE, auth, otherListItemId);
  assert.equal(deleteOtherList.status, 404, "deleting another list's item id must not silently succeed");

  // The other list's item is untouched by the failed cross-tenant attempts.
  const otherList = await getList(BASE, otherAuth);
  assert.equal(otherList.some((it) => it.id === otherListItemId), true);

  console.log("  - toggling/deleting a nonexistent or other-list item id returns 404 instead of a silent 200");
}

// The item modal shows only the latest of "added" vs "edited" — edited_by/
// edited_at should stay null until a deliberate edit-modal save (name/
// category/qty/notes), and must NOT be set by the important-star toggle,
// which is a quick action rather than an edit.
async function testEditedByTracksOnlyDeliberateEdits(BASE) {
  const { auth } = await seedAndLogin(BASE, `sl_edit_${RUN_ID}`, PASS);

  const add = await addItem(BASE, auth, { name: "Butter", qty: 1, category: "Dairy" });
  const { id } = await add.json();

  let list = await getList(BASE, auth);
  let row = list.find((it) => it.id === id);
  assert.equal(row.edited_by, null, "a freshly added item has no edit yet");
  assert.equal(row.edited_at, null);

  const importantPatch = await patchItem(BASE, auth, id, { important: true });
  assert.equal(importantPatch.status, 200);
  list = await getList(BASE, auth);
  row = list.find((it) => it.id === id);
  assert.equal(row.edited_by, null, "marking important must not count as an edit");
  assert.equal(row.edited_at, null);

  const editPatch = await patchItem(BASE, auth, id, { name: "Butter", category: "Dairy", qty: 2, notes: "Salted" });
  assert.equal(editPatch.status, 200);
  list = await getList(BASE, auth);
  row = list.find((it) => it.id === id);
  assert.notEqual(row.edited_by, null, "an edit-modal save should stamp edited_by");
  assert.notEqual(row.edited_at, null);
  assert.ok(row.edited_at >= row.added_at, "edited_at should be at or after added_at");

  console.log("  - edited_by/edited_at only stamped by a deliberate edit, not the important toggle");
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
