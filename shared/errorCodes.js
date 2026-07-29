// Stable machine-readable codes for every error the Worker returns, plus the
// canonical English message for each. Imported by worker/index.js (which
// answers with `{ error, code }` — see `err()` there) and by the frontend's
// en dictionary, which derives its `error.*` entries straight from this map
// rather than restating the same 50 strings (src/lib/i18n/dictionaries/en.js).
// Same single-source pattern as CATEGORIES and VERSION.
//
// Why codes at all: the `error` string is a single fixed language and was
// shown to the user verbatim, so the UI leaked that language on every failed
// request. The code is what the client translates; `error` is still sent
// alongside it and still correct, so nothing that reads only `error` breaks.
//
// English is the canonical side (see CLAUDE.md's Language support section):
// these strings are the source text, and src/lib/i18n/dictionaries/nb.js holds
// the hand-written Norwegian translations of them.
//
// Adding one: pick a SCREAMING_SNAKE name describing the *condition* (not the
// wording), add it here with its English text, and add a matching
// `error.<CODE>` entry to src/lib/i18n/dictionaries/nb.js. The en side and the
// Worker both pick it up automatically; tests/worker-unit.test.mjs and
// src/lib/i18n/dictionaries/dictionaries.test.js fail if the nb entry is
// missing. Never renumber or reuse a code — a deployed client may still be
// mapping the old one.
export const ERROR_MESSAGES_EN = {
  // Request shape / generic
  INVALID_REQUEST: "Invalid request",
  NOT_FOUND: "Not found",
  UNAUTHORIZED: "Not authorised",
  DB_ERROR: "Database error",

  // Auth + registration
  BAD_CREDENTIALS: "Wrong email or password",
  WRONG_PASSWORD: "Wrong password",
  WRONG_CURRENT_PASSWORD: "Wrong current password",
  GOOGLE_SIGNIN_FAILED: "Google sign-in failed",
  TURNSTILE_FAILED: "Bot check failed",
  INVALID_EMAIL: "Invalid email",
  EMAIL_IN_USE: "That email is already in use",
  EMAIL_IN_USE_OTHER_ACCOUNT: "That email is already in use by another account",
  PASSWORD_TOO_SHORT: "The password must be at least 8 characters",
  NEW_PASSWORD_TOO_SHORT: "The new password must be at least 8 characters",
  INVALID_OR_EXPIRED_LINK: "Invalid or expired link",

  // Rate limiting
  TOO_MANY_LOGIN_ATTEMPTS: "Too many sign-in attempts. Try again later.",
  TOO_MANY_SIGNUP_ATTEMPTS: "Too many sign-up attempts. Try again later.",
  TOO_MANY_ATTEMPTS: "Too many attempts. Try again later.",
  TOO_MANY_FEEDBACK: "Too much feedback sent. Try again later.",
  PING_COOLDOWN: "Wait a moment before pinging again",

  // Permissions
  REQUIRES_ADMIN: "Requires admin",
  REQUIRES_OWNER: "Requires owner",
  REQUIRES_SUPERADMIN: "Only available to the app owner",
  CANNOT_DELETE_SUPERADMIN: "An app-owner account can't be deleted",
  CANNOT_RESET_SUPERADMIN: "An app-owner account's password can't be reset",
  CANNOT_CHANGE_SUPERADMIN: "An app-owner account's access can't be changed",

  // List membership
  USER_NOT_FOUND: "User not found",
  USER_NOT_IN_LIST: "That user isn't on the list",
  LIST_FULL: "The list is full (max 10 users)",
  LAST_ADMIN_DELETE: "The last admin can't be deleted",
  LAST_ADMIN_REMOVE: "The last admin can't be removed",
  LAST_OWNER_REMOVE: "The list's only owner can't be removed",
  WOULD_LOSE_ONLY_OWNER: "The list would lose its only owner",

  // Invites
  INVALID_OR_EXPIRED_INVITE: "This invite link is invalid or has expired",

  // Calendar feed
  CALENDAR_TOKEN_NOT_FOUND: "Calendar feed not found",

  // Shopping list + catalogue
  EMPTY_NAME: "Empty name",
  ENTER_NAME: "Enter a name",
  ITEM_NOT_FOUND: "Item not found",
  ITEM_NAME_EXISTS: "An item with that name already exists",

  // Meals
  MEAL_NOT_FOUND: "Meal not found",
  MEAL_NAME_EXISTS: "A meal with that name already exists",
  MISSING_MEAL_OR_RESPONSIBLE: "Missing a meal or someone responsible",
  INVALID_DATE: "Invalid date",
  INVALID_DAY: "Invalid day",

  // Settings
  INVALID_TIME: "Invalid time",
  INVALID_DAY_COUNT: "Invalid number of days",

  // Push
  INVALID_SUBSCRIPTION: "Invalid subscription",
  NO_ACTIVE_SUBSCRIPTION: "No active notifications on this device",

  // Feedback
  EMPTY_MESSAGE: "Write a message",
  MESSAGE_TOO_LONG: "The message is too long",
  FEEDBACK_NOT_CONFIGURED: "Feedback isn't set up yet",
  FEEDBACK_SEND_FAILED: "Couldn't send the feedback. Try again later.",
};

export const ERROR_CODES = Object.keys(ERROR_MESSAGES_EN);
