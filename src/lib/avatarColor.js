// Deterministic-but-varied avatar color per person, since the real data
// model has no fixed per-person color assigned. Drawn from the
// shopping-list cluster "on" tones for more distinct, higher-contrast
// per-person colors than a small hand-picked palette gives. Shared so the
// same person gets the same color in both MealsTab (responsible-person
// avatars) and ShoppingListTab (presence avatars).
const AVATAR_COLORS = [
  "var(--accent-primary)",
  "var(--cluster-meat-on)",
  "var(--cluster-drinks-on)",
  "var(--cluster-care-on)",
  "var(--cluster-snacks-on)",
  "var(--cluster-frozen-on)",
  "var(--cluster-bakery-on)",
  "var(--cluster-household-on)",
];

export function avatarColorFor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
