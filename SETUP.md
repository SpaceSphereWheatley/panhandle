# Panhandle - oppsett (uten Node, kun nettleser)

Delt handleliste + maltidsplanlegger for deg og Saffa, pa **shopping.mohibb.com**.

Alt settes opp via Cloudflare-dashbordet i nettleseren. Du trenger **ikke** installere Node.js eller wrangler.

**Arkitektur:** Cloudflare Pages (frontend) + Cloudflare Worker (API + routing). Begge serveres fra samme domene.

**Filene du laster opp:**
- **Pages:** `public/` folder (index.html, manifest.json, seed.html, begge ikoner)
- **Worker:** `worker/index.js` (limes inn i Worker-editoren)
- **Database:** `migrations/` (SQL du kjorer i D1-konsollen)

---

## Steg 1 - Opprett D1-databasen

1. Logg inn pa dash.cloudflare.com
2. Venstre meny: **Storage & Databases** -> **D1 SQL Database**
3. **Create database**, navn: `panhandle`
4. Apne databasen, ga til fanen **Console**
5. Lim inn innholdet i `migrations/0001_init.sql`, kjor det
6. Lim inn innholdet i `migrations/0002_users.sql`, kjor det

Tabellene er na opprettet. Noter database-ID-en (star under **Settings** i databasen, du trenger den i Steg 3).

## Steg 2 - Opprett Pages-prosjektet (frontend)

1. Venstre meny: **Workers & Pages** -> **Pages**
2. **Create application** -> **Upload assets**
3. Gi det navnet `panhandle`
4. Velg filene fra `public/`-mappen pa din PC (alle 5):
   - `index.html`
   - `seed.html`
   - `manifest.json`
   - `icon-192.png`
   - `icon-512.png`
5. **Deploy**

Du far en URL som `panhandle.pages.dev`. **Noter denne URL-en**, du trenger den i Steg 4.

## Steg 3 - Opprett Worker-et (API)

1. Venstre meny: **Workers & Pages** -> **Workers** -> **Create**
2. Gi det navnet `panhandle`, klikk **Deploy** (default-koden er midlertidig)
3. Klikk **Edit code**
4. Slett all default-kode, lim inn hele `worker/index.js`
5. **Deploy**

## Steg 4 - Oppdater Worker for a peke pa Pages

1. I Worker-editoren, finn linjen (skulle vaere omkring linje 122):
   ```javascript
   pagesUrl.hostname = "panhandle.pages.dev";
   ```
2. Bytt `panhandle.pages.dev` med din Pages-URL fra Steg 2
3. **Deploy**

## Steg 5 - Koble Worker til databasen

1. Worker -> **Settings** -> **Bindings** -> **Add** -> **D1 database**
2. Variable name: `DB` (noyaktig dette)
3. Velg `panhandle`-databasen
4. **Deploy**

## Steg 6 - Sett hemmeligheter

Worker -> **Settings** -> **Variables and Secrets** -> **Add**. Lag to *Secrets* (ikke vanlige variabler):

- `JWT_SECRET` - en lang tilfeldig streng (30+ tegn)
- `SEED_SECRET` - en annen tilfeldig streng, brukes kun en gang

**Deploy** etter at de er lagt til.

## Steg 7 - Sett opp shopping.mohibb.com

1. Worker -> **Settings** -> **Domains & Routes** -> **Add** -> **Custom Domain**
2. Skriv `shopping.mohibb.com`
3. Cloudflare legger til DNS automatisk siden mohibb.com allerede er hos dem

Dette rorer ikke mohibb.com eller den eksisterende Pages-siden din. Det er et eget subdomene som peker pa Worker-et.

## Steg 8 - Opprett kontoene (en gang)

1. Ga til **shopping.mohibb.com/seed.html** i nettleseren
2. Skriv inn `SEED_SECRET` (samme som du satte i Steg 6)
3. Skriv inn brukernavn og passord for deg og Saffa
4. Klikk **Opprett kontoer**

Nar du far bekreftelse: **ga tilbake til Worker -> Settings -> Variables and Secrets og slett `SEED_SECRET`**. Da kan ingen opprette eller overskrive kontoer igjen.

## Steg 9 - Installer som app pa Android

1. Apne **shopping.mohibb.com** i Chrome pa telefonen
2. Logg inn
3. Meny (tre prikker) -> **Legg til pa startskjerm**

Gjor det samme pa Saffas telefon med hennes konto.

---

## Tilpasninger

I `public/index.html`, hvis du vil endre navn:
```js
const PEOPLE = ["Mohibb", "Saffa"];
```

Kategoriene ligger i `worker/index.js` (`CATEGORIES`). Endre hvis du vil andre kategorier. Etter endring: oppdater Worker-en med **Edit code** og **Deploy**.

---

## Hvordan det fungerer

**Handleliste:** Skriv en vare, trykk +. Kjent vare bruker lagret kategori. Ny vare legges i katalogen med "Annet" kategori (autocomplete fra katalogen). Trykk pa kortet for a markere som kjopt. Sopelbotte sletter. "Fjern kjopte varer" rydder.

**Maltider:** 14 dager fremover, ett maltid + en ansvarlig per dag. Maltider lagres og dukker opp som forslag.

**Profil:** Innlogget bruker, antall varer/maltider, bytt passord, logg ut.

---

## Kjente begrensninger

- **Synk er polling.** Endringer dukker opp innen ~7 sekunder.
- **Glidende innlogging.** Token fornyes ved hver forespørsel, sa du blir ikke logget ut pa 90 dager hvis appen brukes jevnlig.
- **Passordbytte logger ut andre enheter.** Din enhet forblir innlogget, Saffas blir logget ut.
- **seed.html ligger apent.** Beskyttet av SEED_SECRET. Fjern SEED_SECRET etter bruk sa endepunktet er dodt.
- **Ingen offline-modus.** Appen krever nett.

---

## Neste steg

1. Legg til varer per maltid
2. Knapp pa maltid: "legg ingredienser til handlelisten"
3. Service worker for offline-bruk
4. Redigerbare kategorier
