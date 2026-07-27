# Android (TWA) wrapper

This is a Trusted Web Activity (TWA) shell — a thin native Android app that
opens the live Panhandle PWA full-screen, with no browser UI. It's how the
web app becomes a Google Play Store listing without a second, separately
maintained app codebase: there's no app logic here, just enough Android
plumbing (`androidbrowserhelper`) to point at the live site and prove
ownership of it via `public/.well-known/assetlinks.json`.

**Before building:** every `YOUR_APP_DOMAIN` placeholder in this directory
(`twa-manifest.json`, `app/src/main/res/values/strings.xml`) and in
`public/.well-known/assetlinks.json` needs the real public domain filled in,
and the signing key's SHA-256 fingerprint needs to replace the placeholder in
`assetlinks.json`.

See `docs/android-publishing.md` for the full walkthrough (domain decision,
keystore generation, building, and the Play Console listing steps).
