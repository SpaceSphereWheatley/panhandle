// Plain-Node unit test for checkCatalogueSync (automatic COMMON_ITEMS
// rollout to existing lists — replaces the old one-off
// migrations/0002_seed_catalogue.sql / 0003_expand_catalogue.sql pattern of
// hand-transcribing new items into SQL). Exercised against a small fake D1
// stub, same approach as tests/push-notifications.test.mjs's
// runNotificationPassTests — checkCatalogueSync takes `env`/`items` as plain
// parameters specifically so it's testable without wrangler dev.
//
// Run: node tests/catalogue-sync.test.mjs
import assert from "node:assert/strict";
import { checkCatalogueSync } from "../worker/index.js";

async function main() {
  await firstTickBackfillsEveryList();
  await secondTickWithUnchangedItemsIsANoop();
  await changedItemsTriggersReSync();
  await customizationsAndCustomItemsSurviveASync();
  console.log("All catalogue-sync tests passed.");
}

function makeFakeDB({ lists, itemCatalogue = [], catalogueSyncState = null }) {
  const state = { lists, itemCatalogue: [...itemCatalogue], catalogueSyncState };

  function prepare(sql) {
    let binds = [];
    return {
      bind(...args) { binds = args; return this; },
      async first() { return select(sql, binds)[0] ?? null; },
      async all() { return { results: select(sql, binds) }; },
      async run() { return exec(sql, binds); },
    };
  }

  function select(sql, binds) {
    if (sql.includes("FROM catalogue_sync_state")) {
      return state.catalogueSyncState ? [state.catalogueSyncState] : [];
    }
    if (sql.includes("SELECT id FROM lists")) {
      return state.lists.map((l) => ({ id: l.id }));
    }
    throw new Error("fake DB: unhandled SELECT: " + sql);
  }

  function exec(sql, binds) {
    if (sql.includes("INSERT INTO item_catalogue")) {
      const [name, category, list_id] = binds;
      const existing = state.itemCatalogue.find((r) => r.list_id === list_id && r.name === name);
      if (existing) { existing.category = category; return { meta: { changes: 1 } }; }
      state.itemCatalogue.push({ name, category, list_id });
      return { meta: { changes: 1 } };
    }
    if (sql.includes("INSERT INTO catalogue_sync_state")) {
      const [items_hash] = binds;
      state.catalogueSyncState = { items_hash, synced_at: "now" };
      return { meta: { changes: 1 } };
    }
    throw new Error("fake DB: unhandled exec: " + sql);
  }

  function batch(stmts) { return Promise.all(stmts.map((s) => s.run())); }

  return { db: { prepare, batch }, state };
}

async function firstTickBackfillsEveryList() {
  const items = [{ name: "Melk", category: "Meieri" }, { name: "Brød", category: "Bakevarer" }];
  const { db, state } = makeFakeDB({ lists: [{ id: 1 }, { id: 2 }] });

  const result = await checkCatalogueSync({ DB: db }, items);

  assert.equal(result.synced, true, "first tick with no prior sync state should backfill");
  assert.equal(state.itemCatalogue.length, 4, "both items should land in both lists' catalogues");
  assert.ok(state.itemCatalogue.some((r) => r.list_id === 1 && r.name === "Melk"));
  assert.ok(state.itemCatalogue.some((r) => r.list_id === 2 && r.name === "Melk"));
  assert.ok(state.catalogueSyncState, "sync state row should be written after a backfill");
  console.log("  - first tick (no prior state) backfills every existing list");
}

async function secondTickWithUnchangedItemsIsANoop() {
  const items = [{ name: "Melk", category: "Meieri" }];
  const { db, state } = makeFakeDB({ lists: [{ id: 1 }] });

  await checkCatalogueSync({ DB: db }, items);
  const catalogueAfterFirstSync = [...state.itemCatalogue];

  const result = await checkCatalogueSync({ DB: db }, items);

  assert.equal(result.synced, false, "a tick where COMMON_ITEMS hasn't changed should be a no-op");
  assert.deepEqual(state.itemCatalogue, catalogueAfterFirstSync, "no additional writes on an unchanged-hash tick");
  console.log("  - a repeat tick with the same items does not re-sync (hash-gated)");
}

async function changedItemsTriggersReSync() {
  const originalItems = [{ name: "Melk", category: "Meieri" }];
  const { db, state } = makeFakeDB({ lists: [{ id: 1 }] });
  await checkCatalogueSync({ DB: db }, originalItems);

  const expandedItems = [{ name: "Melk", category: "Meieri" }, { name: "Havregryn", category: "Frokost" }];
  const result = await checkCatalogueSync({ DB: db }, expandedItems);

  assert.equal(result.synced, true, "a changed items array should trigger a re-sync");
  assert.ok(state.itemCatalogue.some((r) => r.list_id === 1 && r.name === "Havregryn"), "the newly-added item should be backfilled into the existing list");
  console.log("  - adding an item and redeploying triggers a re-sync that backfills it");
}

async function customizationsAndCustomItemsSurviveASync() {
  const items = [{ name: "Melk", category: "Meieri" }];
  const { db, state } = makeFakeDB({
    lists: [{ id: 1 }],
    itemCatalogue: [
      { name: "Husholdningens spesialitet", category: "Annet", list_id: 1 }, // a household's own custom item
    ],
  });

  await checkCatalogueSync({ DB: db }, items);

  assert.ok(
    state.itemCatalogue.some((r) => r.name === "Husholdningens spesialitet" && r.list_id === 1),
    "a household's own custom catalogue item should not be touched or removed by a sync"
  );
  console.log("  - a household's custom (non-common) catalogue items are left untouched by a sync");
}

main();
