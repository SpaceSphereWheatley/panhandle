// The claude.ai connector (docs/mcp-connector-plan.md): an OAuth 2.1
// authorization server plus a remote MCP endpoint at <origin>/mcp, inside
// the existing Worker. Kept out of worker/index.js because it's a separate
// concern — a protocol adapter with no SQL and no business logic of its own —
// and because it's the only code that touches @cloudflare/workers-oauth-
// provider. The dependency is one-way: index.js imports createConnector() and
// hands it what it needs (`route`, `signJwt`, the Oslo date helpers), so this
// file never imports index.js back.
//
// Every tool call goes through the ordinary /api/* routes via `route()`, with
// a short-lived connector JWT (see connectorClaims/CONNECTOR_ROUTES in
// index.js), so all existing validation and list_id scoping applies and the
// phase-1 gate sits underneath as a second layer.
import { matchCatalogue } from "../src/lib/shoppingUtils.js";
import { translateItemName } from "../src/lib/i18n/itemNames.js";

// The OAuth library is loaded on first use, not imported statically: it
// imports `cloudflare:workers`, which plain Node can't resolve, and Node is
// where tests/worker-unit.test.mjs imports index.js (and so this file).
// Nothing but a connector request ever loads it.
let oauthLib = null;
const loadOAuthLib = async () => (oauthLib ??= await import("@cloudflare/workers-oauth-provider"));

const MCP_PATH = "/mcp";
const AUTHORIZE_PATH = "/oauth/authorize";
const CONSENT_KEY_PREFIX = "panhandle-consent:";
const CONSENT_TTL_SECONDS = 600; // matches the library's consent-handle lifetime
const CONNECTOR_JWT_TTL_SECONDS = 300;

// Only Claude may connect: its hosted callback (and the claude.com one it may
// move to), plus Claude Code's port-agnostic loopback redirect. Widening this
// is a deliberate edit — see the plan's Security section.
const CLAUDE_CALLBACKS = new Set([
  "https://claude.ai/api/mcp/auth_callback",
  "https://claude.com/api/mcp/auth_callback",
]);

export function isAllowedRedirectUri(uri) {
  if (CLAUDE_CALLBACKS.has(uri)) return true;
  let u;
  try { u = new URL(uri); } catch { return false; }
  return u.protocol === "http:"
    && (u.hostname === "localhost" || u.hostname === "127.0.0.1")
    && u.pathname === "/callback"
    && !u.username && !u.password && !u.search && !u.hash;
}

// The connector answers on the app's own host, on this Worker's *.workers.dev
// preview hostnames (any request reaching this Worker on workers.dev is one of
// its own previews), and on loopback for wrangler dev. Not on panhandle.app or
// the legacy shopping.mohibb.com, which keep their redirects.
export function isConnectorHost(hostname, appOrigin) {
  let appHost = "shop.panhandle.app";
  try { appHost = new URL(appOrigin).hostname; } catch { /* keep default */ }
  return hostname === appHost
    || hostname.endsWith(".workers.dev")
    || hostname === "localhost" || hostname === "127.0.0.1";
}

export function isConnectorPath(pathname) {
  return pathname === MCP_PATH || pathname.startsWith(MCP_PATH + "/")
    || pathname.startsWith("/oauth/")
    || pathname.startsWith("/.well-known/oauth-protected-resource")
    || pathname.startsWith("/.well-known/oauth-authorization-server");
}

// Grant userIds may not contain ":" (the library uses it as a separator).
const grantUserId = (username) => encodeURIComponent(username.toLowerCase());

