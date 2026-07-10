import { iconForItem } from "../lib/itemIcons.js";

export function ItemIcon({ name }) {
  const svg = iconForItem(name);
  if (!svg) return <>{name.charAt(0).toUpperCase()}</>;
  return <span dangerouslySetInnerHTML={{ __html: svg }} />;
}
