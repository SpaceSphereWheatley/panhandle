# Storage module: boxes, locations, and QR labels

> **Status: design doc, not yet built.** What currently exists is a
> personal-only *prototype* (`src/tabs/StorageTab.jsx`, gated on one account
> plus a Settings → Appearance toggle) that stores everything in
> `localStorage` and has no backend at all. This document scopes out what a
> real, household-shared implementation would take. Nothing below has shipped.

## What problem this solves

"Where did we put the Christmas lights?" — the recurring household question
that a shopping list and meal planner don't answer. Physical storage (garage
shelves, attic, basement, the top of a cupboard) accumulates boxes whose
contents are invisible once the lid is on, and the knowledge of what's in
which box lives in one person's head.

The unit that matters is the **box**, not the location: a box has a number, a
name, a place it currently sits, and a list of what's inside. Locations are
just strings a box points at — "Garage", "Attic shelf 2" — not a separate
hierarchy to navigate. That's the shape the prototype settled on after
starting from the opposite (locations containing items) and finding it
awkward: you don't move a *location*, you move a *box*.

**The make-or-break constraint is upkeep cost.** Inventory apps die when
logging what you put away costs more than the lookup is worth. Every design
decision below should be read against that: fast entry, forgiving search,
and a physical hook (the QR sticker) so the app is reachable from the shelf
rather than only from the couch.

## Data model

