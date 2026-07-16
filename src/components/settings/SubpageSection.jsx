// Always-open labeled block inside a subpage Card — the same divider,
// label typography, and spacing as AccordionRow (see AccordionRow.jsx),
// minus the button/chevron/collapse behavior. Use this for simple fields
// that don't need to be hidden (a subpage has room); use AccordionRow for
// genuinely repeating/list content that benefits from being collapsed by
// default. Sharing the same chrome keeps the two feeling like one system
// rather than two different subpage languages.
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
