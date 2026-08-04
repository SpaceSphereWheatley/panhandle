import { useMemo } from "react";
import QRCode from "qrcode";

// Real, scannable QR code (docs/storage-module-plan.md's v1 QR generation —
// replaces the earlier deterministic fake grid, which encoded nothing).
// `qrcode` is a small, dependency-free encoding library — Reed-Solomon error
// correction and mask-pattern selection carry more risk to get right by hand
// than a focused library does, same reasoning as @pushforge/builder's Web
// Push payload encryption (see CLAUDE.md). QRCode.create() is synchronous
// and returns a plain bit matrix (no canvas/DOM), which lets this render as
// inline <rect> cells colored via the app's own CSS custom properties —
// matching the rest of the app's theming — instead of using the library's
// own (fixed-color) toString/toCanvas renderers.
// Error-correction level Q (25%): these stickers live in garages and
// basements and will get scuffed.
export function BoxQrCode({ value, label, size = 96 }) {
  const modules = useMemo(() => QRCode.create(value, { errorCorrectionLevel: "Q" }).modules, [value]);
  const grid = modules.size;
  const cells = [];
  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < grid; x++) {
      if (modules.data[y * grid + x]) cells.push([x, y]);
    }
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${grid} ${grid}`} role="img" aria-label={label || value}>
      <rect width={grid} height={grid} fill="var(--surface-card)" />
      {cells.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="var(--text-primary)" />
      ))}
    </svg>
  );
}
