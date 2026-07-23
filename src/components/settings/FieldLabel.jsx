// The small caption that sits above a Settings input — one shared component
// so every field label is the same size/tone instead of being re-inlined per
// subpage (KontoSubpage's fieldLabelStyle const, VarslerSubpage's three
// copies, MembersIsland/AdminSubpage's sr-only labels). Pass `visuallyHidden`
// for inputs whose adjacent context already names them (e.g. an "Legg til
// medlem" section with a Navn placeholder) but that still need a programmatic
// label for screen readers.
export function FieldLabel({ htmlFor, children, visuallyHidden = false, style }) {
  if (visuallyHidden) {
    return (
      <label htmlFor={htmlFor} className="sr-only">
        {children}
      </label>
    );
  }
  return (
    <label
      htmlFor={htmlFor}
      style={{
        display: "block",
        fontSize: "var(--text-xs)",
        color: "var(--text-secondary)",
        marginBottom: 4,
        ...style,
      }}
    >
      {children}
    </label>
  );
}