function textResponse(status, message) {
  return new Response(message, {
    status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

// ---------- MCP JSON-RPC ----------
// A stateless MCP 2025-11-25 server over Streamable HTTP: POST only, plain
// JSON responses, no SSE and no Mcp-Session-Id. Hand-rolled rather than the
// MCP SDK — for nine stateless tools it's a small dispatcher, and it keeps
// zod and the SDK's transports out of the Worker.
export const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"];

const SERVER_INSTRUCTIONS =
  "Panhandle is a household's shared shopping list, meal planner and storage-box inventory. " +
  "Item names are stored in English; Norwegian names are matched to them automatically, and " +
  "results show both. Dates are YYYY-MM-DD in Europe/Oslo; meal-plan results include today's date.";

const rpcResult = (id, result) => ({ jsonrpc: "2.0", id, result });
const rpcError = (id, code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });

function toolText(value, isError = false) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  const out = { content: [{ type: "text", text }] };
  if (isError) out.isError = true;
  else if (typeof value === "object") out.structuredContent = value;
  return out;
}

class ToolError extends Error {}

// What a tool call can reach: an authenticated /api call as the grant's user.
function makeApi({ deps, env, origin, props, scopes }) {
  return async function api(method, path, body) {
    const now = Math.floor(Date.now() / 1000);
    const token = await deps.signJwt({
      sub: props.username, tv: props.tv, aud: "mcp",
      scp: scopes.filter((s) => s === "read" || s === "write"),
      exp: now + CONNECTOR_JWT_TTL_SECONDS,
    }, env.JWT_SECRET);
    const headers = { Authorization: `Bearer ${token}` };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const res = await deps.route(new Request(origin + "/api" + path, {
      method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
    }), env);
    let data = null;
    try { data = await res.json(); } catch { /* empty or non-JSON body */ }
    if (res.status === 401) {
      throw new ToolError("This connection is no longer valid (the password may have changed). Reconnect Panhandle in Claude's connector settings.");
    }
    if (!res.ok) throw new ToolError(data?.error || `Request failed (${res.status})`);
    return data;
  };
}

// ---------- tools ----------
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function weekdayOf(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

function isRealDate(iso) {
  if (!ISO_DATE.test(iso)) return false;
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function displayNames(users) {
  const byUsername = new Map();
  for (const u of users || []) byUsername.set(u.username.toLowerCase(), u.name || u.username);
  return (username) => (username ? byUsername.get(String(username).toLowerCase()) || username : null);
}

function withNorwegian(name) {
  const nb = translateItemName(name, "nb");
  return nb && nb.toLowerCase() !== name.toLowerCase() ? { name, name_nb: nb } : { name };
}

// The same lookup the app's add box uses, so "melk" lands on the canonical
// "Milk" row instead of creating a Norwegian duplicate. Only an exact or
// whole-word hit is taken; anything looser goes through as typed, exactly as
// it would in the app.
export function resolveCatalogueName(query, catalogue) {
  const q = query.trim();
  const best = matchCatalogue(q, catalogue, "nb")[0];
  if (!best) return q;
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
  const searchable = `${best.name} ${translateItemName(best.name, "nb")}`.toLowerCase();
  const words = searchable.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return tokens.every((t) => words.includes(t)) ? best.name : q;
}

// The window the app's meal planner shows (src/lib/mealUtils.js WEEK_MIN..
// WEEK_MAX = -1..4 weeks around the current Mon-Sun week).
export function planWindow(today, dow, addDaysIso) {
  const weekStart = addDaysIso(today, -dow);
  return { min: addDaysIso(weekStart, -7), max: addDaysIso(weekStart, 5 * 7 - 1) };
}

function shapeItem(it, nameFor) {
  return {
    id: it.id, ...withNorwegian(it.name), category: it.category, qty: it.qty,
    ...(it.notes ? { notes: it.notes } : {}),
    ...(it.important ? { important: true } : {}),
    added_by: nameFor(it.added_by),
  };
}

const TOOLS = [
  {
    name: "get_shopping_list",
    scope: "read",
    description: "Get the household's shopping list: every item not yet bought, with its id, category, quantity and notes. Set include_bought to also get the 20 most recently bought items.",
    inputSchema: {
      type: "object",
      properties: { include_bought: { type: "boolean", description: "Also return recently bought items." } },
      additionalProperties: false,
    },
    annotations: { title: "Get shopping list", readOnlyHint: true },
    async run({ include_bought = false }, { api }) {
      const [items, users] = await Promise.all([api("GET", "/list"), api("GET", "/list-users")]);
      const nameFor = displayNames(users);
      const unbought = items.filter((it) => !it.bought).map((it) => shapeItem(it, nameFor));
      const out = { to_buy: unbought, count: unbought.length };
      if (include_bought) {
        out.recently_bought = items.filter((it) => it.bought)
          .sort((a, b) => String(b.bought_at || "").localeCompare(String(a.bought_at || "")))
          .slice(0, 20).map((it) => ({ ...shapeItem(it, nameFor), bought_at: it.bought_at }));
      }
      return out;
    },
  },
  {
    name: "add_items",
    scope: "write",
    description: "Add one or more items to the shopping list. Names may be Norwegian or English; they are matched to the household's catalogue (e.g. 'melk' becomes 'Milk'). Adding an item that is already on the list increases its quantity instead of duplicating it.",
    inputSchema: {
      type: "object",
      properties: {
        items: {
          type: "array", minItems: 1, maxItems: 30,
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Item name, e.g. 'Milk' or 'melk'." },
              qty: { type: "integer", minimum: 1, description: "Quantity, default 1." },
              notes: { type: "string", description: "Optional note, e.g. 'lactose free'." },
            },
            required: ["name"],
            additionalProperties: false,
          },
        },
      },
      required: ["items"],
      additionalProperties: false,
    },
    annotations: { title: "Add to shopping list", readOnlyHint: false, destructiveHint: false },
    async run({ items }, { api }) {
      if (!Array.isArray(items) || !items.length || items.length > 30) throw new ToolError("items must be a list of 1 to 30 items.");
      const catalogue = await api("GET", "/catalogue");
      const results = [];
      for (const raw of items) {
        const requested = typeof raw?.name === "string" ? raw.name.trim() : "";
        if (!requested) { results.push({ requested: raw?.name ?? null, error: "Empty name" }); continue; }
        const name = resolveCatalogueName(requested, catalogue);
        const body = { name };
        if (Number.isInteger(raw.qty) && raw.qty > 0) body.qty = raw.qty;
        if (typeof raw.notes === "string" && raw.notes.trim()) body.notes = raw.notes.trim();
        try {
          const res = await api("POST", "/list", body);
          results.push({ requested, added_as: name, id: res.id, qty: res.qty, ...(res.duplicate ? { merged_with_existing: true } : {}) });
        } catch (e) {
          if (!(e instanceof ToolError)) throw e;
          results.push({ requested, error: e.message });
        }
      }
      return { results };
    },
  },
  {
    name: "check_off_items",
    scope: "write",
    description: "Mark shopping-list items as bought, by id (from get_shopping_list). Items that are already bought are left as they are.",
    inputSchema: {
      type: "object",
      properties: { ids: { type: "array", items: { type: "integer" }, minItems: 1, maxItems: 50 } },
      required: ["ids"],
      additionalProperties: false,
    },
    annotations: { title: "Check off items", readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    async run({ ids }, { api }) {
      if (!Array.isArray(ids) || !ids.length || ids.length > 50) throw new ToolError("ids must be a list of 1 to 50 item ids.");
      const items = await api("GET", "/list");
      const byId = new Map(items.map((it) => [it.id, it]));
      const results = [];
      for (const id of ids) {
        const it = byId.get(id);
        if (!it) { results.push({ id, error: "Item not found" }); continue; }
        if (it.bought) { results.push({ id, name: it.name, status: "already bought" }); continue; }
        await api("POST", `/list/${id}/toggle`);
        results.push({ id, name: it.name, status: "bought" });
      }
      return { results };
    },
  },
  {
    name: "set_item_important",
    scope: "write",
    description: "Mark a shopping-list item as important (highlighted in the app), or remove the mark.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "integer" }, important: { type: "boolean" } },
      required: ["id", "important"],
      additionalProperties: false,
    },
    annotations: { title: "Mark item important", readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    async run({ id, important }, { api }) {
      if (!Number.isInteger(id) || typeof important !== "boolean") throw new ToolError("id (integer) and important (boolean) are required.");
      await api("PATCH", `/list/${id}`, { important });
      return { id, important };
    },
  },
  {
    name: "get_meal_plan",
    scope: "read",
    description: "Get the household's planned dinners between two dates (inclusive, YYYY-MM-DD). Defaults to today and the next 6 days. The result includes today's date and weekday in Oslo.",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", description: "First date, YYYY-MM-DD." },
        to: { type: "string", description: "Last date, YYYY-MM-DD." },
      },
      additionalProperties: false,
    },
    annotations: { title: "Get meal plan", readOnlyHint: true },
    async run({ from, to }, { api, deps }) {
      const { today } = deps.osloLocalDateParts(Date.now());
      const start = from ?? today;
      const end = to ?? deps.addDaysIso(start, 6);
      if (!isRealDate(start) || !isRealDate(end)) throw new ToolError("Dates must be YYYY-MM-DD.");
      if (end < start) throw new ToolError("'to' must not be before 'from'.");
      const [rows, users] = await Promise.all([
        api("GET", `/plan?from=${start}&to=${end}`), api("GET", "/list-users"),
      ]);
      const nameFor = displayNames(users);
      return {
        today, today_weekday: weekdayOf(today), from: start, to: end,
        days: rows.map((r) => ({
          date: r.plan_date, weekday: weekdayOf(r.plan_date),
          meal: r.meal_name || null,
          responsible: nameFor(r.responsible),
          ...(r.recipe_url ? { recipe_url: r.recipe_url } : {}),
        })),
      };
    },
  },
  {
    name: "plan_meal",
    scope: "write",
    description: "Set the dinner and/or who is responsible for one date (YYYY-MM-DD). Replaces whatever was planned that day: check get_meal_plan first and ask the user before overwriting a planned day. Omit a field to leave it unchanged. Only dates from last week up to four weeks ahead are allowed.",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "YYYY-MM-DD" },
        meal_name: { type: "string", description: "The dinner, e.g. 'Taco'." },
        responsible: { type: "string", description: "Household member's name, or free text." },
      },
      required: ["date"],
      additionalProperties: false,
    },
    annotations: { title: "Plan a meal", readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    async run({ date, meal_name, responsible }, { api, deps }) {
      if (!isRealDate(date ?? "")) throw new ToolError("date must be YYYY-MM-DD.");
      if (meal_name === undefined && responsible === undefined) throw new ToolError("Give meal_name, responsible, or both.");
      const { today, dow } = deps.osloLocalDateParts(Date.now());
      const { min, max } = planWindow(today, dow, deps.addDaysIso);
      if (date < min || date > max) throw new ToolError(`Only dates from ${min} to ${max} can be planned.`);
      const [existing, users] = await Promise.all([
        api("GET", `/plan?from=${date}&to=${date}`), api("GET", "/list-users"),
      ]);
      const body = { plan_date: date };
      if (meal_name !== undefined) body.meal_name = String(meal_name).trim();
      if (responsible !== undefined) {
        const wanted = String(responsible).trim().toLowerCase();
        const member = (users || []).find((u) => u.username.toLowerCase() === wanted || (u.name || "").toLowerCase() === wanted);
        body.responsible = member ? member.username : String(responsible).trim();
      }
      await api("POST", "/plan", body);
      const prev = existing[0];
      const nameFor = displayNames(users);
      return {
        date, weekday: weekdayOf(date),
        meal: body.meal_name ?? prev?.meal_name ?? null,
        responsible: nameFor(body.responsible ?? prev?.responsible ?? null),
        replaced: prev?.meal_name && meal_name !== undefined && prev.meal_name !== body.meal_name ? prev.meal_name : null,
      };
    },
  },
  {
    name: "search_meals",
    scope: "read",
    description: "Search the household's known dinners by name, ingredient or label. Without a query, returns the most frequently planned ones.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" } },
      additionalProperties: false,
    },
    annotations: { title: "Search meals", readOnlyHint: true },
    async run({ query }, { api }) {
      const meals = await api("GET", "/meals");
      const q = (query || "").trim().toLowerCase();
      const parse = (v) => { try { return JSON.parse(v || "[]"); } catch { return []; } };
      const shaped = meals.map((m) => ({
        name: m.name, ingredients: parse(m.ingredients), labels: parse(m.labels),
        ...(m.recipe_url ? { recipe_url: m.recipe_url } : {}),
        times_planned: m.times_planned || 0, last_planned: m.last_planned || null,
      }));
      const hits = q
        ? shaped.filter((m) => [m.name, ...m.ingredients, ...m.labels].some((s) => String(s).toLowerCase().includes(q)))
        : [...shaped].sort((a, b) => b.times_planned - a.times_planned);
      return { meals: hits.slice(0, 25), total_matches: hits.length };
    },
  },
  {
    name: "find_storage",
    scope: "read",
    description: "Find which storage box something is in. Searches box names, locations, notes and contents; returns matching boxes with their number and location.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", description: "What to look for, e.g. 'christmas lights' or 'garasje'." } },
      required: ["query"],
      additionalProperties: false,
    },
    annotations: { title: "Find in storage", readOnlyHint: true },
    async run({ query }, { api }) {
      const tokens = String(query || "").toLowerCase().split(/\s+/).filter(Boolean);
      if (!tokens.length) throw new ToolError("query is required.");
      const boxes = await api("GET", "/storage/boxes");
      const hits = boxes.filter((b) => {
        const hay = [b.name, b.location, b.notes, ...(b.items || [])].join(" ").toLowerCase();
        return tokens.every((t) => hay.includes(t));
      });
      return {
        boxes: hits.slice(0, 20).map((b) => ({
          number: String(b.number).padStart(3, "0"), name: b.name,
          location: b.location || null, items: b.items || [], ...(b.notes ? { notes: b.notes } : {}),
        })),
        total_matches: hits.length,
      };
    },
  },
  {
    name: "get_box",
    scope: "read",
    description: "Get one storage box by its number (the number on its sticker).",
    inputSchema: {
      type: "object",
      properties: { number: { type: "integer", minimum: 1 } },
      required: ["number"],
      additionalProperties: false,
    },
    annotations: { title: "Get storage box", readOnlyHint: true },
    async run({ number }, { api }) {
      if (!Number.isInteger(number) || number < 1) throw new ToolError("number must be a positive integer.");
      const b = await api("GET", `/storage/boxes/by-number/${number}`);
      return {
        number: String(b.number).padStart(3, "0"), name: b.name, location: b.location || null,
        items: b.items || [], ...(b.notes ? { notes: b.notes } : {}),
      };
    },
  },
];

