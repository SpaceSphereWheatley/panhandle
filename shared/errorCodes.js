// Stable machine-readable codes for every error the Worker returns, plus the
// canonical Norwegian message for each. Imported by worker/index.js (which
// answers with `{ error, code }` — see `err()` there) and by the frontend's
// nb dictionary, which derives its `error.*` entries straight from this map
// rather than restating the same 50 strings (src/lib/i18n/dictionaries/nb.js).
// Same single-source pattern as CATEGORIES and VERSION.
//
// Why codes at all: the `error` string is Norwegian and was shown to the user
// verbatim, so an English UI leaked Norwegian on every failed request. The
// code is what the client translates; `error` is still sent alongside it and
// still correct, so nothing that reads only `error` breaks.
//
// Adding one: pick a SCREAMING_SNAKE name describing the *condition* (not the
// wording), add it here with its Norwegian text, and add a matching
// `error.<CODE>` entry to src/lib/i18n/dictionaries/en.js. The nb side and the
// Worker both pick it up automatically; tests/worker-unit.test.mjs and
// src/lib/i18n/dictionaries/dictionaries.test.js fail if the en entry is
// missing. Never renumber or reuse a code — a deployed client may still be
// mapping the old one.
export const ERROR_MESSAGES_NB = {
  // Request shape / generic
  INVALID_REQUEST: "Ugyldig forespørsel",
  NOT_FOUND: "Not found",
  UNAUTHORIZED: "Ikke autorisert",
  DB_ERROR: "DB-feil",

  // Auth + registration
  BAD_CREDENTIALS: "Feil e-post eller passord",
  WRONG_PASSWORD: "Feil passord",
  WRONG_CURRENT_PASSWORD: "Feil nåværende passord",
  GOOGLE_SIGNIN_FAILED: "Google-innlogging feilet",
  TURNSTILE_FAILED: "Bot-verifisering feilet",
  INVALID_EMAIL: "Ugyldig e-post",
  EMAIL_IN_USE: "E-posten er allerede i bruk",
  EMAIL_IN_USE_OTHER_ACCOUNT: "E-posten er allerede i bruk av en annen konto",
  PASSWORD_TOO_SHORT: "Passord må være minst 8 tegn",
  NEW_PASSWORD_TOO_SHORT: "Nytt passord må være minst 8 tegn",
  INVALID_OR_EXPIRED_LINK: "Ugyldig eller utløpt lenke",

  // Rate limiting
  TOO_MANY_LOGIN_ATTEMPTS: "For mange innloggingsforsøk. Prøv igjen senere.",
  TOO_MANY_SIGNUP_ATTEMPTS: "For mange registreringsforsøk. Prøv igjen senere.",
  TOO_MANY_ATTEMPTS: "For mange forsøk. Prøv igjen senere.",
  TOO_MANY_FEEDBACK: "For mange tilbakemeldinger. Prøv igjen senere.",
  PING_COOLDOWN: "Vent litt før du pinger igjen",

  // Permissions
  REQUIRES_ADMIN: "Krever admin",
  REQUIRES_OWNER: "Krever eier",
  REQUIRES_SUPERADMIN: "Kun tilgjengelig for app-eier",
  CANNOT_DELETE_SUPERADMIN: "Kan ikke slette en app-eier-konto",
  CANNOT_RESET_SUPERADMIN: "Kan ikke nullstille passordet til en app-eier-konto",
  CANNOT_CHANGE_SUPERADMIN: "Kan ikke endre tilgangen til en app-eier-konto",

  // List membership
  USER_NOT_FOUND: "Fant ikke bruker",
  USER_NOT_IN_LIST: "Fant ikke bruker på listen",
  LIST_FULL: "Listen er full (maks 10 brukere)",
  LAST_ADMIN_DELETE: "Kan ikke slette siste admin",
  LAST_ADMIN_REMOVE: "Kan ikke fjerne siste admin",
  LAST_OWNER_REMOVE: "Kan ikke fjerne listens eneste eier",
  WOULD_LOSE_ONLY_OWNER: "Listen ville miste sin eneste eier",

  // Shopping list + catalogue
  EMPTY_NAME: "Tomt navn",
  ENTER_NAME: "Skriv inn et navn",
  ITEM_NOT_FOUND: "Fant ikke vare",
  ITEM_NAME_EXISTS: "En vare med dette navnet finnes allerede",

  // Meals
  MEAL_NOT_FOUND: "Fant ikke måltid",
  MEAL_NAME_EXISTS: "Et måltid med dette navnet finnes allerede",
  MISSING_MEAL_OR_RESPONSIBLE: "Mangler måltid eller ansvarlig",
  INVALID_DATE: "Ugyldig dato",
  INVALID_DAY: "Ugyldig dag",

  // Settings
  INVALID_TIME: "Ugyldig tidspunkt",
  INVALID_DAY_COUNT: "Ugyldig antall dager",

  // Push
  INVALID_SUBSCRIPTION: "Ugyldig abonnement",
  NO_ACTIVE_SUBSCRIPTION: "Ingen aktiv varsling på denne enheten",

  // Feedback
  EMPTY_MESSAGE: "Skriv en melding",
  MESSAGE_TOO_LONG: "Meldingen er for lang",
  FEEDBACK_NOT_CONFIGURED: "Tilbakemelding er ikke satt opp ennå",
  FEEDBACK_SEND_FAILED: "Kunne ikke sende tilbakemelding. Prøv igjen senere.",
};

export const ERROR_CODES = Object.keys(ERROR_MESSAGES_NB);
