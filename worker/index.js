// Laget av Mohibb Malik, 2026
// Worker API for shared shopping list + meal planner
// Served at shopping.mohibb.com. Frontend on Cloudflare Pages,
// API = this Worker under /api/* and /seed. Proxies other paths to Pages.
// Auth: users in D1 with PBKDF2 password hashes, JWT with token versioning,
//       sliding expiry, in-app password change that logs out other devices.

const CATEGORIES = [
  "Frukt og grønt", "Brød og bakevarer", "Meieriprodukter", "Kjøtt og fisk",
  "Ingredienser og krydder", "Frysevarer og ferdigmåltid", "Kornprodukter",
  "Snacks og godteri", "Drikkevarer", "Husholdning", "Omsorg og helse",
  "Dyreprodukter", "Annet"
];

// ---------- JWT helpers (HS256, no external deps) ----------
function b64url(input) {
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlStr(str) {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return atob(str);
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
  if (expected !== sig) return null;
  try {
    const payload = JSON.parse(b64urlDecode(body));
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch { return null; }
}

// ---------- password hashing (PBKDF2 via Web Crypto) ----------
const PBKDF2_ITER = 100000;
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

// Verifies JWT signature/expiry AND that token_version matches the DB.
async function requireAuth(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const payload = await verifyJwt(token, env.JWT_SECRET);
  if (!payload || !payload.sub) return null;
  const row = await env.DB.prepare(
    "SELECT username, token_version FROM users WHERE username = ?1 COLLATE NOCASE"
  ).bind(payload.sub).first();
  if (!row) return null;
  if (payload.tv !== row.token_version) return null;
  return row;
}

async function mintToken(username, tokenVersion, env) {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 90;
  return await signJwt({ sub: username, tv: tokenVersion, exp }, env.JWT_SECRET);
}

// ---------- main ----------
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;

    // ===== SEED.HTML FORM (GET) =====
    if (url.pathname === "/seed.html" && method === "GET") {
      return new Response(`<!DOCTYPE html>
<html lang="no">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Panhandle - oppsett av kontoer</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; max-width: 460px;
    margin: 40px auto; padding: 0 16px; color: #1a1a1a; }
  h1 { color: #2d8a4e; font-size: 22px; }
  .warn { background: #fff4e5; border: 1px solid #ffd9a0; border-radius: 10px;
    padding: 12px 14px; font-size: 14px; margin: 16px 0; }
  label { display: block; font-size: 13px; color: #555; margin: 14px 0 4px; }
  input { width: 100%; padding: 12px; font-size: 16px; border-radius: 10px;
    border: 1px solid #ddd; box-sizing: border-box; }
  button { width: 100%; padding: 14px; margin-top: 20px; background: #2d8a4e;
    color: #fff; border: none; border-radius: 12px; font-size: 16px; font-weight: 600; }
  #out { margin-top: 16px; font-size: 14px; white-space: pre-wrap; }
  hr { border: none; border-top: 1px solid #eee; margin: 24px 0; }
</style>
</head>
<body>
<h1>Panhandle - opprett kontoer</h1>
<div class="warn">Denne siden kjøres <b>én gang</b> for å opprette de to kontoene. Etterpå fjern SEED_SECRET.</div>
<label>SEED_SECRET</label>
<input id="secret" type="password" placeholder="seed-hemmelighet">
<hr>
<label>Bruker 1 - brukernavn</label>
<input id="u1" value="Mohibb">
<label>Bruker 1 - passord</label>
<input id="p1" type="password" placeholder="passord">
<label>Bruker 2 - brukernavn</label>
<input id="u2" value="Saffa">
<label>Bruker 2 - passord</label>
<input id="p2" type="password" placeholder="passord">
<button onclick="seed()">Opprett kontoer</button>
<div id="out"></div>
<script>
async function seed() {
  const out = document.getElementById("out");
  out.style.color = "#333";
  out.textContent = "Sender...";
  try {
    const res = await fetch("/seed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: document.getElementById("secret").value,
        accounts: [
          { username: document.getElementById("u1").value.trim(), password: document.getElementById("p1").value },
          { username: document.getElementById("u2").value.trim(), password: document.getElementById("p2").value }
        ]
      })
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      out.style.color = "#2d8a4e";
      out.textContent = "Kontoer opprettet. Fjern SEED_SECRET nå, gå til shopping.mohibb.com og logg inn.";
    } else {
      out.style.color = "#d64545";
      out.textContent = "Feil: " + (data.error || res.status);
    }
  } catch (e) {
    out.style.color = "#d64545";
    out.textContent = "Nettverksfeil: " + e.message;
  }
}
</script>
</body>
</html>`, { headers: { "Content-Type": "text/html" } });
    }

    // ===== ROUTING =====
    const isApi = url.pathname === "/seed" || url.pathname.startsWith("/api");
    if (!isApi) {
      const pagesUrl = new URL(request.url);
      pagesUrl.hostname = "panhandle-ecj.pages.dev";
      return fetch(new Request(pagesUrl.toString(), request));
    }

    const path = url.pathname.replace(/^\/api/, "");

    // ===== SEED ENDPOINT (POST) =====
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
      for (const a of accounts) {
        if (!a.username || !a.password) continue;
        const hash = await hashPassword(a.password);
        await env.DB.prepare(`
          INSERT INTO users (username, pass_hash, token_version) VALUES (?1, ?2, 1)
          ON CONFLICT(username) DO UPDATE SET pass_hash = excluded.pass_hash
        `).bind(a.username.trim(), hash).run();
        created++;
      }
      return json({ ok: true, created });
    }

    // ===== LOGIN =====
    if (path === "/login" && method === "POST") {
      const body = await readJson(request);
      if (!body) return json({ error: "Ugyldig forespørsel" }, 400);
      const { username, password } = body;
      const row = await env.DB.prepare(
        "SELECT username, pass_hash, token_version FROM users WHERE username = ?1 COLLATE NOCASE"
      ).bind((username || "").trim()).first();
      if (!row || !(await verifyPassword(password || "", row.pass_hash))) {
        return json({ error: "Feil brukernavn eller passord" }, 401);
      }
      const token = await mintToken(row.username, row.token_version, env);
      return json({ token, user: row.username });
    }

    // ===== AUTH REQUIRED BELOW =====
    const user = await requireAuth(request, env);
    if (!user) return json({ error: "Ikke autorisert" }, 401);
    const freshToken = await mintToken(user.username, user.token_version, env);

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
      const tokenAfter = await mintToken(user.username, newVersion, env);
      return json({ ok: true, token: tokenAfter });
    }

    // ===== SHOPPING LIST =====
    if (path === "/list" && method === "GET") {
      const { results } = await env.DB.prepare(`
        SELECT li.id, li.bought, li.added_by, li.added_at, li.bought_at, li.qty, li.notes, c.name, c.category
        FROM list_items li
        JOIN item_catalogue c ON c.id = li.catalogue_id
        ORDER BY li.bought ASC, c.category ASC, c.name ASC
      `).all();
      return new Response(JSON.stringify(results), {
        status: 200, headers: { "Content-Type": "application/json", "X-Refresh-Token": freshToken }
      });
    }

    if (path === "/list" && method === "POST") {
      const body = await readJson(request);
      if (!body) return json({ error: "Ugyldig forespørsel" }, 400);
      const { name, category, notes, qty } = body;
      const clean = (name || "").trim();
      if (!clean) return json({ error: "Tomt navn" }, 400);
      const addQty = Math.max(1, parseInt(qty, 10) || 1);
      let cat = await env.DB.prepare(
        "SELECT id, category FROM item_catalogue WHERE name = ?1 COLLATE NOCASE"
      ).bind(clean).first();
      if (!cat) {
        const chosenCat = CATEGORIES.includes(category) ? category : "Annet";
        // Upsert so two concurrent adds of a new name can't collide on the
        // UNIQUE(name) constraint — the loser gets the existing row back.
        cat = await env.DB.prepare(`
          INSERT INTO item_catalogue (name, category) VALUES (?1, ?2)
          ON CONFLICT(name) DO UPDATE SET name = name
          RETURNING id, category
        `).bind(clean, chosenCat).first();
      }
      const existing = await env.DB.prepare(
        "SELECT id FROM list_items WHERE catalogue_id = ?1 AND bought = 0"
      ).bind(cat.id).first();
      if (existing) {
        const updated = await env.DB.prepare(
          "UPDATE list_items SET qty = qty + ?2 WHERE id = ?1 RETURNING qty"
        ).bind(existing.id, addQty).first();
        return json({ ok: true, duplicate: true, qty: updated.qty });
      }
      await env.DB.prepare(
        "INSERT INTO list_items (catalogue_id, added_by, notes, qty) VALUES (?1, ?2, ?3, ?4)"
      ).bind(cat.id, user.username, (notes || "").trim() || null, addQty).run();
      return json({ ok: true, qty: addQty });
    }

    const patchMatch = path.match(/^\/list\/(\d+)$/);
    if (patchMatch && method === "PATCH") {
      const body = await readJson(request);
      if (!body) return json({ error: "Ugyldig forespørsel" }, 400);
      const { qty, notes, category } = body;
      const row = await env.DB.prepare(
        "SELECT catalogue_id FROM list_items WHERE id = ?1"
      ).bind(patchMatch[1]).first();
      if (!row) return json({ error: "Fant ikke vare" }, 404);
      if (qty !== undefined) {
        const cleanQty = Math.max(1, parseInt(qty, 10) || 1);
        await env.DB.prepare("UPDATE list_items SET qty = ?1 WHERE id = ?2")
          .bind(cleanQty, patchMatch[1]).run();
      }
      if (notes !== undefined) {
        await env.DB.prepare("UPDATE list_items SET notes = ?1 WHERE id = ?2")
          .bind((notes || "").trim() || null, patchMatch[1]).run();
      }
      if (category !== undefined && CATEGORIES.includes(category)) {
        await env.DB.prepare("UPDATE item_catalogue SET category = ?1 WHERE id = ?2")
          .bind(category, row.catalogue_id).run();
      }
      return json({ ok: true });
    }

    const toggleMatch = path.match(/^\/list\/(\d+)\/toggle$/);
    if (toggleMatch && method === "POST") {
      await env.DB.prepare(`
        UPDATE list_items SET bought = CASE bought WHEN 0 THEN 1 ELSE 0 END,
            bought_at = CASE bought WHEN 0 THEN datetime('now') ELSE NULL END
        WHERE id = ?1
      `).bind(toggleMatch[1]).run();
      return json({ ok: true });
    }

    const delMatch = path.match(/^\/list\/(\d+)$/);
    if (delMatch && method === "DELETE") {
      await env.DB.prepare("DELETE FROM list_items WHERE id = ?1").bind(delMatch[1]).run();
      return json({ ok: true });
    }

