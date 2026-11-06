// Stock level of a suggested item ("out" / "low" / "ok"), computed by the
// server (worker `stockStatus`) and shown as a tinted tile plus a shape mark
// so colour is never the only cue. Pure helpers, shared by the strip and grid.

export const STOCK_ORDER = ["out", "low", "ok"];

// Items bought fewer times than this have a shaky learned interval, so the UI
// marks them as "still learning". A household-set interval is never shaky.
export const LEARNING_BELOW_PURCHASES = 4;

export function stockStatusOf(item) {
  return STOCK_ORDER.includes(item?.status) ? item.status : "out";
}

export function isLearning(item) {
  return !item.repeat_every_days && (item.times_bought ?? 0) < LEARNING_BELOW_PURCHASES;
}

// What the shopping tab's strip and FAB badge care about: things that need
// attention now, i.e. everything except "fine for now".
export function needsAttention(items) {
  return items.filter((it) => stockStatusOf(it) !== "ok");
}
