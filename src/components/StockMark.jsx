// Shape cue for a stock level, so colour is never the only signal:
// filled "!" circle = out, half-filled circle = running low, empty ring = fine.
export function StockMark({ status, size = 12 }) {
  const common = { width: size, height: size, viewBox: "0 0 12 12", "aria-hidden": true, className: "stock-mark" };
  if (status === "out") {
    return (
      <svg {...common}>
        <circle cx="6" cy="6" r="6" fill="currentColor" />
        <rect x="5.2" y="2.4" width="1.6" height="4.2" rx=".8" fill="var(--stock-mark-ink, #fff)" />
        <circle cx="6" cy="8.7" r=".95" fill="var(--stock-mark-ink, #fff)" />
      </svg>
    );
  }
  if (status === "low") {
    return (
      <svg {...common}>
        <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M6 1a5 5 0 0 1 0 10z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
