// Maps the app's semantic icon names to Phosphor Icons (Regular weight)
// slugs, per the Panhandle Design System (which specifies Phosphor via a
// CDN <link> in app.html — see components/*.jsx in the design project).
// Distinct from itemIcons.js (hand-drawn catalogue item icons), which is
// unrelated to this system and untouched.
export const UI_ICON_SLUGS = {
  cart: "shopping-cart-simple",
  utensils: "cooking-pot",
  settings: "gear",
  trash: "trash",
  more: "dots-three-vertical",
  check: "check-bold",
  close: "x",
  download: "download-simple",
  chevronDown: "caret-down",
  list: "list-bullets",
  grid: "squares-four",
  back: "caret-left",
  plus: "plus",
  caretRight: "caret-right",
};

export function uiIconSlug(name) {
  return UI_ICON_SLUGS[name] || name;
}
