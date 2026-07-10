import { uiIconSlug } from "../lib/uiIcons.js";

export function UiIcon({ name, size = 22 }) {
  const slug = uiIconSlug(name);
  if (!slug) return null;
  return <i className={`ph ph-${slug} ui-icon`} style={{ fontSize: size, lineHeight: 1 }} aria-hidden="true" />;
}
