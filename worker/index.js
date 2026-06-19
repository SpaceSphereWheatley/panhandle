// Laget av Mohibb Malik, 2026
// Worker API for shared shopping list + meal planner
// Served at shopping.mohibb.com. Frontend on Cloudflare Pages,
// API = this Worker under /api/* and /seed. Proxies other paths to Pages.
// Auth: users in D1 with PBKDF2 password hashes, JWT with token versioning,
//       sliding expiry, in-app password change that logs out other devices.
// Multi-tenant: every user belongs to exactly one list (users.list_id); all
//       shopping/meal data is scoped by list_id. is_admin/is_owner are
//       independent flags (a user can be both). Admins create owner accounts
//       (each gets its own list); owners add members to their own list.

// Deployed Worker (API) version. The Worker and the Pages frontend deploy
// independently via Cloudflare's Git integration, so this is bumped together
// with public/index.html's APP_VERSION on each release (see CHANGELOG.md) and
// surfaced at GET /api/version — the Profile page shows both so a half-finished
// deploy (one side stale) is visible at a glance. Keep in sync with APP_VERSION.
const VERSION = "1.0.19";

// Login rate-limiting (TODO #14): max failed attempts per source IP within
// the sliding window below, backed by the login_attempts table (see
// migrations/0001_init.sql, the login_attempts table). Keyed by IP rather than username so a
// flood of failed attempts against one account can't be used to lock out its
// real owner.
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

const CATEGORIES = [
  "Frukt og grønt", "Brød og bakevarer", "Meieriprodukter", "Kjøtt og fisk",
  "Ingredienser og krydder", "Frysevarer og ferdigmåltid", "Kornprodukter",
  "Snacks og godteri", "Drikkevarer", "Husholdning", "Omsorg og helse",
  "Dyreprodukter", "Annet"
];

