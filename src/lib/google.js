// Public OAuth Client ID for "Sign in with Google" (safe to ship in frontend
// JS — Google's ID-token flow never needs a client secret). Must match the
// GOOGLE_CLIENT_ID constant in worker/index.js, which checks incoming tokens'
// `aud` against this same value. Placeholder until an OAuth client is created
// in Google Cloud Console for shopping.mohibb.com.
export const GOOGLE_CLIENT_ID = "REPLACE_WITH_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com";
