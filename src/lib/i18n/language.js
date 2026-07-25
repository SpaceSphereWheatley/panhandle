// Per-device UI language (nb/en), stored the same way as theme.js/
// designIntensity.js. Unlike those, a language switch must re-render already
// -committed JSX text, so this module only owns storage + the <html lang>
// side effect — see context/LanguageContext.jsx for the React re-render half.
export const SUPPORTED_LANGUAGES = ["nb", "en"];
const DEFAULT_LANGUAGE = "nb";

// No ph_language has ever been stored before this shipped, so this also
// decides the language for every existing user's next visit, not just new
// ones — an accepted tradeoff (see CHANGELOG) rather than an oversight.
function detectBrowserLanguage() {
  const short = navigator.language?.slice(0, 2);
  return SUPPORTED_LANGUAGES.includes(short) ? short : DEFAULT_LANGUAGE;
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
