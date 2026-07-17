// Always-open labeled block inside a subpage Card — a divider, a bold
// label, and spaced-out content. The single labeled-block primitive for
// every Settings subpage (a subpage has room, so nothing needs to be
// hidden behind a collapse/accordion) — used for both simple fields and
// repeating/list content alike, so every subpage shares one visual
// language rather than several.
export function SubpageSection({ label, description, children }) {
  return (
    <div style={{ borderTop: "1px solid var(--border-default)", marginTop: 12, paddingTop: 12 }}>
      {label ? (
        <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-md)", fontWeight: 600, color: "var(--text-primary)" }}>
          {label}
        </div>
      ) : null}
      {description ? (
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: 4 }}>{description}</div>
      ) : null}
      <div style={{ marginTop: 10 }}>{children}</div>
    </div>
  );
}
