// Public OAuth Client ID for "Sign in with Google" (safe to ship in frontend
// JS — Google's ID-token flow never needs a client secret). Must match the
// GOOGLE_CLIENT_ID constant in worker/index.js, which checks incoming tokens'
// `aud` against this same value. Registered to shopping.mohibb.com in Google
// Cloud Console (project panhandle-502411).
export const GOOGLE_CLIENT_ID = "148854883648-86vjm8s2ihc50pjl9sj4t0nj0pe98dh3.apps.googleusercontent.com";
