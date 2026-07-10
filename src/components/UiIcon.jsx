import { uiIcon } from "../lib/uiIcons.js";

export function UiIcon({ name, size = 22 }) {
  const html = uiIcon(name, size);
  if (!html) return null;
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}
