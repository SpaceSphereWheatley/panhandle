// Per-person avatar color, since the real data model has no fixed
// per-person color assigned. Drawn from the shopping-list cluster "on"
// tones for more distinct, higher-contrast per-person colors than a small
// hand-picked palette gives. Shared so the same person gets the same color
// in both MealsTab (responsible-person avatars) and ShoppingListTab
// (presence avatars). 11 entries — more than the 10-user list cap (see
// CLAUDE.md's Multi-tenant model) — so avatarColorForIndex can guarantee
// every current list member a distinct color; `--cluster-spice-on` is
// skipped (same hue as `--accent-primary`) and `--cluster-grains-on`/
// `--cluster-other-on` (both a near-neutral gray, and identical to each
// other) since neither reads as a distinct identity color. Ordered so the
// three orange/red-ish entries (accent-primary, pet, bakery) land far apart
// in the sequence, keeping small households' first few colors maximally
// distinct.
const AVATAR_COLORS = [
  "var(--accent-primary)",
  "var(--cluster-drinks-on)",
  "var(--cluster-meat-on)",
  "var(--cluster-household-on)",
  "var(--cluster-dairy-on)",
  "var(--cluster-care-on)",
  "var(--cluster-snacks-on)",
  "var(--cluster-frozen-on)",
  "var(--cluster-produce-on)",
  "var(--cluster-pet-on)",
  "var(--cluster-bakery-on)",
];

// Color for a known list member, by their position in that list (e.g. the
// index into ListUsersContext's `listUsers`, which the API already returns
// ordered by username — see GET /list-users). Guarantees every member of a
// list up to the 10-user cap gets a distinct color, unlike a hash which can
// collide two members onto the same one.
export function avatarColorForIndex(index) {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

// Hash-based fallback for a name that isn't a current list member (a
// free-typed meal "Other" responsible person, or a since-removed member) —
// there's no list position to key off, so this just needs to be stable, not
// collision-free.
export function avatarColorFor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
