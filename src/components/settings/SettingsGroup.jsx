import { Children } from "react";
import { Card } from "../../design-system/index.js";

// Rounded container that clusters related SettingsRows with hairline
// dividers between them — the M3-Expressive "grouped list" building block:
// several small clusters with breathing room between them, rather than one
// long undifferentiated list or one Card per section.
export function SettingsGroup({ label, children }) {
  const rows = Children.toArray(children).filter(Boolean);
  if (rows.length === 0) return null;
  return (
    <div style={{ marginBottom: 20 }}>
      {label ? (
        <div
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "var(--text-2xs)",
            fontWeight: 700,
            letterSpacing: "var(--tracking-wide)",
            color: "var(--text-tertiary)",
            textTransform: "uppercase",
            margin: "0 0 8px 16px",
          }}
        >
          {label}
        </div>
      ) : null}
      <Card padding="none" style={{ overflow: "hidden" }}>
        {rows.map((row, i) => (
          <div key={row.key ?? i} style={{ borderTop: i > 0 ? "1px solid var(--border-default)" : "none" }}>
            {row}
          </div>
        ))}
      </Card>
    </div>
  );
}
