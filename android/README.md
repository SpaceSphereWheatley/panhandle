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

**Icons:** `twa-manifest.json`'s `iconUrl`/`maskableIconUrl`/`monochromeIconUrl`
point at hosted PNGs (`public/icon-512.png`, `public/icon-maskable-512.png`,
`public/icon-monochrome-512.png`) that a real `npx @bubblewrap/cli build`
downloads and turns into per-density launcher resources — `monochromeIconUrl`
is what wires up Android 13+'s "themed icon" (Material You) support, where
the OS re-tints the launcher icon with the device's wallpaper-derived
palette. Since no build has actually been run yet, `app/src/main/res/`
carries hand-authored resources that model the same three layers a real
build would produce: `mipmap-anydpi-v26/ic_launcher.xml`/`ic_launcher_round.xml`
declare the adaptive icon (`@color/colorPrimary` background, plus foreground
and monochrome vector drawables — `drawable/ic_launcher_foreground.xml`,
`drawable/ic_launcher_monochrome.xml` — both hand-traced from
`src/design-system/assets/logo/panhandle-icon-monochrome.svg`'s ring+handle
mark, scaled to fit Android's adaptive-icon safe zone); `mipmap-xxxhdpi/ic_launcher.png`/`ic_launcher_round.png`
stay as the flat pre-API-26 fallback. A real `bubblewrap build` regenerating
this directory from `twa-manifest.json` is expected to replace the vector
drawables with its own rasterized per-density PNGs — that's fine, not a
conflict, same as the rest of this hand-authored scaffold.
