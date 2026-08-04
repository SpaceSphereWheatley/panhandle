# Storage module: boxes, locations, and QR labels

> **Status: decisions locked, not yet built.** What currently exists is a
> personal-only *prototype* (`src/tabs/StorageTab.jsx`, gated on one account
> plus a Settings → Appearance toggle) that stores everything in
> `localStorage` and has no backend at all. This document scopes out what a
> real, household-shared implementation would take. The open questions an
> earlier draft carried have since been answered — see "Decisions" at the
> bottom for the list and the reasoning. Nothing below has shipped.

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

Two new tables plus one column on `lists`, all `list_id`-scoped like every
other per-list table (see CLAUDE.md's Multi-tenant model). Expand/contract-safe:
additive only.

```sql
-- migrations/0027_storage_boxes.sql

-- Monotonic per-list box-number allocator. A plain column on `lists` rather
-- than a new table, matching how users.ics_token_hash/google_sub were each
-- added incrementally. DEFAULT 1 is correct for every existing row since no
-- boxes exist anywhere yet (there is no backend today).
ALTER TABLE lists ADD COLUMN next_box_number INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS storage_boxes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  list_id     INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  number      INTEGER NOT NULL,          -- per-list, human-facing, printed on the sticker
  name        TEXT NOT NULL DEFAULT '',
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
```

`location` is a **free-typed string with autocomplete**, not a FK to a
locations table. It matches the prototype and `meal_plan.responsible`'s
precedent of tolerating free text. A `storage_locations` table would buy
atomic renames and prevent "Garage"/"garage"/"Garasje" drift, but that's a
table earning its keep with an operation that might happen twice a year —
add it only if drift actually becomes a problem in practice.

### Numbering: monotonic, never reused

The box number is the whole point of the physical sticker: it's what you read
off the box and what you'd type into search if the QR scan fails. **Numbers
are never reused after a box is deleted** — a sticker on a box in the garage
outlives the row in the database, and re-issuing `007` to a new box would
make an old sticker point at the wrong contents.

`MAX(number) + 1` does **not** give that. Delete the highest-numbered box and
the next one created reclaims its number, which is precisely the failure the
rule exists to prevent. Allocation therefore goes through the counter:

```sql
UPDATE lists SET next_box_number = next_box_number + 1
WHERE id = ?1 RETURNING next_box_number - 1 AS allocated;
```

One statement, atomic under D1's single-writer SQLite, and it keeps climbing
across deletions. `UNIQUE(list_id, number)` stays as a backstop.

Note the counter and the box cap (below) are independent: the cap bounds
*live rows*, the counter bounds nothing and only ever increases. A household
that has created and deleted 400 boxes is at 0 rows and `next_box_number =
401`.

### Presentation: always zero-padded

Stored as `INTEGER`; **always rendered zero-padded to at least 3 digits** —
`001`, `042`, `1004`. One shared helper, `formatBoxNumber(n)` in
`src/lib/storageBoxes.js` (`String(n).padStart(3, "0")`), used by every
render path: cards, search, labels, deep links. Never format inline.

Plain digits, no letter prefix, so the number is short enough to hand-write
on a box with a marker if a sticker is lost.

Port note: the prototype stores `number` as a zero-padded *string* and
`nextBoxNumber`/`matchesQuery` both assume that. Both need updating for the
integer column — cf. `0020_fix_category_order_types.sql` for what happens
when a numeric value lands in a text-affinity column.

## Access gating

The module ships hidden and stays hidden until it's proven in real use (see
Rollout). Today's gate is client-side only: `STORAGE_TAB_USER` in
`src/lib/storageModule.js`, whose own comment correctly notes it is *"not a
security boundary: this tab has no real data or backend behind it."*

**That reasoning expires the moment endpoints exist.** A hidden tab does
nothing to stop any account from calling `POST /storage/boxes` directly, so
v1 adds a server-side check alongside the UI gate:

- `hasStorageAccess(username, env)` in `worker/index.js`, reading a
  comma-separated `STORAGE_BETA_USERNAMES` env var — same shape as
  `isSuperAdmin`/`SUPERADMIN_USERNAMES`.
