// Maps the app's UI language (nb/en) to the BCP-47 tag passed to Intl /
// Date#toLocaleDateString. Without this, every date in the app formats with a
// hardcoded "no-NO" — so an English UI would still print "mandag 27. juli",
// which reads as a bug rather than a missing translation.
//
// en-GB (not en-US) deliberately: it keeps the day-before-month order the
// Norwegian layout already uses, so switching language changes the words
// without reflowing every date row.
const DATE_LOCALES = { nb: "nb-NO", en: "en-GB" };
const DEFAULT_LOCALE = DATE_LOCALES.nb;

export function dateLocale(lang) {
  return DATE_LOCALES[lang] || DEFAULT_LOCALE;
}
