// A titled strip bled out to the edges of the Card it sits inside (matching
// Card's padding="lg" 24px inset). Ties a section's title directly to its
// content block instead of a label floating above an otherwise plain card,
// so each top-level Settings section reads as one clearly bounded unit.
// No border-radius here — --radius-card is a 4-value asymmetric "blob"
// shape at the default design intensity, which can't be recomposed into a
// top-corners-only shorthand. The parent Card must set overflow: "hidden"
// so this bleed gets clipped to whatever shape the card actually has.
//
// `style` lets a caller override the default top-of-card margin (e.g. a
// second header used as a mid-card divider between two grouped subsections,
// like ProfileIsland's "Konto"/"Appinnstillinger" split) while keeping the
// same left/right bleed and visual treatment.
export function SectionHeader({ children, style }) {
  return (
    <div
      style={{
        margin: "-24px -24px 18px",
        padding: "14px 24px",
        background: "var(--surface-sunken)",
        borderBottom: "1px solid var(--border-default)",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-sm)",
        fontWeight: 700,
        color: "var(--text-primary)",
        letterSpacing: "var(--tracking-wide)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
