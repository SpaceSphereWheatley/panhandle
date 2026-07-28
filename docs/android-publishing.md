# Publishing Panhandle to the Google Play Store

Panhandle is already an installable PWA (works on Android/iOS via "Add to
Home Screen"). Getting it into the Play Store is a separate, additional step
on top of that — it does not replace or change the live web app. The
mechanism is a **Trusted Web Activity (TWA)**: a thin native Android shell
(`android/` in this repo) that opens the live site full-screen with no
browser chrome, verified as belonging to that site via a **Digital Asset
Link** file the site serves.

Nothing here can be finished by Claude alone — a Google Play Console
account, a private signing key, and store-listing content (screenshots, a
privacy policy) all require you personally, in your own browser/accounts.
This doc is the checklist for what's left.

## 0. Domain: panhandle.app — cutover checklist

**Decided.** `panhandle.app` is bought and already filled in throughout
`android/` (`twa-manifest.json`, `strings.xml`) — no more `YOUR_APP_DOMAIN`
placeholders in that directory. It isn't live yet, though: nothing below is
done automatically, and each step is a manual dashboard action (no MCP tool
here can touch Cloudflare zones/DNS, Resend, Google Cloud Console, or
Turnstile). Do these **in order** — later steps depend on earlier ones:

1. ✅ **Add `panhandle.app` to Cloudflare as a zone** — done (bought through
   Cloudflare Registrar, so it was on Cloudflare nameservers from the start).
2. ✅ **Attach it to the Worker as a Custom Domain** — done, alongside the
   existing `shopping.mohibb.com` custom domain, which stays in place for
   now — don't remove it until step 6 confirms the new one fully works.
3. ✅ **Verify it actually serves the app** — confirmed: `panhandle.app/app.html`
   and `/api/version` both work correctly (verified over mobile data; the
   `ERR_CERT_AUTHORITY_INVALID` seen briefly beforehand was local DNS/router
   caching, not a real Cloudflare config problem, and cleared after a DNS
   flush / on a different network).
4. ✅ **Verify `panhandle.app` for email sending in Resend** — done. Since
   Resend's free plan only allows one verified domain, the old
   `mohibb.com` entry was removed from Resend first (Resend-only action —
   doesn't touch the actual `mohibb.com` DNS zone or anything else hosted
   there), then `panhandle.app` was added and verified.
5. ✅ **Flip `wrangler.toml`'s vars and push** — done: both
   `APP_ORIGIN = "https://panhandle.app"` and
   `EMAIL_FROM_ADDRESS = "Panhandle <noreply@panhandle.app>"`.
6. **Remove the old custom domain** (`shopping.mohibb.com`, Worker →
   Settings → Domains & Routes) once `panhandle.app` has been live and
   working for a while — no rush, and easy to leave both attached
   indefinitely if you'd rather.
7. **Re-register on the new domain in each dashboard that currently
   allow-lists `shopping.mohibb.com`:** Google Cloud Console ("Sign in with
   Google" OAuth client's authorized origins/redirect URIs —
   `src/lib/google.js`) and the Cloudflare Turnstile dashboard (CAPTCHA
   widget domain — `src/lib/turnstile.js`). Both are one-time dashboard
   edits; do them before removing the old domain in step 6, so existing
   sessions/logins don't break mid-transition.

## 1. Generate a signing key

This key signs every future update — back it up somewhere durable (a
password manager, not just this container, which is ephemeral). You'll need
a JDK (this repo's dev environment has one via `java -version`; Android
Studio bundles its own too):

```sh
keytool -genkeypair -v -keystore panhandle-release.keystore \
  -alias panhandle -keyalg RSA -keysize 2048 -validity 10000
```

Get its SHA-256 fingerprint:

```sh
keytool -list -v -keystore panhandle-release.keystore -alias panhandle
```

Copy the `SHA256:` value (colons and all, or without — either form works)
into `public/.well-known/assetlinks.json`'s `sha256_cert_fingerprints`,
replacing the placeholder. Push that change so the file is live at
`https://panhandle.app/.well-known/assetlinks.json` before you try to
launch the app — Chrome checks it at launch, and a mismatch means the app
opens as an ordinary browser tab (URL bar visible) instead of full-screen.

Never commit `panhandle-release.keystore` or its passwords. `android/.gitignore`
already excludes `*.keystore`/`*.jks`/`key.properties`.
`android/app/build.gradle` reads signing credentials from a gitignored
`android/key.properties`:

```properties
storeFile=/absolute/path/to/panhandle-release.keystore
storePassword=...
keyAlias=panhandle
keyPassword=...
```

## 2. Build the app

The cleanest path is [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap),
Google's CLI for exactly this. `android/twa-manifest.json` is already filled
in with `panhandle.app` — Bubblewrap reads it directly:

```sh
cd android
npx @bubblewrap/cli build
```

First run prompts to install a JDK/Android SDK if you don't already have
one set up (several hundred MB — expect it to take a few minutes). This
regenerates the Gradle project (icons at every density, the Gradle wrapper,
`AndroidManifest.xml`) from `twa-manifest.json`, so it will refresh the
hand-authored files already in `android/` — that's expected, not a
conflict. Output is `android/app-release-signed.aab` (upload build) and
`android/app-release-signed.apk` (for sideload testing on a device first).

Alternatively, open `android/` directly in Android Studio (Open →
navigate to this folder) — it can build/sign an AAB via Build → Generate
Signed Bundle, using the same `key.properties` file.

**Test before uploading:** install the signed APK on a real Android device
or emulator (`adb install app-release-signed.apk`) and confirm it opens
full-screen with no URL bar — if it shows browser chrome, the asset link
isn't verifying (check the fingerprint and that `assetlinks.json` is live at
the right domain).

## 3. Google Play Console

1. Create an account at [play.google.com/console](https://play.google.com/console)
   (one-time $25 registration fee) — this is entirely a browser/account step,
   nothing here does it for you.
2. Create a new app. You'll need, before it can go to review:
   - ✅ **A privacy policy URL** — done: `https://panhandle.app/privacy.html`
     (also linked from the marketing page and changelog page's footers).
     Enter that URL in the Play Console listing's Privacy Policy field and
     the Data Safety section.
   - **Store listing assets**: short/full description, at least 2
     screenshots (phone size), a 512×512 app icon (already have one:
     `public/icon-512.png`), and a 1024×500 feature graphic (doesn't exist
     yet — needs designing).
   - **Content rating questionnaire** (Play Console walks you through it —
     a shopping list/meal planner should rate very low).
   - **Data safety section** — declare what the app collects (email,
     password — hashed, never sent to Play — name; see `CLAUDE.md`'s Auth
     model for exactly what's stored).
3. Upload the `.aab` from step 2 to a testing track first (Internal testing
   is fastest to set up and doesn't require review) — install it via the
   testing link on a real device before promoting to Production.
4. Promote to Production when ready. Play Store review typically takes a
   few hours to a few days for a first submission.

## 4. After publishing

- **Every future update**: bump `android/twa-manifest.json`'s
  `appVersionCode` (must strictly increase) and `appVersionName`, rebuild
  with the *same* keystore, and upload the new `.aab` to Play Console. The
  web app itself keeps deploying independently on every push to `main`
  (see `CLAUDE.md`'s Deployment section) — most day-to-day changes need no
  Android rebuild at all, since the TWA just displays whatever's live at
  `panhandle.app`. A rebuild is only needed for things that live in the
  native shell: the app icon/name, theme colors, or `twa-manifest.json`
  itself.
- Losing the keystore means you can never update the Play Store listing
  again under the same app — Google can't reissue it. Keep it backed up.