export const TOOL_NAMES = TOOLS.map((t) => t.name);

function listTools(scopes) {
  return TOOLS.filter((t) => scopes.includes(t.scope))
    .map(({ name, description, inputSchema, annotations }) => ({ name, description, inputSchema, annotations }));
}

async function handleMessage(msg, ctx) {
  if (!msg || typeof msg !== "object" || msg.jsonrpc !== "2.0") return rpcError(msg?.id ?? null, -32600, "Invalid Request");
  const isRequest = typeof msg.method === "string" && msg.id !== undefined && msg.id !== null;
  if (!isRequest) return null; // notifications and client responses: nothing to answer
  const { id, method, params = {} } = msg;
  switch (method) {
    case "initialize": {
      const requested = params.protocolVersion;
      return rpcResult(id, {
        protocolVersion: PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "panhandle", title: "Panhandle", version: ctx.deps.VERSION },
        instructions: SERVER_INSTRUCTIONS,
      });
    }
    case "ping":
      return rpcResult(id, {});
    case "tools/list":
      return rpcResult(id, { tools: listTools(ctx.scopes) });
    case "tools/call": {
      const tool = TOOLS.find((t) => t.name === params.name);
      if (!tool) return rpcError(id, -32602, `Unknown tool: ${params.name}`);
      if (!ctx.scopes.includes(tool.scope)) {
        return rpcResult(id, toolText("This Panhandle connection is read-only. Reconnect it and allow changes to use this tool.", true));
      }
      const args = params.arguments && typeof params.arguments === "object" ? params.arguments : {};
      try {
        return rpcResult(id, toolText(await tool.run(args, ctx)));
      } catch (e) {
        if (e instanceof ToolError) return rpcResult(id, toolText(e.message, true));
        throw e;
      }
    }
    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

// Exported for tests: everything after OAuth has validated the token.
export async function handleMcpRequest(request, { deps, env, origin, props, scopes }) {
  if (request.method !== "POST") {
    return new Response(null, { status: 405, headers: { Allow: "POST" } });
  }
  const version = request.headers.get("MCP-Protocol-Version");
  if (version && !PROTOCOL_VERSIONS.includes(version)) {
    return Response.json(rpcError(null, -32600, `Unsupported protocol version: ${version}`), { status: 400 });
  }
  let body;
  try { body = await request.json(); } catch {
    return Response.json(rpcError(null, -32700, "Parse error"), { status: 400 });
  }
  const ctx = { deps, env, origin, scopes, api: makeApi({ deps, env, origin, props, scopes }) };
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map((m) => handleMessage(m, ctx)))).filter(Boolean);
    return out.length ? Response.json(out) : new Response(null, { status: 202 });
  }
  const out = await handleMessage(body, ctx);
  return out ? Response.json(out) : new Response(null, { status: 202 });
}

