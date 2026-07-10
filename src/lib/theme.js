// Light / dark / follow-system theme. The initial value is applied by an
// inline script in index.html (before the stylesheet loads, to avoid a flash
// of the wrong palette) — this module just handles later changes.
export function currentTheme() {
  return localStorage.getItem("ph_theme") || "system";
}

export function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  // Keep the PWA status-bar colour in step with the *effective* theme.
  const dark = t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#1B1A17" : "#F5F1ED");
}

export function setTheme(t) {
  localStorage.setItem("ph_theme", t);
  applyTheme(t);
}

// When following the OS and it switches, the CSS updates automatically; nudge
// applyTheme so the status-bar colour follows too.
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (currentTheme() === "system") applyTheme("system");
});
