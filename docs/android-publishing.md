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

## 0. Decide the public domain first

Play Store listings and the TWA itself expose whatever domain the app points
at — that becomes public. The app currently lives at `shopping.mohibb.com`;
this repo is set up to move off that (see `wrangler.toml`'s new `APP_ORIGIN`
var and the comment above `[triggers]`), since the point of publishing this
way is to not carry a personal domain into a public store listing.

**Confirmed via this PR's own Cloudflare deploy-preview comment: the
account's `workers.dev` subdomain is `mohibb91`** (the preview URL was
`https://<branch>-panhandle.mohibb91.workers.dev`) — i.e. `panhandle.
mohibb91.workers.dev` would be exactly as identifying as `shopping.
mohibb.com`. **The Worker's default `workers.dev` route does not satisfy the
"no personal name" goal as-is.** `workers_dev = true` is still set in
`wrangler.toml` (harmless, and useful for testing), but don't treat that
route as the final public URL without first doing one of:

- **Rename the account's `workers.dev` subdomain.** Cloudflare allows
  changing it once, from Account Home → your account → Workers & Pages
  section (wording varies by dashboard version — look for "Change" next to
  the `*.workers.dev` subdomain). Pick something that isn't your name/handle
  (e.g. something derived from the app itself). This is the only path that
  keeps the current single-origin architecture (one domain serving both the
  frontend and `/api/*`, since the Worker already proxies static content to
  the Pages project internally) with zero code changes beyond `APP_ORIGIN`.
- **Buy a small domain just for this.** More polished for a public listing,
  costs money/DNS setup, and re-introduces a domain-ownership record (though
  not necessarily one that identifies you, if registered privately) — your
  call.

Either way, **do not publish anything pointing at a `mohibb91`-derived
domain.**

Once decided, replace `YOUR_APP_DOMAIN` everywhere it appears:

```
grep -rl YOUR_APP_DOMAIN android/ public/.well-known
```

— that's `android/twa-manifest.json`, `android/app/src/main/res/values/strings.xml`,
and `public/.well-known/assetlinks.json`. Also update `wrangler.toml`'s
`APP_ORIGIN` var to match, push, and remove the old custom domain under the
Worker's Settings → Domains & Routes once you've confirmed the new one works.

**Caveat — email sending stays on a real domain for now.** Password-reset
emails go through Resend, which needs a domain with DNS you control for
SPF/DKIM (a `workers.dev`/`pages.dev` subdomain can't be DNS-verified this
way). `wrangler.toml`'s `EMAIL_FROM_ADDRESS` var can stay pointed at
`shopping.mohibb.com` independently of `APP_ORIGIN` — it's only visible in
the "From" header of a password-reset email, not in the app or Play Store
listing. If you want that gone too, it needs its own small DNS-capable
domain (or a Resend-hosted sending option, if they offer one) — a separate
decision from the Android work here.

**You'll also need to re-register, on the new domain, in each dashboard
that currently allow-lists `shopping.mohibb.com`:** Google Cloud Console
("Sign in with Google" OAuth client's authorized origins/redirect URIs —
`src/lib/google.js`) and the Cloudflare Turnstile dashboard (CAPTCHA widget
domain — `src/lib/turnstile.js`). Both are one-time dashboard edits.

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
`https://YOUR_APP_DOMAIN/.well-known/assetlinks.json` before you try to
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
in (once you've replaced `YOUR_APP_DOMAIN`) — Bubblewrap reads it directly:

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
   - **A privacy policy URL.** Required even for a household app that
     collects an email/password. A single static page is enough — host it
     as another static file under `public/` (e.g. `public/privacy.html`) and
     link it here, or anywhere else you control.
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
  `YOUR_APP_DOMAIN`. A rebuild is only needed for things that live in the
  native shell: the app icon/name, theme colors, or `twa-manifest.json`
  itself.
- Losing the keystore means you can never update the Play Store listing
  again under the same app — Google can't reissue it. Keep it backed up.