// Common Norwegian groceries seeded into a new list's catalogue at creation,
// so a fresh household gets autocomplete/category-matching for everyday items
// instead of a blank catalogue. One-time copy per list — editing this array
// only affects lists created afterwards. Categories must be in CATEGORIES.
const COMMON_ITEMS = [
  { name: "Frukt", category: "Frukt og grønt" },
  { name: "Grønnsaker", category: "Frukt og grønt" },
  { name: "Banan", category: "Frukt og grønt" },
  { name: "Eple", category: "Frukt og grønt" },
  { name: "Appelsin", category: "Frukt og grønt" },
  { name: "Sitron", category: "Frukt og grønt" },
  { name: "Druer", category: "Frukt og grønt" },
  { name: "Jordbær", category: "Frukt og grønt" },
  { name: "Blåbær", category: "Frukt og grønt" },
  { name: "Avokado", category: "Frukt og grønt" },
  { name: "Tomat", category: "Frukt og grønt" },
  { name: "Agurk", category: "Frukt og grønt" },
  { name: "Salat", category: "Frukt og grønt" },
  { name: "Brokkoli", category: "Frukt og grønt" },
  { name: "Gulrot", category: "Frukt og grønt" },
  { name: "Potet", category: "Frukt og grønt" },
  { name: "Løk", category: "Frukt og grønt" },
  { name: "Hvitløk", category: "Frukt og grønt" },
  { name: "Paprika", category: "Frukt og grønt" },
  { name: "Sopp", category: "Frukt og grønt" },
  { name: "Spinat", category: "Frukt og grønt" },
  { name: "Ingefær", category: "Frukt og grønt" },
  { name: "Brød", category: "Brød og bakevarer" },
  { name: "Grovbrød", category: "Brød og bakevarer" },
  { name: "Loff", category: "Brød og bakevarer" },
  { name: "Rundstykker", category: "Brød og bakevarer" },
  { name: "Knekkebrød", category: "Brød og bakevarer" },
  { name: "Tortilla", category: "Brød og bakevarer" },
  { name: "Boller", category: "Brød og bakevarer" },
  { name: "Melk", category: "Meieriprodukter" },
  { name: "Lettmelk", category: "Meieriprodukter" },
  { name: "Fløte", category: "Meieriprodukter" },
  { name: "Rømme", category: "Meieriprodukter" },
  { name: "Smør", category: "Meieriprodukter" },
  { name: "Ost", category: "Meieriprodukter" },
  { name: "Brunost", category: "Meieriprodukter" },
  { name: "Hvitost", category: "Meieriprodukter" },
  { name: "Norvegia", category: "Meieriprodukter" },
  { name: "Mozzarella", category: "Meieriprodukter" },
  { name: "Parmesan", category: "Meieriprodukter" },
  { name: "Yoghurt", category: "Meieriprodukter" },
  { name: "Gresk yoghurt", category: "Meieriprodukter" },
  { name: "Skyr", category: "Meieriprodukter" },
  { name: "Egg", category: "Meieriprodukter" },
  { name: "Kjøtt", category: "Kjøtt og fisk" },
  { name: "Fisk", category: "Kjøtt og fisk" },
  { name: "Pålegg", category: "Kjøtt og fisk" },
  { name: "Kjøttdeig", category: "Kjøtt og fisk" },
  { name: "Kylling", category: "Kjøtt og fisk" },
  { name: "Kyllingfilet", category: "Kjøtt og fisk" },
  { name: "Bacon", category: "Kjøtt og fisk" },
  { name: "Pølser", category: "Kjøtt og fisk" },
  { name: "Kjøttboller", category: "Kjøtt og fisk" },
  { name: "Laks", category: "Kjøtt og fisk" },
  { name: "Torsk", category: "Kjøtt og fisk" },
  { name: "Tunfisk", category: "Kjøtt og fisk" },
  { name: "Reker", category: "Kjøtt og fisk" },
  { name: "Fiskekaker", category: "Kjøtt og fisk" },
  { name: "Kokt skinke", category: "Kjøtt og fisk" },
  { name: "Mel", category: "Ingredienser og krydder" },
  { name: "Olje", category: "Ingredienser og krydder" },
  { name: "Salt", category: "Ingredienser og krydder" },
  { name: "Pepper", category: "Ingredienser og krydder" },
  { name: "Sukker", category: "Ingredienser og krydder" },
  { name: "Hvetemel", category: "Ingredienser og krydder" },
  { name: "Olivenolje", category: "Ingredienser og krydder" },
  { name: "Soyasaus", category: "Ingredienser og krydder" },
  { name: "Ketchup", category: "Ingredienser og krydder" },
  { name: "Sennep", category: "Ingredienser og krydder" },
  { name: "Majones", category: "Ingredienser og krydder" },
  { name: "Tomatpuré", category: "Ingredienser og krydder" },
  { name: "Hermetiske tomater", category: "Ingredienser og krydder" },
  { name: "Honning", category: "Ingredienser og krydder" },
  { name: "Grandiosa", category: "Frysevarer og ferdigmåltid" },
  { name: "Frosne grønnsaker", category: "Frysevarer og ferdigmåltid" },
  { name: "Frosne bær", category: "Frysevarer og ferdigmåltid" },
  { name: "Pommes frites", category: "Frysevarer og ferdigmåltid" },
  { name: "Iskrem boks", category: "Frysevarer og ferdigmåltid" },
  { name: "Frokostblanding", category: "Kornprodukter" },
  { name: "Havregryn", category: "Kornprodukter" },
  { name: "Müsli", category: "Kornprodukter" },
  { name: "Cornflakes", category: "Kornprodukter" },
  { name: "Ris", category: "Kornprodukter" },
  { name: "Pasta", category: "Kornprodukter" },
  { name: "Spaghetti", category: "Kornprodukter" },
  { name: "Makaroni", category: "Kornprodukter" },
  { name: "Couscous", category: "Kornprodukter" },
  { name: "Kikerter", category: "Kornprodukter" },
  { name: "Potetgull", category: "Snacks og godteri" },
  { name: "Melkesjokolade", category: "Snacks og godteri" },
  { name: "Kjeks", category: "Snacks og godteri" },
  { name: "Popcorn", category: "Snacks og godteri" },
  { name: "Sjokolade", category: "Snacks og godteri" },
  { name: "Vann", category: "Drikkevarer" },
  { name: "Kullsyret vann", category: "Drikkevarer" },
  { name: "Cola", category: "Drikkevarer" },
  { name: "Juice", category: "Drikkevarer" },
  { name: "Saft", category: "Drikkevarer" },
  { name: "Kaffe", category: "Drikkevarer" },
  { name: "Te", category: "Drikkevarer" },
  { name: "Brus", category: "Drikkevarer" },
  { name: "Eplejuice", category: "Drikkevarer" },
  { name: "Toalettpapir", category: "Husholdning" },
  { name: "Tørkepapir", category: "Husholdning" },
  { name: "Kjøkkenrull", category: "Husholdning" },
  { name: "Oppvasksåpe", category: "Husholdning" },
  { name: "Oppvaskmaskin tabletter", category: "Husholdning" },
  { name: "Vaskemiddel", category: "Husholdning" },
  { name: "Allrengjøring", category: "Husholdning" },
  { name: "Søppelsekker", category: "Husholdning" },
  { name: "Aluminiumsfolie", category: "Husholdning" },
  { name: "Bakepapir", category: "Husholdning" },
  { name: "Tannkrem", category: "Omsorg og helse" },
  { name: "Tannbørste", category: "Omsorg og helse" },
  { name: "Sjampo", category: "Omsorg og helse" },
  { name: "Dusjsåpe", category: "Omsorg og helse" },
  { name: "Håndsåpe", category: "Omsorg og helse" },
  { name: "Plaster", category: "Omsorg og helse" },
  { name: "Kattemat", category: "Dyreprodukter" },
  { name: "Hundemat", category: "Dyreprodukter" },
  { name: "Blomster", category: "Annet" }
];

