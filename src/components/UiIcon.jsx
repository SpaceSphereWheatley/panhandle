import { uiIconSlug } from "../lib/uiIcons.js";

export function UiIcon({ name, size = 22, weight = "regular", style }) {
  const slug = uiIconSlug(name);
  if (!slug) return null;
  return (
    <i
      className={`ph ${weight === "fill" ? "ph-fill" : ""} ph-${slug} ui-icon`}
      style={{ fontSize: size, lineHeight: 1, ...style }}
      aria-hidden="true"
    />
  );
}
