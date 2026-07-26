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

// Monday-first weekday names, capitalized — the order recurring_schedule's
// day_of_week uses (0 = Monday). Derived from Intl rather than a second
// hardcoded array per language, so adding a language only means adding a
// DATE_LOCALES entry. 2024-01-01 is a Monday; the seven days from it cover
// exactly one week.
export function weekdayNames(lang) {
  const locale = dateLocale(lang);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2024, 0, 1 + i);
    const name = d.toLocaleDateString(locale, { weekday: "long" });
    return name.charAt(0).toUpperCase() + name.slice(1);
  });
}