if (path === "/catalogue" && method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT name, category FROM item_catalogue ORDER BY name ASC"
      ).all();
      return json(results);
    }

    // ===== MEALS =====
    if (path === "/meals" && method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT id, name, ingredients FROM meal_catalogue ORDER BY name ASC"
      ).all();
      return json(results);
    }

    if (path === "/plan" && method === "GET") {
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      let q = `SELECT p.id, p.plan_date, p.responsible, m.name AS meal_name, m.id AS meal_id
        FROM meal_plan p JOIN meal_catalogue m ON m.id = p.meal_id`;
      const binds = [];
      if (from && to) { q += " WHERE p.plan_date BETWEEN ?1 AND ?2"; binds.push(from, to); }
      q += " ORDER BY p.plan_date ASC";
      const stmt = binds.length ? env.DB.prepare(q).bind(...binds) : env.DB.prepare(q);
      const { results } = await stmt.all();
      return json(results);
    }

    if (path === "/plan" && method === "POST") {
      const body = await readJson(request);
      if (!body) return json({ error: "Ugyldig forespørsel" }, 400);
      const { plan_date, meal_name, responsible } = body;
      if (!plan_date || !meal_name) return json({ error: "Mangler dato eller måltid" }, 400);
      const clean = meal_name.trim();
      let meal = await env.DB.prepare(
        "SELECT id FROM meal_catalogue WHERE name = ?1 COLLATE NOCASE"
      ).bind(clean).first();
      if (!meal) {
        // Upsert to avoid a UNIQUE(name) collision on concurrent first use.
        meal = await env.DB.prepare(`
          INSERT INTO meal_catalogue (name) VALUES (?1)
          ON CONFLICT(name) DO UPDATE SET name = name
          RETURNING id
        `).bind(clean).first();
      }
      await env.DB.prepare(`
        INSERT INTO meal_plan (plan_date, meal_id, responsible)
        VALUES (?1, ?2, ?3)
        ON CONFLICT(plan_date) DO UPDATE SET
          meal_id = excluded.meal_id,
          responsible = excluded.responsible,
          updated_at = datetime('now')
      `).bind(plan_date, meal.id, responsible || "").run();
      return json({ ok: true });
    }

    const planDelMatch = path.match(/^\/plan\/(\d{4}-\d{2}-\d{2})$/);
    if (planDelMatch && method === "DELETE") {
      await env.DB.prepare("DELETE FROM meal_plan WHERE plan_date = ?1")
        .bind(planDelMatch[1]).run();
      return json({ ok: true });
    }

    return json({ error: "Not found" }, 404);
  }
};