- Every `/storage/*` route checks it after `requireAuth`, returning `403`
  with `STORAGE_NOT_ENABLED`.
- Ungating at launch is then deleting the check, not editing code *and*
  chasing an env var.

Placement: `[vars]` in `wrangler.toml` rather than a dashboard secret. These
are email addresses, not credentials, and one is already version-controlled
in `storageModule.js` — keeping it in the repo makes the eventual removal
visible in the diff.

## Endpoints (`worker/index.js`)

All `requireAuth` + `hasStorageAccess`, all scoped to the caller's own
`list_id` — same any-list-member permission level as `/recurring` and
`/category-order`. Storage is household-shared data, not per-device or
admin-gated.

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/storage/boxes` | All boxes + their items for the caller's list. One query with a join, assembled server-side, like `GET /list`. |
| `POST` | `/storage/boxes` | Create. Server allocates `number` via the counter; never accepted from the request body. Enforces the cap. |
| `PATCH` | `/storage/boxes/{id}` | Name/location/notes/items. Items replace wholesale (the list is small; diffing isn't worth it). Re-check `list_id` before writing. |
| `DELETE` | `/storage/boxes/{id}` | Cascades to `storage_box_items`. Does **not** decrement the counter. |
| `GET` | `/storage/boxes/by-number/{number}` | The QR/deep-link lookup — resolves a scanned number to a box within the caller's list. |
| `POST` | `/storage/boxes/reserve` | Body `{ count }`. Bumps the counter by `count` and returns the allocated numbers **without creating rows** — see Printable labels. `count` bounded to 60 (5 sheets). |

**Per-list cap: 300 live boxes.** `GET /storage/boxes` returns every box and
every box's items in one payload, which grows unboundedly otherwise, and
every other bounded thing in this app has a cap (10 users, 710 catalogue
items). Enforced on `POST /storage/boxes`; returns `STORAGE_BOX_LIMIT`.

`storage_boxes`/`storage_box_items` need cleanup in the two list-deletion
cascades (`DELETE /account`'s and `DELETE /admin/users/{u}`'s last-owner
paths), like every other per-list table — though the `ON DELETE CASCADE` on
`list_id` covers it if the `lists` row itself is deleted.

Error codes to add to `shared/errorCodes.js` (plus `nb.js` entries):
`STORAGE_BOX_NOT_FOUND`, `STORAGE_BOX_NAME_REQUIRED`, `STORAGE_BOX_LIMIT`,
`STORAGE_NOT_ENABLED`.

## QR codes

**Currently mocked.** `src/components/storage/BoxQrCode.jsx` renders a
deterministic QR-*looking* grid seeded from the box number. It encodes
nothing and cannot be scanned. `QrScanModal.jsx` likewise simulates a scan
with a timer and picks a random box — no camera is touched.

### Generation and scanning are separable — and only generation is v1

The expensive, platform-hairy half of QR is the *scanner*:
`BarcodeDetector` exists in Chrome and Android WebView (so the TWA gets it)
but **not in Safari/iOS**, which needs a WASM fallback like `zxing-wasm` or
`jsQR` fed from a `<video>` frame, plus a `getUserMedia` permission prompt.

None of that is needed to *print a working sticker*. If the code encodes a
URL, the phone's built-in camera app resolves it with Panhandle closed —
which is the entire point of a sticker on a shelf. So **real QR generation
ships in v1** and only the in-app scanner waits for v2. This matters
practically: shipping number-only labels first would mean reprinting and
re-applying every sticker in the house when v2 lands.

**Encoding library, not hand-rolled.** Reed–Solomon error correction, mask
pattern selection and version sizing are materially harder than the ICS
serialization this project hand-rolled, and closer in risk profile to the
Web Push payload encryption that justified adding `@pushforge/builder` (see
CLAUDE.md). Recommendation: **`qrcode`**, using its SVG string output —
vector output keeps print sharp at any size, and it's frontend-only, so the
Worker bundle is untouched. Error correction level **Q** (25%), since these
stickers live in garages and basements and will get scuffed.

**What the QR encodes:** `https://shop.panhandle.app/b/007` — a URL, not a
bare number. At ~32 characters it stays a low-density code even at level Q,
which is what makes it scan quickly in bad light.

