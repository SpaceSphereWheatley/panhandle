// Deterministic fake QR code — same box number always renders the same
// pattern, so it looks stable across re-renders/re-opens, but it encodes
// nothing and can't actually be scanned. Purely a visual stand-in for the
// "each box gets a scannable label" idea (see QrScanModal.jsx for the other
// half of the mockup); a real implementation would need an actual QR
// encoding library and a generated URL/id to point at.
function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(h, 31) + str.charCodeAt(i)) >>> 0;
  return h || 1;
}

// Tiny xorshift PRNG seeded from the hash above, so the "noise" cells are
// reproducible per value without pulling in a real random/crypto dependency.
function seededBits(seed, count) {
  let x = seed;
  const bits = [];
  for (let i = 0; i < count; i++) {
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17;
    x ^= x << 5; x >>>= 0;
    bits.push((x & 1) === 1);
  }
  return bits;
}

const GRID = 9;

export function BoxQrCode({ value, size = 96 }) {
  const bits = seededBits(hashString(value), GRID * GRID);
  const cells = [];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const inTL = x < 3 && y < 3;
      const inTR = x >= GRID - 3 && y < 3;
      const inBL = x < 3 && y >= GRID - 3;
      let on = bits[y * GRID + x];
      if (inTL || inTR || inBL) {
        // Ring-shaped "finder pattern" in each corner, like a real QR code,
        // instead of random noise there — the visual cue that reads as
        // "this is a QR code" at a glance.
        const lx = inTR ? x - (GRID - 3) : x;
        const ly = inBL ? y - (GRID - 3) : y;
        on = lx === 0 || lx === 2 || ly === 0 || ly === 2 || (lx === 1 && ly === 1);
      }
      if (on) cells.push([x, y]);
    }
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${GRID} ${GRID}`} role="img" aria-label={value}>
      <rect width={GRID} height={GRID} fill="var(--surface-card)" />
      {cells.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="var(--text-primary)" />
      ))}
    </svg>
  );
}