// ---------- JWT helpers (HS256, no external deps) ----------
function b64url(input) {
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
// Encode via UTF-8 bytes so payloads with non-ASCII characters (e.g. a
// username with æ/ø/å) don't make btoa throw.
function b64urlStr(str) {
  return b64url(new TextEncoder().encode(str));
}
function b64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const bin = atob(str);
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
// Constant-time string comparison so a JWT signature check can't be probed
// byte-by-byte via response timing.
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}
async function hmac(secret, data) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return b64url(sig);
}
async function signJwt(payload, secret) {
  const header = b64urlStr(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64urlStr(JSON.stringify(payload));
  const sig = await hmac(secret, `${header}.${body}`);
  return `${header}.${body}.${sig}`;
}
async function verifyJwt(token, secret) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = await hmac(secret, `${header}.${body}`);
  if (!timingSafeEqual(expected, sig)) return null;
  try {
    const payload = JSON.parse(b64urlDecode(body));
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch { return null; }
}

// ---------- password hashing (PBKDF2 via Web Crypto) ----------
const PBKDF2_ITER = 100000;
// A well-formed but unmatchable hash. Verified against this when the supplied
// username doesn't exist, so login spends the same PBKDF2 time either way and
// can't be used to enumerate valid usernames by response latency.
const DUMMY_PASS_HASH =
  "100000:AAAAAAAAAAAAAAAAAAAAAA:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
async function hashPassword(password, saltBytes) {
  const salt = saltBytes || crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITER, hash: "SHA-256" },
    keyMaterial, 256
  );
  const hashB64 = b64url(bits);
  const saltB64 = b64url(salt.buffer);
  return `${PBKDF2_ITER}:${saltB64}:${hashB64}`;
}
async function verifyPassword(password, stored) {
  try {
    const [iterStr, saltB64, hashB64] = stored.split(":");
    const iterations = parseInt(iterStr, 10);
    const salt = Uint8Array.from(atob(saltB64.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
    const keyMaterial = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]
    );
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
      keyMaterial, 256
    );
    return b64url(bits) === hashB64;
  } catch { return false; }
}

// Generates a short, human-readable random password for admin/owner-created
// accounts. Charset omits visually ambiguous characters (0/O, 1/l/I) since
// these are read off a screen and retyped by hand. ~12 chars, grouped
// xxxx-xxxx-xxxx. Rejection sampling avoids modulo bias. No external deps.
function genPassword() {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const len = 12;
  const max = Math.floor(256 / charset.length) * charset.length;
  const out = [];
  while (out.length < len) {
    const buf = crypto.getRandomValues(new Uint8Array(len));
    for (const b of buf) {
      if (b < max) out.push(charset[b % charset.length]);
      if (out.length === len) break;
    }
  }
  return out.join("").replace(/(.{4})(.{4})(.{4})/, "$1-$2-$3");
}

// Normalizes/validates a username from request input. Letters (incl. æøå),
// digits, and . _ - only; 1-32 chars. Returns null if invalid.
function cleanUsername(u) {
  const s = (u || "").trim();
  if (!s || s.length > 32) return null;
  if (!/^[\p{L}\p{N}._-]+$/u.test(s)) return null;
  return s;
}

// Recognises a gluten-free marker (GF / gf / glutenfri / glutenfritt) typed as
// part of an item name and reports it so the caller can lift it into the notes:
// "Pasta GF" becomes name "Pasta" + note "GF". The cleaned name still resolves
// to the normal catalogue entry, so a plain "Pasta" and a "Pasta" + "GF" note
// share the same catalogue row but stay distinct list lines (the add path's
// merge check is notes-aware). If the marker is the entire input (e.g. just
// "GF"), it's left untouched — there's no item name to attach it to.
function extractGlutenFree(name) {
  let gf = false;
  const cleaned = (name || "")
    .replace(/\b(gf|glutenfri|glutenfritt)\b/gi, () => { gf = true; return " "; })
    .replace(/\s+/g, " ")
    .trim();
  if (!gf || !cleaned) return { name: (name || "").trim(), gf: false };
  return { name: cleaned, gf: true };
}

// Upper-cases the first character of an item/catalogue name so stored names are
// always capitalised ("brød" -> "Brød"), leaving the rest as typed (proper
// nouns, acronyms and casing like "7 Up" survive). Applied wherever a catalogue
// name is created or renamed; the frontend mirrors it at display time.
function capitalizeName(name) {
  const s = (name || "").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// ---------- response helpers ----------
const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status, headers: { "Content-Type": "application/json", ...extra }
  });

// Parses a JSON request body, returning null on empty/malformed input so
// callers can answer 400 instead of throwing an opaque 500.
async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// Verifies JWT signature/expiry AND that token_version matches the DB. Returns
// the live user row (flags + list_id) — the DB is the source of truth on every
// request, so any change to a user's flags/list_id/token_version takes effect
// on their next call (the JWT's copies are only client-display hints).
async function requireAuth(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const payload = await verifyJwt(token, env.JWT_SECRET);
  if (!payload || !payload.sub) return null;
  const row = await env.DB.prepare(
    "SELECT username, token_version, is_admin, is_owner, list_id FROM users WHERE username = ?1 COLLATE NOCASE"
  ).bind(payload.sub).first();
  if (!row) return null;
  if (payload.tv !== row.token_version) return null;
  return row;
}

// Mints a 90-day token from a user row. list_id/is_admin/is_owner are carried
// for the client's convenience; the server always re-reads them from the DB.
async function mintToken(u, env) {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 90;
  return await signJwt({
    sub: u.username, tv: u.token_version,
    list_id: u.list_id, is_admin: u.is_admin, is_owner: u.is_owner, exp
  }, env.JWT_SECRET);
}