// ---------- OAuth wiring ----------
export function createConnector(deps) {
  // One authorization server + resource per origin, so a branch preview's
  // own hostname is a complete, separately-issued connector. Built lazily
  // (constructors validate the URLs) and cached for the isolate's lifetime.
  const servers = new Map();

  async function serversFor(origin) {
    let s = servers.get(origin);
    if (s) return s;
    const { OAuthAuthorizationServer, OAuthResourceServer, insufficientScope } = await loadOAuthLib();
    const resource = origin + MCP_PATH;
    const as = new OAuthAuthorizationServer({
      issuer: origin,
      resources: [resource],
      authorizeEndpoint: AUTHORIZE_PATH,
      tokenEndpoint: "/oauth/token",
      clientRegistrationEndpoint: "/oauth/register",
      scopesSupported: ["read", "write", "offline_access"],
      accessTokenTTL: 3600,
      // Keep foreign clients out of KV: a registration must name at least
      // one Claude callback. /oauth/authorize then holds every request to
      // the exact allowlist (a client may legitimately list extras).
      clientRegistrationCallback: ({ clientMetadata }) => {
        const uris = clientMetadata?.redirect_uris;
        if (!Array.isArray(uris) || !uris.some((u) => typeof u === "string" && isAllowedRedirectUri(u))) {
          return { code: "invalid_redirect_uri", description: "Only Claude can connect to Panhandle." };
        }
      },
    });
    const rs = new OAuthResourceServer({
      resourceMetadata: {
        resource, authorization_servers: [origin],
        resource_name: "Panhandle", bearer_methods_supported: ["header"],
      },
      requiredScopes: ["read"],
      validateToken: (env) => (res, token) => as.validateToken(res, token, env),
      handler: {
        fetch(request, env, ctx) {
          if (!ctx.auth.scope.includes("read")) return insufficientScope(ctx.auth, ["read"]);
          return handleMcpRequest(request, { deps, env, origin, props: ctx.props, scopes: ctx.auth.scope });
        },
      },
    });
    s = { as, rs };
    servers.set(origin, s);
    return s;
  }

  async function authorize(request, env, origin) {
    if (request.method !== "GET") return textResponse(405, "Method not allowed");
    const oauth = (await serversFor(origin)).as.getOAuthApi(env);
    let authRequest;
    try {
      authRequest = await oauth.parseAuthRequest(request);
    } catch (e) {
      if (e instanceof oauthLib.AuthorizationError && e.redirectTo) return Response.redirect(e.redirectTo, 302);
      if (e instanceof oauthLib.AuthorizationError) return textResponse(400, e.description);
      throw e;
    }
    // Never redirect to a URI outside the allowlist — render, don't bounce.
    if (!isAllowedRedirectUri(authRequest.redirectUri)) {
      return textResponse(400, "Only Claude can connect to Panhandle.");
    }
    const details = await oauth.describeConsent(authRequest);
    const consent = await oauth.beginConsent(authRequest);
    await env.OAUTH_KV.put(CONSENT_KEY_PREFIX + consent.handle, JSON.stringify({
      client_name: details.clientName,
      redirect_host: details.redirectHost,
      redirect_is_loopback: details.redirectIsLoopback,
      scope: details.scope,
    }), { expirationTtl: CONSENT_TTL_SECONDS });
    const headers = new Headers(consent.headers);
    headers.set("Location", `/connect?handle=${encodeURIComponent(consent.handle)}`);
    return new Response(null, { status: 302, headers });
  }

  return {
    // The fetch-level entry point: null for anything that isn't a connector
    // request, so index.js falls straight through to route().
    async handle(request, env, ctx) {
      const url = new URL(request.url);
      if (!isConnectorPath(url.pathname) || !isConnectorHost(url.hostname, env.APP_ORIGIN)) return null;
      if (!env.OAUTH_KV) return textResponse(503, "Connecting apps isn't set up yet.");
      if (url.pathname === AUTHORIZE_PATH) return authorize(request, env, url.origin);
      const s = await serversFor(url.origin);
      if (url.pathname === MCP_PATH || url.pathname.startsWith(MCP_PATH + "/")
        || url.pathname.startsWith("/.well-known/oauth-protected-resource")) {
        return s.rs.fetch(request, env, ctx);
      }
      return s.as.fetch(request, env, ctx);
    },

    isAvailable(env, origin) {
      return !!env.OAUTH_KV && isConnectorHost(new URL(origin).hostname, env.APP_ORIGIN);
    },

    async consentDetails(env, handle) {
      const raw = await env.OAUTH_KV.get(CONSENT_KEY_PREFIX + handle);
      return raw ? JSON.parse(raw) : null;
    },

    // null when the handle is missing/expired/used or bound to another
    // browser; otherwise the client redirect plus cookies to send with it.
    async approve(request, env, origin, handle, user, allowWrite) {
      const oauth = (await serversFor(origin)).as.getOAuthApi(env);
      const details = await this.consentDetails(env, handle);
      const requested = details?.scope || [];
      const scope = ["read", ...(allowWrite ? ["write"] : []), ...(requested.includes("offline_access") ? ["offline_access"] : [])];
      let approved;
      try {
        approved = await oauth.approveConsent(request, handle, { scope });
      } catch (e) {
        if (e instanceof oauthLib.AuthorizationError) return null;
        throw e;
      }
      const { redirectTo } = await oauth.completeAuthorization({
        request: approved.request,
        userId: grantUserId(user.username),
        metadata: { client_name: details?.client_name || null, redirect_host: details?.redirect_host || null },
        scope: approved.request.scope,
        props: { username: user.username, tv: user.token_version },
      });
      await env.OAUTH_KV.delete(CONSENT_KEY_PREFIX + handle);
      return { redirectTo, headers: approved.headers };
    },

    async deny(request, env, origin, handle) {
      const oauth = (await serversFor(origin)).as.getOAuthApi(env);
      let denied;
      try {
        denied = await oauth.denyConsent(request, handle);
      } catch (e) {
        if (e instanceof oauthLib.AuthorizationError) return null;
        throw e;
      }
      await env.OAUTH_KV.delete(CONSENT_KEY_PREFIX + handle);
      return { redirectTo: denied.redirectTo, headers: denied.headers };
    },

    async listGrants(env, origin, username) {
      const oauth = (await serversFor(origin)).as.getOAuthApi(env);
      const grants = [];
      let cursor;
      do {
        const page = await oauth.listUserGrants(grantUserId(username), cursor ? { cursor } : undefined);
        grants.push(...page.items);
        cursor = page.cursor;
      } while (cursor);
      return grants.map((g) => ({
        id: g.id,
        client_name: g.metadata?.client_name || null,
        redirect_host: g.metadata?.redirect_host || null,
        scope: g.scope.filter((s) => s === "read" || s === "write"),
        created_at: g.createdAt,
        expires_at: g.expiresAt ?? null,
      }));
    },

    async revokeGrant(env, origin, username, grantId) {
      const oauth = (await serversFor(origin)).as.getOAuthApi(env);
      await oauth.revokeGrant(grantId, grantUserId(username));
    },
  };
}
