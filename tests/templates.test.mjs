// Plain-Node integration test for saved lists (item_templates): CRUD,
// validation, the per-list cap, household scoping, and that a household
// with saved lists can still be deleted (both cascades clear the table).
//
// Run: node tests/templates.test.mjs
import assert from "node:assert/strict";
import { startWorker, seedAndLogin } from "./_helpers.mjs";

const PORT = 8815;
const STAMP = Date.now();
const USER_A = `tmpl_a_${STAMP}`;
const USER_B = `tmpl_b_${STAMP}`;
const PASS = "Test-password-123!";

async function main() {
  const worker = await startWorker({ port: PORT });
  try {
    await runTests(worker.base);
    console.log("\nAll saved-list tests passed.");
  } finally {
    await worker.teardown();
  }
}

async function runTests(BASE) {
  const { auth: authA } = await seedAndLogin(BASE, USER_A, PASS);
  const { auth: authB } = await seedAndLogin(BASE, USER_B, PASS);

  const call = (method, path, body, auth = authA) =>
    fetch(`${BASE}${path}`, { method, headers: auth, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = async (res) => ({ status: res.status, body: await res.json() });

  // ---- create ----
  let r = await json(await call("POST", "/templates", { name: "cabin trip", items: [" Milk ", "Coffee", "", "2 pk Bacon"] }));
  assert.equal(r.status, 200);
  const cabin = r.body;
  assert.equal(cabin.name, "Cabin trip", "name is capitalized like other names");
  assert.deepEqual(cabin.items, ["Milk", "Coffee", "2 pk Bacon"], "items trimmed, blanks dropped");
  console.log("  - create sanitizes name and items");

  // ---- validation ----
  assert.equal((await json(await call("POST", "/templates", { name: "  ", items: [] }))).body.code, "EMPTY_NAME");
  assert.equal((await json(await call("POST", "/templates", { name: "x".repeat(61) }))).body.code, "TEXT_TOO_LONG");
  assert.equal((await json(await call("POST", "/templates", { name: "Big", items: Array(101).fill("a") }))).body.code, "TOO_MANY_ENTRIES");
  assert.equal((await json(await call("POST", "/templates", { name: "CABIN TRIP" }))).body.code, "TEMPLATE_NAME_EXISTS");
  console.log("  - empty/too-long name, too many items, duplicate name (any case) rejected");

  // ---- list / update ----
  r = await json(await call("POST", "/templates", { name: "Taco night", items: ["Tortillas"] }));
  const taco = r.body;
  let list = (await json(await call("GET", "/templates"))).body;
  assert.deepEqual(list.map((t) => t.name), ["Cabin trip", "Taco night"], "sorted by name");

  r = await json(await call("PATCH", `/templates/${taco.id}`, { items: ["Tortillas", "Salsa"] }));
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.items, ["Tortillas", "Salsa"]);
  assert.equal(r.body.name, "Taco night", "omitted name is left alone");
  r = await json(await call("PATCH", `/templates/${taco.id}`, { name: "Taco friday" }));
  assert.equal(r.body.name, "Taco friday");
  assert.deepEqual(r.body.items, ["Tortillas", "Salsa"], "omitted items are left alone");
  assert.equal((await json(await call("PATCH", `/templates/${taco.id}`, { name: "cabin trip" }))).body.code, "TEMPLATE_NAME_EXISTS");
  assert.equal((await call("PATCH", "/templates/999999", { name: "Nope" })).status, 404);
  console.log("  - list sorted by name; patch updates only what's sent; rename clash rejected");

  // ---- another household can't see or touch them ----
  assert.deepEqual((await json(await call("GET", "/templates", undefined, authB))).body, []);
  assert.equal((await call("PATCH", `/templates/${cabin.id}`, { name: "Mine now" }, authB)).status, 404);
  assert.equal((await call("DELETE", `/templates/${cabin.id}`, undefined, authB)).status, 404);
  assert.equal((await json(await call("GET", "/templates"))).body.length, 2, "A's lists untouched");
  // Same name in another household is fine.
  assert.equal((await call("POST", "/templates", { name: "Cabin trip" }, authB)).status, 200);
  console.log("  - other households get 404 and can reuse names");

  // ---- delete ----
  assert.equal((await call("DELETE", `/templates/${taco.id}`)).status, 200);
  assert.equal((await call("DELETE", `/templates/${taco.id}`)).status, 404);
  console.log("  - delete works once, then 404");

  // ---- per-list cap ----
  for (let i = (await json(await call("GET", "/templates"))).body.length; i < 50; i++) {
    assert.equal((await call("POST", "/templates", { name: `List ${i}` })).status, 200);
  }
  assert.equal((await json(await call("POST", "/templates", { name: "One too many" }))).body.code, "TEMPLATE_LIMIT");
  console.log("  - 50-list cap enforced");

  // ---- a household with saved lists can still delete its account ----
  const del = await call("DELETE", "/account", { current_password: PASS });
  assert.equal(del.status, 200, `self-delete with saved lists should succeed, got ${del.status} ${await del.text()}`);
  console.log("  - sole-owner account deletion clears saved lists");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