// ---------- main ----------
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;

    // ===== ROUTING =====
    // /seed.html itself is a static asset (public/seed.html) and falls
    // through to the Pages proxy below like any other non-API path — no
    // need for a second copy here (TODO #24: this used to inline a stale
    // duplicate that had drifted from public/seed.html).
    const isApi = url.pathname === "/seed" || url.pathname.startsWith("/api");
    if (!isApi) {
      const pagesUrl = new URL(request.url);
      pagesUrl.hostname = "panhandle-ecj.pages.dev";
      return fetch(new Request(pagesUrl.toString(), request));
    }

    const path = url.pathname.replace(/^\/api/, "");

    // ===== SEED ENDPOINT (POST) =====
    // Bootstraps the very first account(s) of a fresh deployment. The first
    // NEW account becomes admin + owner of a freshly-created (COMMON_ITEMS-
    // seeded) list; any further new accounts in the same call join that list
    // as plain members. Existing users only get their password reset (flags/
    // list_id are preserved), so re-running seed never clobbers a live setup.
    if (path === "/seed" && method === "POST") {
      const body = await readJson(request);
      if (!body) return json({ error: "Ugyldig forespørsel" }, 400);
      const { secret, accounts } = body;
      if (!env.SEED_SECRET || secret !== env.SEED_SECRET) {
        return json({ error: "Feil seed-hemmelighet" }, 403);
      }
      if (!Array.isArray(accounts) || !accounts.length) {
        return json({ error: "Mangler kontoer" }, 400);
      }
      let created = 0;
      let bootstrapListId = null;
      let ownerMade = false;
      const ensureList = async () => {
        if (bootstrapListId) return bootstrapListId;
        const l = await env.DB.prepare("INSERT INTO lists DEFAULT VALUES RETURNING id").first();
        bootstrapListId = l.id;
        await env.DB.batch(COMMON_ITEMS.map(it =>
          env.DB.prepare("INSERT INTO item_catalogue (name, category, list_id) VALUES (?1, ?2, ?3)")
            .bind(it.name, it.category, bootstrapListId)
        ));
        return bootstrapListId;
      };
      for (const a of accounts) {
        const uname = cleanUsername(a.username);
        if (!uname || !a.password) continue;
        const hash = await hashPassword(a.password);
        const existing = await env.DB.prepare(
          "SELECT username FROM users WHERE username = ?1 COLLATE NOCASE"
        ).bind(uname).first();
        if (existing) {
          await env.DB.prepare(
            "UPDATE users SET pass_hash = ?1, token_version = token_version + 1 WHERE username = ?2 COLLATE NOCASE"
          ).bind(hash, uname).run();
        } else {
          const lid = await ensureList();
          const isOwner = ownerMade ? 0 : 1;
          await env.DB.prepare(
            "INSERT INTO users (username, pass_hash, token_version, is_admin, is_owner, list_id, created_by) VALUES (?1, ?2, 1, ?3, ?4, ?5, 'seed')"
          ).bind(uname, hash, isOwner, isOwner, lid).run();
          ownerMade = true;
        }
        created++;
      }
      return json({ ok: true, created });
    }

    // ===== VERSION (public, unauthenticated) =====
    // Cheap deploy-confirmation probe: lets the frontend (and a curl) read the
    // live Worker version without a token.
    if (path === "/version" && method === "GET") {
      return json({ version: VERSION });
    }

    // ===== LOGIN =====
    if (path === "/login" && method === "POST") {
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      const windowStart = Date.now() - LOGIN_WINDOW_MS;
      // Opportunistic cleanup, same pattern as /plan's meal_plan pruning:
      // drop attempts outside the window on every login, no cron needed.
      await env.DB.prepare("DELETE FROM login_attempts WHERE created_at < ?1").bind(windowStart).run();
      const { attempts } = await env.DB.prepare(
        "SELECT COUNT(*) AS attempts FROM login_attempts WHERE ip = ?1 AND created_at >= ?2"
      ).bind(ip, windowStart).first();
      if (attempts >= LOGIN_MAX_ATTEMPTS) {
        return json({ error: "For mange innloggingsforsøk. Prøv igjen senere." }, 429);
      }
      const body = await readJson(request);
      if (!body) return json({ error: "Ugyldig forespørsel" }, 400);
      const { username, password } = body;
      const row = await env.DB.prepare(
        "SELECT username, pass_hash, token_version, is_admin, is_owner, list_id FROM users WHERE username = ?1 COLLATE NOCASE"
      ).bind((username || "").trim()).first();
      // Always run the PBKDF2 check (against a dummy hash for unknown users) so
      // login latency doesn't reveal whether a username exists.
      const ok = await verifyPassword(password || "", row ? row.pass_hash : DUMMY_PASS_HASH);
      if (!row || !ok) {
        await env.DB.prepare("INSERT INTO login_attempts (ip, created_at) VALUES (?1, ?2)")
          .bind(ip, Date.now()).run();
        return json({ error: "Feil brukernavn eller passord" }, 401);
      }
      const token = await mintToken(row, env);
      return json({
        token, user: row.username,
        is_admin: row.is_admin, is_owner: row.is_owner, list_id: row.list_id
      });
    }

    // ===== AUTH REQUIRED BELOW =====
    const user = await requireAuth(request, env);
    if (!user) return json({ error: "Ikke autorisert" }, 401);
    const freshToken = await mintToken(user, env);
    // Sliding expiry: every authenticated response carries a freshly-minted
    // token so the session is extended no matter which endpoint is used (not
    // just /list). /change-password is the exception — it returns the
    // authoritative new-version token in its body, and the frontend ignores
    // this header on that path.
    const authedJson = (data, status = 200, extra = {}) =>
      json(data, status, { "X-Refresh-Token": freshToken, ...extra });

    // ===== CHANGE PASSWORD =====
    if (path === "/change-password" && method === "POST") {
      const body = await readJson(request);
      if (!body) return json({ error: "Ugyldig forespørsel" }, 400);
      const { current_password, new_password } = body;
      if (!new_password || new_password.length < 6) {
        return json({ error: "Nytt passord må være minst 6 tegn" }, 400);
      }
      const row = await env.DB.prepare(
        "SELECT pass_hash, token_version FROM users WHERE username = ?1 COLLATE NOCASE"
      ).bind(user.username).first();
      if (!(await verifyPassword(current_password || "", row.pass_hash))) {
        return json({ error: "Feil nåværende passord" }, 401);
      }
      const newHash = await hashPassword(new_password);
      const newVersion = row.token_version + 1;
      await env.DB.prepare(
        "UPDATE users SET pass_hash = ?1, token_version = ?2 WHERE username = ?3 COLLATE NOCASE"
      ).bind(newHash, newVersion, user.username).run();
      const tokenAfter = await mintToken({ ...user, token_version: newVersion }, env);
      return json({ ok: true, token: tokenAfter });
    }

    // ===== ADMIN ENDPOINTS (require is_admin) =====
    // Create a new owner + their own list, seeded with COMMON_ITEMS.
    if (path === "/admin/owners" && method === "POST") {
      if (!user.is_admin) return authedJson({ error: "Krever admin" }, 403);
      const body = await readJson(request);
      if (!body) return authedJson({ error: "Ugyldig forespørsel" }, 400);
      const uname = cleanUsername(body.username);
      if (!uname) return authedJson({ error: "Ugyldig brukernavn" }, 400);
      const exists = await env.DB.prepare(
        "SELECT 1 FROM users WHERE username = ?1 COLLATE NOCASE"
      ).bind(uname).first();
      if (exists) return authedJson({ error: "Brukernavnet er opptatt" }, 409);
      const password = genPassword();
      const hash = await hashPassword(password);
      const list = await env.DB.prepare("INSERT INTO lists DEFAULT VALUES RETURNING id").first();
      const listId = list.id;
      const stmts = COMMON_ITEMS.map(it =>
        env.DB.prepare("INSERT INTO item_catalogue (name, category, list_id) VALUES (?1, ?2, ?3)")
          .bind(it.name, it.category, listId)
      );
      stmts.push(env.DB.prepare(
        "INSERT INTO users (username, pass_hash, token_version, is_admin, is_owner, list_id, created_by) VALUES (?1, ?2, 1, 0, 1, ?3, ?4)"
      ).bind(uname, hash, listId, user.username));
      await env.DB.batch(stmts);
      return authedJson({ username: uname, password });
    }

    // Every user in the system (across all lists) with their flags.
    if (path === "/admin/users" && method === "GET") {
      if (!user.is_admin) return authedJson({ error: "Krever admin" }, 403);
      const { results } = await env.DB.prepare(
        "SELECT username, is_admin, is_owner, list_id, created_by FROM users ORDER BY list_id, username"
      ).all();
      return authedJson(results);
    }

    // Reset any user's password (recovery path). Bumps token_version.
    const rpMatch = path.match(/^\/admin\/users\/([^/]+)\/reset-password$/);
    if (rpMatch && method === "POST") {
      if (!user.is_admin) return authedJson({ error: "Krever admin" }, 403);
      const target = decodeURIComponent(rpMatch[1]);
      const row = await env.DB.prepare(
        "SELECT username FROM users WHERE username = ?1 COLLATE NOCASE"
      ).bind(target).first();
      if (!row) return authedJson({ error: "Fant ikke bruker" }, 404);
      const password = genPassword();
      const hash = await hashPassword(password);
      await env.DB.prepare(
        "UPDATE users SET pass_hash = ?1, token_version = token_version + 1 WHERE username = ?2 COLLATE NOCASE"
      ).bind(hash, row.username).run();
      return authedJson({ username: row.username, password });
    }

    // Set is_admin / is_owner flags independently. Bumps token_version.
    const flagMatch = path.match(/^\/admin\/users\/([^/]+)\/flags$/);
    if (flagMatch && method === "PATCH") {
      if (!user.is_admin) return authedJson({ error: "Krever admin" }, 403);
      const target = decodeURIComponent(flagMatch[1]);
      const body = await readJson(request);
      if (!body) return authedJson({ error: "Ugyldig forespørsel" }, 400);
      const row = await env.DB.prepare(
        "SELECT username, is_admin, is_owner, list_id FROM users WHERE username = ?1 COLLATE NOCASE"
      ).bind(target).first();
      if (!row) return authedJson({ error: "Fant ikke bruker" }, 404);
      let newAdmin = row.is_admin, newOwner = row.is_owner;
      if (body.is_admin !== undefined) newAdmin = body.is_admin ? 1 : 0;
      if (body.is_owner !== undefined) newOwner = body.is_owner ? 1 : 0;
      // Never let the last admin be demoted.
      if (row.is_admin === 1 && newAdmin === 0) {
        const c = await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE is_admin = 1").first();
        if (c.n <= 1) return authedJson({ error: "Kan ikke fjerne siste admin" }, 400);
      }
      // Never let a list lose its only owner.
      if (row.is_owner === 1 && newOwner === 0) {
        const c = await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM users WHERE is_owner = 1 AND list_id = ?1"
        ).bind(row.list_id).first();
        if (c.n <= 1) return authedJson({ error: "Listen ville miste sin eneste eier" }, 400);
      }
      await env.DB.prepare(
        "UPDATE users SET is_admin = ?1, is_owner = ?2, token_version = token_version + 1 WHERE username = ?3 COLLATE NOCASE"
      ).bind(newAdmin, newOwner, row.username).run();
      return authedJson({ ok: true, username: row.username, is_admin: newAdmin, is_owner: newOwner });
    }

    // ===== LIST-USER ENDPOINTS =====
    // Members of the caller's own list. Readable by any authed user on the
    // list (used to populate the meal-responsible dropdown).
    if (path === "/list-users" && method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT username, is_admin, is_owner FROM users WHERE list_id = ?1 ORDER BY username"
      ).bind(user.list_id).all();
      return authedJson(results);
    }

    // Add a plain member to the caller's list (owner only). Capped at 10.
    if (path === "/list-users" && method === "POST") {
      if (!user.is_owner) return authedJson({ error: "Krever eier" }, 403);
      const body = await readJson(request);
      if (!body) return authedJson({ error: "Ugyldig forespørsel" }, 400);
      const uname = cleanUsername(body.username);
      if (!uname) return authedJson({ error: "Ugyldig brukernavn" }, 400);
      const c = await env.DB.prepare(
        "SELECT COUNT(*) AS n FROM users WHERE list_id = ?1"
      ).bind(user.list_id).first();
      if (c.n >= 10) return authedJson({ error: "Listen er full (maks 10 brukere)" }, 400);
      const exists = await env.DB.prepare(
        "SELECT 1 FROM users WHERE username = ?1 COLLATE NOCASE"
      ).bind(uname).first();
      if (exists) return authedJson({ error: "Brukernavnet er opptatt" }, 409);
      const password = genPassword();
      const hash = await hashPassword(password);
      // is_admin/is_owner are hardcoded 0 — never taken from the request body,
      // so an owner can't self-escalate a member into an admin/owner.
      await env.DB.prepare(
        "INSERT INTO users (username, pass_hash, token_version, is_admin, is_owner, list_id, created_by) VALUES (?1, ?2, 1, 0, 0, ?3, ?4)"
      ).bind(uname, hash, user.list_id, user.username).run();
      return authedJson({ username: uname, password });
    }

    // Remove a member from the caller's list (owner only).
    const luDelMatch = path.match(/^\/list-users\/([^/]+)$/);
    if (luDelMatch && method === "DELETE") {
      if (!user.is_owner) return authedJson({ error: "Krever eier" }, 403);
      const target = decodeURIComponent(luDelMatch[1]);
      const row = await env.DB.prepare(
        "SELECT username, is_owner, list_id FROM users WHERE username = ?1 COLLATE NOCASE"
      ).bind(target).first();
      if (!row || row.list_id !== user.list_id) {
        return authedJson({ error: "Fant ikke bruker på listen" }, 404);
      }
      if (row.is_owner === 1) {
        const c = await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM users WHERE is_owner = 1 AND list_id = ?1"
        ).bind(user.list_id).first();
        if (c.n <= 1) return authedJson({ error: "Kan ikke fjerne listens eneste eier" }, 400);
      }
      // Deleting the row makes requireAuth's DB lookup fail (no row) on the
      // user's next request → 401 → re-login, so no token_version bump needed.
      await env.DB.prepare("DELETE FROM users WHERE username = ?1 COLLATE NOCASE")
        .bind(row.username).run();
      return authedJson({ ok: true });
    }

    // ===== SHOPPING LIST (all queries scoped to user.list_id) =====
    if (path === "/list" && method === "GET") {
      const { results } = await env.DB.prepare(`
        SELECT li.id, li.bought, li.added_by, li.added_at, li.bought_at, li.qty, li.notes, c.name, c.category
        FROM list_items li
        JOIN item_catalogue c ON c.id = li.catalogue_id
        WHERE li.list_id = ?1
        ORDER BY li.bought ASC, c.category ASC, c.name ASC
      `).bind(user.list_id).all();
      return authedJson(results);
    }

    if (path === "/list" && method === "POST") {
      const body = await readJson(request);
      if (!body) return authedJson({ error: "Ugyldig forespørsel" }, 400);
      const { name, category, notes, qty } = body;
      const { name: stripped, gf } = extractGlutenFree(name);
      const clean = capitalizeName(stripped);
      if (!clean) return authedJson({ error: "Tomt navn" }, 400);
      const addQty = Math.max(1, parseInt(qty, 10) || 1);
      // A gluten-free marker pulled out of the name is recorded as a "Glutenfri"
      // note (regardless of how it was typed — "gf", "GF", "glutenfri"), without
      // duplicating one the caller already passed, so the gluten-free variant is
      // tracked as a note rather than a separate catalogue name.
      let noteVal = (notes || "").trim();
      if (gf && !/\b(gf|glutenfri|glutenfritt)\b/i.test(noteVal)) {
        noteVal = noteVal ? `${noteVal} Glutenfri` : "Glutenfri";
      }
      noteVal = noteVal || null;
      let cat = await env.DB.prepare(
        "SELECT id, category FROM item_catalogue WHERE name = ?1 COLLATE NOCASE AND list_id = ?2"
      ).bind(clean, user.list_id).first();
      if (!cat) {
        const chosenCat = CATEGORIES.includes(category) ? category : "Annet";
        // Upsert so two concurrent adds of a new name can't collide on the
        // UNIQUE(list_id, name) constraint — the loser gets the existing row.
        cat = await env.DB.prepare(`
          INSERT INTO item_catalogue (name, category, list_id) VALUES (?1, ?2, ?3)
          ON CONFLICT(list_id, name) DO UPDATE SET name = name
          RETURNING id, category
        `).bind(clean, chosenCat, user.list_id).first();
      }
      // Merge only into an unbought line whose notes match, so e.g. a plain
      // "Pasta" and a "Pasta" + "GF" note coexist as two separate lines instead
      // of one bumping the other's quantity.
      const existing = await env.DB.prepare(
        "SELECT id FROM list_items WHERE catalogue_id = ?1 AND bought = 0 AND list_id = ?2 AND IFNULL(notes, '') = IFNULL(?3, '')"
      ).bind(cat.id, user.list_id, noteVal).first();
      if (existing) {
        const updated = await env.DB.prepare(
          "UPDATE list_items SET qty = qty + ?2 WHERE id = ?1 RETURNING qty"
        ).bind(existing.id, addQty).first();
        return authedJson({ ok: true, duplicate: true, qty: updated.qty });
      }
      await env.DB.prepare(
        "INSERT INTO list_items (catalogue_id, added_by, notes, qty, list_id) VALUES (?1, ?2, ?3, ?4, ?5)"
      ).bind(cat.id, user.username, noteVal, addQty, user.list_id).run();
      return authedJson({ ok: true, qty: addQty });
    }

    const patchMatch = path.match(/^\/list\/(\d+)$/);
    if (patchMatch && method === "PATCH") {
      const body = await readJson(request);
      if (!body) return authedJson({ error: "Ugyldig forespørsel" }, 400);
      const { qty, notes, category, name } = body;
      const row = await env.DB.prepare(
        "SELECT catalogue_id FROM list_items WHERE id = ?1 AND list_id = ?2"
      ).bind(patchMatch[1], user.list_id).first();
      if (!row) return authedJson({ error: "Fant ikke vare" }, 404);
      if (qty !== undefined) {
        const cleanQty = Math.max(1, parseInt(qty, 10) || 1);
        await env.DB.prepare("UPDATE list_items SET qty = ?1 WHERE id = ?2 AND list_id = ?3")
          .bind(cleanQty, patchMatch[1], user.list_id).run();
      }
      if (notes !== undefined) {
        await env.DB.prepare("UPDATE list_items SET notes = ?1 WHERE id = ?2 AND list_id = ?3")
          .bind((notes || "").trim() || null, patchMatch[1], user.list_id).run();
      }
      if (category !== undefined && CATEGORIES.includes(category)) {
        await env.DB.prepare("UPDATE item_catalogue SET category = ?1 WHERE id = ?2 AND list_id = ?3")
          .bind(category, row.catalogue_id, user.list_id).run();
      }
      if (name !== undefined) {
        const cleanName = capitalizeName(name);
        if (!cleanName) return authedJson({ error: "Tomt navn" }, 400);
        const clash = await env.DB.prepare(
          "SELECT id FROM item_catalogue WHERE name = ?1 COLLATE NOCASE AND list_id = ?2 AND id != ?3"
        ).bind(cleanName, user.list_id, row.catalogue_id).first();
        if (clash) return authedJson({ error: "En vare med dette navnet finnes allerede" }, 400);
        await env.DB.prepare("UPDATE item_catalogue SET name = ?1 WHERE id = ?2 AND list_id = ?3")
          .bind(cleanName, row.catalogue_id, user.list_id).run();
      }
      return authedJson({ ok: true });
    }

    // Deletes the catalogue entry entirely (not just this list_items row) —
    // cascades to every list_items row referencing it via the FK, removing the
    // item from past/present lists, not just hiding this one occurrence.
    const delCatMatch = path.match(/^\/list\/(\d+)\/catalogue$/);
    if (delCatMatch && method === "DELETE") {
      const row = await env.DB.prepare(
        "SELECT catalogue_id FROM list_items WHERE id = ?1 AND list_id = ?2"
      ).bind(delCatMatch[1], user.list_id).first();
      if (!row) return authedJson({ error: "Fant ikke vare" }, 404);
      await env.DB.prepare("DELETE FROM item_catalogue WHERE id = ?1 AND list_id = ?2")
        .bind(row.catalogue_id, user.list_id).run();
      return authedJson({ ok: true });
    }

    const toggleMatch = path.match(/^\/list\/(\d+)\/toggle$/);
    if (toggleMatch && method === "POST") {
      await env.DB.prepare(`
        UPDATE list_items SET bought = CASE bought WHEN 0 THEN 1 ELSE 0 END,
            bought_at = CASE bought WHEN 0 THEN datetime('now') ELSE NULL END
        WHERE id = ?1 AND list_id = ?2
      `).bind(toggleMatch[1], user.list_id).run();
      return authedJson({ ok: true });
    }

    const delMatch = path.match(/^\/list\/(\d+)$/);
    if (delMatch && method === "DELETE") {
      await env.DB.prepare("DELETE FROM list_items WHERE id = ?1 AND list_id = ?2")
        .bind(delMatch[1], user.list_id).run();
      return authedJson({ ok: true });
    }

    if (path === "/catalogue" && method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT name, category FROM item_catalogue WHERE list_id = ?1 ORDER BY name ASC"
      ).bind(user.list_id).all();
      return authedJson(results);
    }

    // ===== MEALS =====
    if (path === "/meals" && method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT id, name, ingredients FROM meal_catalogue WHERE list_id = ?1 ORDER BY name ASC"
      ).bind(user.list_id).all();
      return authedJson(results);
    }

    if (path === "/plan" && method === "GET") {
      // The frontend only ever navigates to last/this/next week (at most 13
      // days before today), so there's no value in keeping plan rows beyond
      // that — opportunistically drop anything older on every read. The
      // 14-day cutoff (vs. 13) is a safety margin against clock/timezone
      // skew between the server's `now` and a client's local "today".
      await env.DB.prepare(
        "DELETE FROM meal_plan WHERE list_id = ?1 AND plan_date < date('now', '-14 days')"
      ).bind(user.list_id).run();
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      let q = `SELECT p.id, p.plan_date, p.responsible, m.name AS meal_name, m.id AS meal_id,
        m.ingredients AS ingredients
        FROM meal_plan p JOIN meal_catalogue m ON m.id = p.meal_id
        WHERE p.list_id = ?1`;
      const binds = [user.list_id];
      if (from && to) { q += " AND p.plan_date BETWEEN ?2 AND ?3"; binds.push(from, to); }
      q += " ORDER BY p.plan_date ASC";
      const { results } = await env.DB.prepare(q).bind(...binds).all();
      return authedJson(results);
    }

    if (path === "/plan" && method === "POST") {
      const body = await readJson(request);
      if (!body) return authedJson({ error: "Ugyldig forespørsel" }, 400);
      const { plan_date, meal_name, responsible, ingredients } = body;
      if (!plan_date || !meal_name) return authedJson({ error: "Mangler dato eller måltid" }, 400);
      // Capitalise new meal names the same way item names are (capitalizeName),
      // so a meal typed in the planner is stored "Taco", not "taco". Lookups are
      // COLLATE NOCASE, so this only affects how a genuinely new name is stored.
      const clean = capitalizeName(meal_name);
      // ingredients (TODO #9) is a JSON-encoded array, stored once per meal
      // name in meal_catalogue and shared across every occurrence of that
      // meal — undefined means "leave whatever's stored alone".
      const ingredientsJson = Array.isArray(ingredients) ? JSON.stringify(ingredients) : undefined;
      let meal = await env.DB.prepare(
        "SELECT id FROM meal_catalogue WHERE name = ?1 COLLATE NOCASE AND list_id = ?2"
      ).bind(clean, user.list_id).first();
      if (!meal) {
        // Upsert to avoid a UNIQUE(list_id, name) collision on concurrent first use.
        meal = await env.DB.prepare(`
          INSERT INTO meal_catalogue (name, list_id, ingredients) VALUES (?1, ?2, ?3)
          ON CONFLICT(list_id, name) DO UPDATE SET name = name
          RETURNING id
        `).bind(clean, user.list_id, ingredientsJson ?? "[]").first();
      } else if (ingredientsJson !== undefined) {
        await env.DB.prepare("UPDATE meal_catalogue SET ingredients = ?1 WHERE id = ?2")
          .bind(ingredientsJson, meal.id).run();
      }
      await env.DB.prepare(`
        INSERT INTO meal_plan (plan_date, meal_id, responsible, list_id)
        VALUES (?1, ?2, ?3, ?4)
        ON CONFLICT(list_id, plan_date) DO UPDATE SET
          meal_id = excluded.meal_id,
          responsible = excluded.responsible,
          updated_at = datetime('now')
      `).bind(plan_date, meal.id, responsible || "", user.list_id).run();
      return authedJson({ ok: true });
    }

    const planDelMatch = path.match(/^\/plan\/(\d{4}-\d{2}-\d{2})$/);
    if (planDelMatch && method === "DELETE") {
      await env.DB.prepare("DELETE FROM meal_plan WHERE plan_date = ?1 AND list_id = ?2")
        .bind(planDelMatch[1], user.list_id).run();
      return authedJson({ ok: true });
    }

    return authedJson({ error: "Not found" }, 404);
  }
};
