import { readCache, writeCache } from "./localCache.js";

// Fully local, personal-only prototype data — not `ph_cache_*` prefixed on
// purpose: those keys are stale-while-revalidate caches of *server* data and
// get wiped on every logout (see localCache.js's clearCache), but there's no
// server copy of this to re-hydrate from. This is the only copy, so it
// should survive a logout/login on the same device, same as e.g.
// ph_onboarding_seen_v1.
const STORAGE_BOXES_KEY = "ph_storage_boxes_v1";

// Seed content for first load, restructured from the original "locations
// with items" mockup into boxes-are-the-primary-entity: each box has its own
// number, a single location string, and its own content list. English-only
// like meal names — throwaway fixture data, not real user content.
const SEED_BOXES = [
  { id: "seed-1", number: "B-001", name: "Christmas decorations", location: "Garage", items: ["Christmas lights", "Ornaments", "Tree stand"] },
  { id: "seed-2", number: "B-002", name: "Tools", location: "Garage", items: ["Tool box", "Extension cords", "Paint cans"] },
  { id: "seed-3", number: "B-003", name: "Winter tires", location: "Garage", items: ["Winter tires (set of 4)"] },
  { id: "seed-4", number: "B-004", name: "Photo albums", location: "Attic", items: ["Old photo albums", "Baby clothes"] },
  { id: "seed-5", number: "B-005", name: "Camping gear", location: "Attic", items: ["Camping tent", "Spare pillows", "Sleeping bags"] },
  { id: "seed-6", number: "B-006", name: "Party supplies", location: "Kitchen cupboard (top shelf)", items: ["Fondue set", "Waffle iron", "Extra glasses", "Picnic basket"] },
  { id: "seed-7", number: "B-007", name: "Games & seasonal decor", location: "Basement shelf 2", items: ["Board games", "Suitcases", "Ski boots", "Fairy lights", "Halloween decorations"] },
];

export function loadBoxes() {
  return readCache(STORAGE_BOXES_KEY, SEED_BOXES);
}

export function saveBoxes(boxes) {
  writeCache(STORAGE_BOXES_KEY, boxes);
}

// "B-001", "B-002", ... — the next unused sequential number, so a box kept
// through edits/deletes never gets renumbered and a new one never collides.
export function nextBoxNumber(boxes) {
  const max = boxes.reduce((m, b) => {
    const match = /^B-(\d+)$/.exec(b.number || "");
    return match ? Math.max(m, parseInt(match[1], 10)) : m;
  }, 0);
  return `B-${String(max + 1).padStart(3, "0")}`;
}

export function newBoxId() {
  return `box_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function matchesQuery(box, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (box.number.toLowerCase().includes(q)) return true;
  if (box.name.toLowerCase().includes(q)) return true;
  if (box.location.toLowerCase().includes(q)) return true;
  return box.items.some((item) => item.toLowerCase().includes(q));
}
