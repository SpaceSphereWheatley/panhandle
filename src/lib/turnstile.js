// Public site key for Cloudflare Turnstile (safe to ship in frontend JS —
// only the secret key, verified server-side in worker/index.js via
// env.TURNSTILE_SECRET_KEY (a Worker dashboard secret, never committed), is
// sensitive). Registered to shopping.mohibb.com in the Turnstile dashboard.
export const TURNSTILE_SITE_KEY = "0x4AAAAAAD1tKerDjyTsRKHj";