That implies a new route, `/b/{number}`:
- The Worker proxies non-`/api/*` paths to Pages, so `/b/*` 404s unless
  handled — add it to the ROUTING section to serve the app shell.
- The frontend reads `location.pathname` on boot and deep-links to the box.
- Signed out, it stores the pending link, shows login, and returns to the box
  afterwards.
- The number is not a secret and the URL is guessable, so the route resolves
  the box **within the authenticated caller's list**, never globally. A
  number that doesn't exist in your list is a clean "no such box" — never
  someone else's data.

**Deep link + scan-jump behavior:** a recognized box goes straight to that
box, with no intermediate "is this the right one?" confirmation — the scan
*is* the confirmation. The prototype already behaves this way (it shows the
match for ~700ms as feedback, then jumps).

## Printable labels: A4

`BoxLabelsModal.jsx` (prototype: exists, prints via `window.print()`) shows
one sticker per box — QR code and number only, deliberately nothing else,
since a box's *name* and contents change over time while the number never
does. A label that says "Christmas decorations" becomes a lie the first time
the box is repurposed; a label that says `007` never does.

**Sheet: A4, plain paper, cut-apart grid.** 3 columns × 4 rows = 12 labels
per sheet. A4 is 210 × 297 mm; at a 10 mm margin the usable area is
190 × 277 mm, giving ~63 × 69 mm cells — QR at ~45 mm with the zero-padded
number beneath. Plain paper with dashed cut guides rather than an Avery
preset: no special label stock to buy, and a 45 mm code is generous enough to
scan across a dim garage. Avery presets (L7160, L7165) are a later
refinement if the cutting gets tedious.

```css
@page { size: A4; margin: 10mm; }
```

**The current print CSS does not survive multi-page output.** `index.css`'s
`@media print` block hides siblings with `visibility: hidden` and pulls
`.storage-print-labels` out with `position: absolute` — fine for one
screenful, but absolutely-positioned content doesn't paginate, and 12 labels
per sheet means a full household is ~25 sheets. Rewrite it to `display: none`
the siblings and leave the grid in normal flow, with
`break-inside: avoid` on each sticker so none is split across a page break.

### Two print paths, one modal

Both requested, and they share the grid:

1. **Reprint existing boxes.** Checkbox selection over the box list, with
   select-all/none, so replacing one lost sticker doesn't cost a full sheet.
   This also covers "print the box I just created".
2. **Print new, unassigned codes.** Pick a count, `POST
   /storage/boxes/reserve` bumps the counter and hands back that many
   numbers, and the sheet prints them. **No rows are created** — the numbers
   are simply burned, which is exactly what a monotonic counter makes cheap.
   You label a stack of empty boxes in one pass, then fill each one in later
   by scanning it.

Path 2 is the one that attacks the upkeep-cost problem head-on: the sticker
goes on at packing time, and the contents get typed whenever. Because no row
exists yet, scanning a reserved number lands on "no box 013 — set it up?",
which is also the right screen for a number whose box was deleted. One
behavior, both cases, no placeholder rows and no empty-name exception to the
`STORAGE_BOX_NAME_REQUIRED` rule.

## Frontend

Structure already prototyped and reusable nearly as-is:

- `src/tabs/StorageTab.jsx` — search field, box cards, FAB menu (add / scan /
  print labels).
- `src/components/storage/BoxEditModal.jsx` — add and edit share one modal,
  the same way `MealEditModal` handles both.
- `src/components/storage/{BoxQrCode,QrScanModal,BoxLabelsModal}.jsx`.
- `src/lib/storageBoxes.js` — currently the localStorage store; becomes a
  `StorageContext` following `CategoryOrderContext`'s shape (load once,
  refresh after writes), keeping `formatBoxNumber`/`matchesQuery` as pure
  helpers.

Translations are **already done**: 35 `storage.*` keys exist in both
`en.js` and `nb.js`, so v1 adds only the handful of new strings the reserve
and selection flows need.

