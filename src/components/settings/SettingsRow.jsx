import { UiIcon } from "../UiIcon.jsx";

const TONE_BG = {
  primary: "var(--accent-primary-subtle)",
  secondary: "var(--accent-secondary-subtle)",
};
const TONE_FG = {
  primary: "var(--accent-primary)",
  secondary: "var(--accent-secondary)",
};

// M3-Expressive settings row: a leading icon in a tonal-container chip,
// a headline with optional supporting text, and one of three trailing
// treatments — a chevron (onClick, navigates to a subpage), an inline
// control (e.g. Switch, via `trailing`), or a full-width control rendered
// below the label (e.g. SegmentedControl, via `stackedControl`).
export function SettingsRow({ icon, tone = "primary", label, supportingText, onClick, trailing, stackedControl }) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: stackedControl ? 10 : 0,
        width: "100%",
        padding: "12px 16px",
        border: "none",
        background: "none",
        textAlign: "left",
        cursor: onClick ? "pointer" : "default",
        font: "inherit",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {icon && (
          <span
            style={{
              width: 36,
              height: 36,
              borderRadius: "var(--radius-md)",
              background: TONE_BG[tone],
              color: TONE_FG[tone],
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <UiIcon name={icon} size={18} />
          </span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: "var(--text-md)", fontWeight: 600, color: "var(--text-primary)" }}>
            {label}
          </div>
          {supportingText ? (
            <div
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--text-tertiary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {supportingText}
            </div>
          ) : null}
        </div>
        {trailing}
        {onClick ? <UiIcon name="caretRight" size={16} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} /> : null}
      </div>
      {stackedControl ? <div style={{ paddingLeft: icon ? 48 : 0 }}>{stackedControl}</div> : null}
    </Wrapper>
  );
}
