// Per-device UI language (nb/en), stored the same way as theme.js/
// designIntensity.js. Unlike those, a language switch must re-render already
// -committed JSX text, so this module only owns storage + the <html lang>
// side effect — see context/LanguageContext.jsx for the React re-render half.
export const SUPPORTED_LANGUAGES = ["nb", "en"];

// The language a device opens in when nothing is stored and the browser's own
// locale isn't one we support. English: the app is now open to non-Norwegian
// testers/users, so the unrecognized-locale fallback shouldn't assume a
// Norwegian household anymore. A Norwegian browser ("nb"/"no") is still
// detected explicitly below and opens in Norwegian either way.
const DEFAULT_UI_LANGUAGE = "en";

function detectBrowserLanguage() {
  const short = navigator.language?.slice(0, 2);
  if (short === "no") return "nb";
  return SUPPORTED_LANGUAGES.includes(short) ? short : DEFAULT_UI_LANGUAGE;
}

export function currentLanguage() {
  const stored = localStorage.getItem("ph_language");
  return SUPPORTED_LANGUAGES.includes(stored) ? stored : detectBrowserLanguage();
}

export function applyLanguage(lang) {
  document.documentElement.lang = lang;
}

export function setLanguage(lang) {
  localStorage.setItem("ph_language", lang);
  applyLanguage(lang);
}