Notable differences from the existing tabs, and why:

- **No 7-second poll.** Unlike `/list` and `/plan`, storage is read-mostly
  reference data — nobody is racing to see a box move. Load on tab activate
  and after writes; that's it. (This is also why it doesn't need presence.)
- **Search is the primary interaction, not browsing.** The value is "type
  'lights', find out it's in box 007 in the garage". The card list is the
  fallback view, not the main event. Server-side search isn't needed at
  household scale — filter client-side over the loaded set, as the prototype
  does, which the 300-box cap keeps honest.
- **Offline**: worth extending `src/lib/writeQueue.js`'s pattern eventually
  (garages and basements are exactly where signal dies), but not in v1 —
  scope it after the online path is proven, same as the shopping list did.

## Photos: out of scope

Not building this. Photos would be the only feature in Panhandle needing
**binary storage** — an R2 bucket, upload/download endpoints, signed URLs,
thumbnailing, and a per-list quota — which is a genuine infrastructure
addition rather than an incremental one. Text contents only. Decided, not
deferred; nothing in the schema above anticipates it.

## Rollout plan

1. **Prototype (done).** Personal-only tab, localStorage, mocked QR. Purpose:
   find out whether the interaction is worth building.
2. **v1 — real backend + real QR.** Migration, endpoints (with the
   server-side gate), the frontend wired to them, the `/b/{number}` deep
   link, and A4 label sheets that print genuinely scannable codes. Still
   hidden behind the account gate. This is the release that answers "do we
   actually keep it up to date?" — and every sticker printed during it stays
   valid forever.
3. **v2 — in-app scanner + launch.** `BarcodeDetector` with the iOS WASM
   fallback, so scanning works without leaving the app. Remove the gate
   (client and server) once this lands and the module has proven itself in
   real use.

Each step is independently shippable and independently abandonable. The
ordering puts the cheap, durable part first: v1's physical output doesn't
need redoing if v2 never happens, since a native camera already resolves the
codes.

**Versioning:** v1 changes the Worker and adds a migration, so it bumps
`VERSION` per CLAUDE.md's rule. But the tab stays invisible to everyone bar
the gated account, so there is nothing user-facing to announce — follow the
prototype's precedent (commits `2b3a096` → `5c7468a`) and keep it out of
`CHANGELOG.md` until the v2 launch, which gets the real entry.

## Decisions

| Question | Decision |
| --- | --- |
| Server-side gate, or UI-only? | **Server-side too** — `hasStorageAccess` + `STORAGE_BETA_USERNAMES`, `403 STORAGE_NOT_ENABLED`. |
| Number allocation | **Monotonic `lists.next_box_number`**, never reused. `MAX+1` was wrong. |
| Number storage/presentation | Stored `INTEGER`, **always rendered zero-padded** via `formatBoxNumber`. |
| Per-list box cap | **300 live boxes.** |
| Location: free string or FK table? | **Free string** with autocomplete; revisit only if drift bites. |
| Contents linked to `item_catalogue`? | **No.** Groceries are consumed and repurchased; storage contents are durable goods. Sharing vocabulary would pollute shopping suggestions with "Ski boots". |
| Photos / R2 | **Not building.** |
| Label paper | **A4**, 3 × 4 = 12 per sheet, plain paper with cut guides. |
| Printing | **Both** — selective reprint of existing boxes, and reserve-and-print of new unassigned numbers. |
| Real QR in v1 or v2? | **v1.** Generation is separable from scanning; native cameras resolve the URL, so stickers get printed once. |
| Launch | **Stays hidden** through v1. Ungate at v2, once it works well. |

## Still open

- **Item-level search across boxes vs. box-level.** Currently a match on any
  item shows the whole box, which is right for "where is X". A future "show
  me every box containing something matching X" view might matter at scale.
- **Does this stay in `AppShell`'s tab bar long-term?** Four tabs is
  comfortable; a fifth (chores, bills — see the broader home-organization
  discussion) would not be. If the app expands further, the nav needs
  rethinking before another tab is added, not after. Not blocking v1, since
  the tab is hidden anyway.
