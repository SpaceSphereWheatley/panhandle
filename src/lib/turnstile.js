// Public site key for Cloudflare Turnstile (safe to ship in frontend JS —
// only the secret key, verified server-side in worker/index.js via
// env.TURNSTILE_SECRET_KEY (a Worker dashboard secret, never committed), is
// sensitive). Still registered to shopping.mohibb.com in the Turnstile
// dashboard — re-registering the domain to shop.panhandle.app (now the
// app's live domain) is a pending manual dashboard step, see
// docs/android-publishing.md step 7.
export const TURNSTILE_SITE_KEY = "0x4AAAAAAD1tKerDjyTsRKHj";
