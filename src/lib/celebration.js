// Which "all done" celebration to play (see AllBoughtCelebration.jsx). Random
// each trip, but never the same one twice in a row — with three variants a
// plain Math.random() repeats a third of the time, which reads as "it's
// stuck". `prev` is the last pick (or null); `rand` is injectable for tests.
export const CELEBRATION_VARIANTS = ["bag", "cart", "fridge"];

export function pickCelebration(prev = null, rand = Math.random) {
  const pool = CELEBRATION_VARIANTS.filter((v) => v !== prev);
  const i = Math.min(pool.length - 1, Math.floor(rand() * pool.length));
  return pool[i];
}
