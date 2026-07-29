# Android (TWA) wrapper

This is a Trusted Web Activity (TWA) shell — a thin native Android app that
opens the live Panhandle PWA full-screen, with no browser UI. It's how the
web app becomes a Google Play Store listing without a second, separately
maintained app codebase: there's no app logic here, just enough Android
plumbing (`androidbrowserhelper`) to point at the live site and prove
ownership of it via `public/.well-known/assetlinks.json`.

**Domain:** `shop.panhandle.app` — already filled in throughout this
directory (`twa-manifest.json`, `app/src/main/res/values/strings.xml`) and
live (the domain cutover checklist in `docs/android-publishing.md` is fully
done and verified). The signing key's SHA-256 fingerprint in
`public/.well-known/assetlinks.json` is still a placeholder until a
keystore exists — that's the one remaining step before a Play Store build
will actually launch full-screen instead of as an ordinary browser tab.

See `docs/android-publishing.md` for the full walkthrough (domain decision,
keystore generation, building, and the Play Console listing steps).
