# Local-first software & CRDTs — research note

A one-off research pass (no code changes) on whether local-first
architecture / CRDTs are worth adopting in Panhandle. Written up here rather
than left only in chat since it's a recurring question worth a stable
answer. Not required reading for day-to-day work — see `architecture-notes.md`
for that.

## The concepts, briefly

**Local-first software** (the term and its 7 ideals come from Ink & Switch's
2019 essay "Local-first software: you own your data, in spite of the
cloud") describes apps where the local device holds a full read/write
replica of the data: every read and write hits local disk first (so the UI
is instant and works offline), and a background process syncs that replica
with other devices/a server opportunistically. The cloud, if present, is a
sync relay, not the sole source of truth. Ideals: fast (no spinners),
multi-device, offline-capable, real-time multi-user collaboration, data
that outlives any one vendor/service, privacy/security by default, and the
user keeps ultimate control of their data.

**CRDTs** (Conflict-free Replicated Data Types) are the data-structure
technique that makes the "multiple replicas, edited independently,
converge automatically" part of that possible without a central
coordinator. A CRDT's merge operation is commutative, associative, and
idempotent, so any two replicas that have seen the same set of updates —
in any order, any number of times — end up in the same state ("strong
eventual consistency"). Common building blocks: G-Counter/PN-Counter
(counters that merge by taking per-replica max/sum), G-Set/OR-Set (sets
that merge by union, with tombstones or unique add-tags to handle
concurrent add/remove), LWW-Register (last-write-wins by timestamp), and
sequence CRDTs like RGA (used by Automerge/Yjs for collaborative text).
Real-world users: Figma (OT, a cousin of CRDTs), Linear's sync engine,
Notion's offline mode, and libraries like Automerge, Yjs, Replicache,
ElectricSQL, PowerSync.

## What Panhandle already does

Panhandle is **not** local-first today, deliberately: D1 is the single
source of truth, the Worker is authoritative, and the frontend polls
`/list` and `/plan` every 7s (see Data flow in `CLAUDE.md`). There's no
local replica of the full dataset — just a `localStorage` snapshot for
display continuity.

That said, two pieces of the existing design already do CRDT-*shaped*
things, informally:

- **The offline write queue (TODO #113, `src/lib/writeQueue.js`)** is a
  bespoke, narrow-scope version of local-first's "fast + offline-capable"
  ideals: optimistic local writes, a durable FIFO queue for the three
  in-aisle mutations (add/toggle/important), replayed on reconnect. It
  doesn't need general conflict resolution because delivery is
  at-least-once against an idempotent-by-construction server API, not
  because it merges concurrent states.
- **`POST /list`'s duplicate-add merge** (`worker/index.js`, the `/list`
  POST handler) does `qty = qty + addQty` when an identical unbought line
  already exists — that's exactly a PN-Counter merge rule (concurrent
  increments compose additively rather than one clobbering the other),
  arrived at independently rather than by reaching for CRDT theory.
- **`meal_plan`'s `ON CONFLICT(plan_date) DO UPDATE`** is, in effect, an
  LWW-Register keyed by date: whichever write lands last for a given day
  wins, which is the correct and sufficient semantics for "one meal per
  day."

## Is a real CRDT/local-first adoption worth it here?

No, not at the current scale, and this note's conclusion is not to pursue
it. Reasoning:

- **Conflict rate is low by construction.** A household is 1–10 people
  (`SUPERADMIN`-gated multi-tenant model, see `CLAUDE.md`), realistically
  1–2 concurrent shoppers, briefly offline (one aisle with no signal), not
  days disconnected. The write queue plus the server's dedup-on-add already
  cover the actual failure mode TODO #113 was written for.
- **The cost of a real CRDT layer is large and structural.** It would mean
  replacing D1-as-relational-source-of-truth with a document/CRDT store (or
  a CRDT layer synced into D1), rewriting the Worker's REST routes as a
  sync protocol, adding a client library (Automerge/Yjs — a real,
  non-trivial dependency, unlike this app's otherwise-hand-rolled-crypto
  stance, see Push notifications' `@pushforge/builder` precedent for what
  "worth a dependency" looks like here), and reasoning about tombstone
  growth/garbage collection for sets. None of that is justified by any
  open bug — there's no open TODO describing data loss or surprising merge
  behavior from concurrent edits.
- **D1 doesn't have a native local-first story.** Sync engines that pair
  well with SQLite/Postgres (ElectricSQL is Postgres-only; PowerSync
  targets Postgres/MySQL/MongoDB backends with its own sync service) don't
  target Cloudflare D1 directly, so adopting one would mean migrating off
  D1 as well — a much bigger change than this app's actual pain point.

## Where the concepts would earn their keep, if priorities changed

Worth revisiting only if usage actually changes shape:

- **Longer offline windows** (e.g. a cabin/camping trip with no signal for
  a day, both members editing) would start to expose the write queue's
  real limit: it replays *ops*, not merges *states*, so two devices that
  both went offline and both mutated the same line (e.g. one toggles
  bought while the other marks important) resolve by last-request-wins on
  reconnect, not by combining both intents. A CRDT-backed `list_items`
  (fields as independent LWW-registers, so a toggle and an important-flip
  from two different offline devices both survive instead of one
  overwriting the other) would fix that class of bug — but it's
  speculative; no bug report describes it happening.
- **True peer-to-peer sync** (phone-to-phone without the Worker as a
  relay) is the other scenario where CRDTs are the standard answer — not
  a current goal for this app.
- **Item quantity specifically** is the one field where explicitly
  generalizing the existing ad hoc PN-Counter-like merge (currently just
  one hardcoded `qty = qty + addQty` SQL statement) into an actual counter
  CRDT would only matter if adds started happening concurrently offline
  from multiple devices against the *same* line — today the merge already
  handles that at the server, so there's nothing to fix.

**Bottom line:** the app already independently reinvented the two CRDT
patterns (PN-Counter-style additive merge, LWW-Register) that actually fit
its two conflict-prone fields (quantity, one-meal-per-day), via ordinary
SQL rather than a library — which is the right amount of "CRDT thinking"
for a 1–10 person household app. Formal CRDTs/local-first architecture
would be over-engineering unless the offline-duration or concurrency
profile changes materially.