Three new tables, all `list_id`-scoped like every other per-list table (see
CLAUDE.md's Multi-tenant model). Expand/contract-safe: additive only.

```sql
-- migrations/00NN_storage_boxes.sql
CREATE TABLE IF NOT EXISTS storage_boxes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  list_id     INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  number      INTEGER NOT NULL,          -- per-list, human-facing, printed on the sticker
  name        TEXT NOT NULL,
  location    TEXT NOT NULL DEFAULT '',
  notes       TEXT NOT NULL DEFAULT '',
  created_by  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  edited_by   TEXT,
  edited_at   TEXT,
  UNIQUE(list_id, number)
);

CREATE TABLE IF NOT EXISTS storage_box_items (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  box_id   INTEGER NOT NULL REFERENCES storage_boxes(id) ON DELETE CASCADE,
  name     TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_storage_box_items_box ON storage_box_items(box_id);

-- Distinct locations get their own table only so renaming "Garage" ->
-- "Garasje" is one write instead of N, and so the location picker has a
-- canonical list to autocomplete from. Boxes still store location by id.
CREATE TABLE IF NOT EXISTS storage_locations (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  list_id INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  name    TEXT NOT NULL,
  UNIQUE(list_id, name COLLATE NOCASE)
);
```

Open question worth deciding before writing the migration: **`location` as a
free-typed string on `storage_boxes` vs. a FK to `storage_locations`.** The
prototype uses a free string with autocomplete, which is lower-friction to
enter and needs no second table. The FK version makes renaming a location
atomic and prevents "Garage"/"garage"/"Garasje" drifting into three places.
Recommendation: **start with the free string** (matching the prototype and
`meal_plan.responsible`'s precedent of tolerating free text), and only add
`storage_locations` if drift actually becomes a problem in practice —
otherwise it's a table earning its keep with a rename operation that might
happen twice a year.

### Why `number` is an integer, per-list

The box number is the whole point of the physical sticker: it's what you read
off the box and what you'd type into search if the QR scan fails. Keeping it
a plain integer (rendered zero-padded to 3 digits — `001`, `002`) rather than
a prefixed string (`B-001`) means:
- it's short enough to hand-write on a box with a marker as a fallback,
- `MAX(number) + 1` is the whole allocation rule,
- it sorts numerically without string-compare surprises past 999.

Numbers are **never reused** after a box is deleted — a sticker on a box in
the garage outlives the row in the database, and re-issuing `007` to a new
box would make an old sticker point at the wrong contents. `MAX(number) + 1`
gives that for free.

## Endpoints (`worker/index.js`)

All `requireAuth`, all scoped to the caller's own `list_id` — same
any-list-member permission level as `/recurring` and `/category-order`.
Storage is household-shared data, not per-device or admin-gated.

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/storage/boxes` | All boxes + their items for the caller's list. One query with a join, assembled server-side, like `GET /list`. |
| `POST` | `/storage/boxes` | Create. Server allocates `number` (`MAX+1` within the list); never accepted from the request body. |
| `PATCH` | `/storage/boxes/{id}` | Name/location/notes/items. Items replace wholesale (the list is small; diffing isn't worth it). Re-check `list_id` before writing. |
| `DELETE` | `/storage/boxes/{id}` | Cascades to `storage_box_items`. |
| `GET` | `/storage/boxes/by-number/{number}` | The QR-scan lookup — resolves a scanned number to a box within the caller's list. |

`storage_boxes`/`storage_box_items`/`storage_locations` all need cleanup in
the two list-deletion cascades (`DELETE /account`'s and
`DELETE /admin/users/{u}`'s last-owner paths), like every other per-list
table — though the `ON DELETE CASCADE` on `list_id` covers it if the `lists`
row itself is deleted.

Error codes to add to `shared/errorCodes.js`: `STORAGE_BOX_NOT_FOUND`,
`STORAGE_BOX_NAME_REQUIRED`, and a cap error if a per-list box limit is
adopted (see Open questions).

## QR codes: what's real vs. what's mocked

**Currently mocked.** `src/components/storage/BoxQrCode.jsx` renders a
deterministic QR-*looking* grid seeded from the box number. It encodes
nothing and cannot be scanned. `QrScanModal.jsx` likewise simulates a scan
with a timer and picks a random box — no camera is touched.

A real implementation needs two things the prototype doesn't have:

1. **Actual QR encoding.** Hand-rolling QR (Reed–Solomon error correction,
   mask pattern selection, version sizing) is materially harder than the ICS
   serialization this project hand-rolled, and closer in risk profile to the
   Web Push payload encryption that justified adding `@pushforge/builder`
   (see CLAUDE.md). **Recommendation: add a small QR encoding dependency**
   rather than hand-roll — same reasoning, documented the same way.
2. **Camera access for scanning.** `BarcodeDetector` is available in Chrome
   and Android WebView (so the TWA gets it) but **not in Safari/iOS**, which
   would need a WASM fallback like `zxing-wasm` or `jsQR` fed from a
   `<video>` frame. Camera access also requires HTTPS (already true) and a
   `getUserMedia` permission prompt.

**What the QR should encode:** a URL, not a bare number —
`https://shop.panhandle.app/b/007`. That way the phone's built-in camera app
resolves it without the Panhandle app being open at all, which is the entire
point of a sticker on a shelf. That implies a new route: `/b/{number}` opens
the app deep-linked to that box (and to the login screen first if signed out,
returning to the box after). Since the number alone isn't a secret and a URL
is guessable, the route must resolve the box **within the authenticated
caller's list** — never globally. A scanned number that doesn't exist in your
list is a clean "no such box", not someone else's data.

**Deep link + scan-jump behavior:** a recognized box goes straight to that
box, with no intermediate "is this the right one?" confirmation — the scan
*is* the confirmation. The prototype already behaves this way (it shows the
match for ~700ms as feedback, then jumps).

### Printable labels

`BoxLabelsModal.jsx` (prototype: exists, prints via `window.print()` and a
`@media print` isolation rule in `index.css`) shows one sticker per box —
QR code and number only, deliberately nothing else, since a box's *name* and
contents change over time while the number never does. A label that says
"Christmas decorations" becomes a lie the first time the box is repurposed;
a label that says `007` never does.

Worth adding for a real version: a paper-size/grid preset (e.g. Avery label
sheet dimensions) and a "print only these boxes" selection, so re-printing
one replacement sticker doesn't mean a full sheet.

## Frontend

Structure already prototyped and reusable nearly as-is:

- `src/tabs/StorageTab.jsx` — search field, box cards, FAB menu (add / scan /
  print labels).
- `src/components/storage/BoxEditModal.jsx` — add and edit share one modal,
  the same way `MealEditModal` handles both.
- `src/components/storage/{BoxQrCode,QrScanModal,BoxLabelsModal}.jsx`.
- `src/lib/storageBoxes.js` — currently the localStorage store; becomes the
  API-calling layer, or is replaced by a `StorageContext` following
  `CategoryOrderContext`'s shape (load once, refresh after writes).

Notable differences from the existing tabs, and why:

- **No 7-second poll.** Unlike `/list` and `/plan`, storage is read-mostly
  reference data — nobody is racing to see a box move. Load on tab activate
  and after writes; that's it. (This is also why it doesn't need presence.)
- **Search is the primary interaction, not browsing.** The value is "type
  'lights', find out it's in box 007 in the garage". The card list is the
  fallback view, not the main event. Server-side search isn't needed at
  household scale (tens to low hundreds of boxes) — filter client-side over
  the loaded set, as the prototype does.
- **Offline**: worth extending `src/lib/writeQueue.js`'s pattern eventually
  (garages and basements are exactly where signal dies), but not in v1 —
  scope it after the online path is proven, same as the shopping list did.

## Photos — deliberately deferred

The single highest-value addition, and the reason this isn't in v1: "what's
in this box" is often faster to convey with one photo of the open box than by
line-itemizing contents. But it's also the only feature in Panhandle that
would need **binary storage** — an R2 bucket, upload/download endpoints,
signed URLs, thumbnailing, and a per-list storage quota. That's a genuine
infrastructure addition, not an incremental one.

Ship text-only first. If the module gets used at all, photos are the obvious
second release; if it doesn't, nothing was spent on R2.

## Rollout plan

1. **Prototype (done).** Personal-only tab, localStorage, mocked QR. Purpose:
   find out whether the interaction is worth building. Currently gated on one
   account + a Settings toggle.
2. **v1 — real backend, no QR.** Migration + endpoints + the frontend wired
   to them; boxes, locations, contents, search, printable *number-only*
   labels. Still hidden behind the account gate. This is the release that
   answers "do we actually keep it up to date?"
3. **v2 — real QR.** Encoding dependency, `/b/{number}` deep-link route,
   camera scanning with the iOS fallback. Ungate the tab for everyone once
   this lands — a storage module without the physical hook is a worse
   version of a notes app.
4. **v3 — photos.** R2, upload, thumbnails, quota.

Each step is independently shippable and independently abandonable, which is
the point of the ordering: the expensive parts (QR libraries, camera, R2)
come after the cheap part has proven the concept.

## Open questions

- **Per-list box cap?** Every other bounded thing in this app has one (10
  users, 710 catalogue items). A cap of a few hundred boxes would bound the
  single `GET /storage/boxes` payload. Probably unnecessary at real household
  scale, but the payload grows unboundedly without it.
- **Locations table or free string?** See Data model above — recommendation
  is free string until proven otherwise.
- **Should a box's contents link to `item_catalogue`?** Tempting ("we already
  know the word 'batteries'"), but the catalogue is groceries — things you
  buy repeatedly and consume. Storage contents are durable goods. Sharing the
  vocabulary would pollute shopping suggestions with "Ski boots". Keep them
  separate.
- **Item-level search across boxes vs. box-level?** Currently a match on any
  item shows the whole box, which is right for "where is X". A future "show
  me every box containing something matching X" view might matter at scale.
- **Does this stay in `AppShell`'s tab bar long-term?** Four tabs is
  comfortable; a fifth (chores, bills — see the broader home-organization
  discussion) would not be. If the app expands further, the nav needs
  rethinking before another tab is added, not after.
