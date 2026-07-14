// Public site key for Cloudflare Turnstile (safe to ship in frontend JS —
// only the secret key, verified server-side in worker/index.js, is
// sensitive). Cloudflare's published test key always passes and unblocks
// local/dev work before a real Turnstile widget exists for the production
// hostname (Cloudflare dashboard -> Turnstile).
export const TURNSTILE_SITE_KEY = "1x00000000000000000000AA";
