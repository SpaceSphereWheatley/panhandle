# Android (TWA) wrapper

This is a Trusted Web Activity (TWA) shell — a thin native Android app that
opens the live Panhandle PWA full-screen, with no browser UI. It's how the
web app becomes a Google Play Store listing without a second, separately
maintained app codebase: there's no app logic here, just enough Android
plumbing (`androidbrowserhelper`) to point at the live site and prove
ownership of it via `public/.well-known/assetlinks.json`.

**Domain:** `panhandle.app` — already filled in throughout this directory
(`twa-manifest.json`, `app/src/main/res/values/strings.xml`). It isn't live
yet though: it still needs to be added as a Cloudflare zone and attached as
the Worker's custom domain (see `docs/android-publishing.md`'s cutover
checklist) before any of this actually resolves. The signing key's SHA-256
fingerprint in `public/.well-known/assetlinks.json` is still a placeholder
until a keystore exists.

See `docs/android-publishing.md` for the full walkthrough (domain decision,
keystore generation, building, and the Play Console listing steps).
