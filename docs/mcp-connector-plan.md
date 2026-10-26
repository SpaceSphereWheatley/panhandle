# MCP connector: Panhandle in Claude (claude.ai)

> **Status:** built in 1.66.0, in the existing Worker: connector tokens,
> OAuth, the MCP endpoint, the consent screen and "Connected apps".
> Rewritten 2026-10-19, after the first draft's separate-Worker design was
> dropped (see "Why one Worker").
> Decisions: v1 has **both read and write** scopes, and **only Claude** may
> connect.

The goal is a remote MCP server that a household member adds to claude.ai
(Settings → Connectors → "Add custom connector", URL
`https://shop.panhandle.app/mcp`) so Claude can read and write their
shopping list, meal plan and storage boxes: "add milk and eggs", "what's
for dinner on Thursday?", "which box are the Christmas lights in?".

## Why it has to be a remote server with OAuth

claude.ai on the web only talks to **remote** MCP servers over Streamable
HTTP. A local stdio server, the simplest option, works only in Claude
Desktop and Claude Code. A remote server has three ways to authenticate:
OAuth 2.0, a static header (beta, limited to some organizations, and an
*organization's* key rather than a person's), or none. Panhandle data is
per-user and per-household, so **OAuth is the only real option**.

Claude's OAuth client imposes these concrete requirements. Source:
claude.com/docs/connectors/building/authentication, checked 2026-10-19.

- **Discovery.** An unauthenticated MCP request must answer `401` with
  `WWW-Authenticate: Bearer resource_metadata="…/.well-known/oauth-protected-resource"`
  (RFC 9728). The metadata's `resource` must equal the MCP URL exactly as
  the user types it. Claude uses only the **first** entry in
  `authorization_servers`. The authorization server serves RFC 8414
  metadata.
- **Client identity.** Claude either registers itself through DCR (RFC
  7591, `registration_endpoint`) or uses a Client ID Metadata Document
  (CIMD). Claude uses CIMD only if the metadata advertises both
  `client_id_metadata_document_supported: true` and `"none"` in
  `token_endpoint_auth_methods_supported`. Both are public clients.
- **PKCE S256 is always sent.** Advertise
  `code_challenge_methods_supported: ["S256"]`.
- **Callbacks.** claude.ai, Desktop and mobile use
  `https://claude.ai/api/mcp/auth_callback`, which may move to
  `https://claude.com/api/mcp/auth_callback`, so accept both. Claude Code
  uses a loopback redirect, `http://localhost:<any>/callback` or
  `http://127.0.0.1:<any>/callback`, which must be matched port-agnostically.
- **Token endpoint.** It accepts `application/x-www-form-urlencoded`. A
  dead refresh token answers `invalid_grant`. Refresh tokens for public
  clients **must rotate**. Claude refreshes on a `401` and up to 5 minutes
  before expiry.
- **Latency.** Discovery, registration and token calls must finish in under
  10 s, and refresh calls in under 30 s.
- **Scopes.** Claude requests the scopes in the `401`'s `scope` parameter,
  or else `scopes_supported` from the protected-resource metadata. It adds
  `offline_access` if the authorization server lists it.
- **Consent screen.** It must show the redirect URI's hostname clearly
  (MCP spec requirement).
- **Network.** Anthropic's traffic comes from `160.79.104.0/21`. That
  matters only if a WAF rule ever sits in front.


Writing the OAuth half by hand would be a large new security surface. This
app deliberately hand-rolls PBKDF2 and JWT, but OAuth 2.1 with DCR, PKCE,
refresh rotation and RFC 9728 is far more state machine than those. It falls
under the same reasoning as `@pushforge/builder` (see CLAUDE.md, Push
notifications): **use Cloudflare's `@cloudflare/workers-oauth-provider`**
(pinned exactly, no runtime dependencies of its own). The MCP half is the
opposite case: for ten stateless tools it is a small JSON-RPC dispatcher,
so it is hand-rolled rather than pulling in the MCP SDK and `zod`.

## Why one Worker

The first draft put the connector in a separate `panhandle-mcp` Worker on
`mcp.panhandle.app`, reaching the API over a service binding. Inside the
existing Worker it is simpler on every axis that matters here:

- **No new deploy target.** No second Workers Builds project, custom
  domain or set of secrets to keep in step. The one dashboard step is
  creating a KV namespace.
- **No shared secret.** A second Worker would need `JWT_SECRET` (which the
  dashboard can't reveal once set) or a new key of its own.
- **Same origin.** The consent screen, its API calls and the OAuth endpoints
  all live on `shop.panhandle.app`: no CORS, no CSP change, and the
  library's browser-bound consent cookie just works.

The two costs, and how they're contained:

- **A dependency in the Worker.** The OAuth library is only ever reached
  through `worker/mcp.js`, and only for the connector's own paths (below).
  Every other request goes straight to `route()` exactly as before, so a
  bug in the library can't touch the app. The cron handler is untouched.
- **A second worker file.** CLAUDE.md keeps `worker/index.js` as one file on
  purpose; `worker/mcp.js` is a separate concern (a protocol adapter with
  no SQL and no business logic) with a one-way dependency: `index.js`
  imports it and hands it what it needs (`route`, `signJwt`, the Oslo date
  helpers), so it never imports `index.js` back.

## Architecture

```
claude.ai ──▶ shop.panhandle.app ── fetch() ─┬─ /mcp, /oauth/*, /.well-known/oauth-* ─▶ worker/mcp.js
                                             │        (OAuth library + JSON-RPC tools; OAUTH_KV)
                                             │               │ connector JWT, in-process
                                             │               ▼
                                             └─ everything else ─────────────────────▶ route()  ──▶ D1
```

- **Connector paths**, handled by `worker/mcp.js` before `route()`:
  - `/mcp`: the MCP endpoint (the protected resource).
  - `/.well-known/oauth-protected-resource/mcp` and
    `/.well-known/oauth-authorization-server`: discovery (RFC 9728/8414).
  - `/oauth/token`, `/oauth/register`: token, refresh and revocation, and
    DCR. Served by the library.
  - `/oauth/authorize`: ours. It validates the request and hands the user
    to the app's consent screen (below).
  None of these collide with anything today: they fall through to the
  Pages proxy and 404.
- **Hosts.** The connector answers only on `APP_ORIGIN`'s host
  (`shop.panhandle.app`), on the Worker's own `*.workers.dev` preview
  hostnames, and on loopback for `wrangler dev`. Each origin gets its own
  issuer/resource pair (`<origin>` and `<origin>/mcp`), so a branch preview
  is a fully working connector for testing. `panhandle.app` and the legacy
  `shopping.mohibb.com` keep their redirects.
- **KV.** The library stores clients, grants and tokens in a KV namespace
  bound as `OAUTH_KV`. The binding in `wrangler.toml` has no `id`, so
  wrangler provisions the namespace on the first deploy. Until it exists,
  every connector path answers `503` and nothing else in the app is
  affected.
- **Client registration.** DCR only, which Claude supports. CIMD is left
  off: it needs the `global_fetch_strictly_public` compatibility flag, which
  changes how *every* outbound `fetch` from this Worker resolves (the Pages
  proxy, recipe import, Resend, Google), a risk not worth taking for a
  client that registers fine without it.

### How a tool call reaches the data

The grant created at consent stores the props `{ username, tv }` (`tv` =
`users.token_version` at consent time), encrypted in KV by the library. For
each tool call `worker/mcp.js`:

1. mints a **connector JWT**: `sub=username`, `tv`,
   `aud: "mcp"`, `scp` = the grant's scopes, `exp = now + 5 min`, signed
   with `JWT_SECRET` in-process.
2. calls `route()` with an ordinary `Request` for the matching `/api/*`
   route, exactly as the app would.

So every existing check applies unchanged (`list_id` scoping,
`TEXT_LIMITS`, the identical-item merge, error codes), and phase 1's
enforcement sits underneath as a second layer: even a bug in a tool can only
reach `CONNECTOR_ROUTES`, writes need the `write` scope, and no response
carries a refresh token. `requireAuth` checks `tv`, so **a password change
cuts the connector off** on its next call. A rename via `/change-email`
changes `sub`, so the grant stops working too and the user reconnects.

## Consent flow (reuses the app's existing login)

1. Claude opens `/oauth/authorize?...`. `worker/mcp.js` runs
   `parseAuthRequest()`, then **refuses any redirect URI outside the
   allowlist** (Security, below). It calls `describeConsent()` and
   `beginConsent()`, stores the description in `OAUTH_KV` under the consent
   handle (10 minutes, the same lifetime as the handle), and redirects to
   `/connect?handle=…`, carrying `beginConsent()`'s headers. Those set the
   `__Host-` cookie that binds the handle to this browser.
2. `/connect` is served as the app shell (like `/b/{number}`). If the user
   is signed out, the app shows login first and resumes afterwards (the
   handle is kept in `sessionStorage`). `ConnectScreen` loads
   `GET /api/oauth-consent/{handle}` and shows:
   - the client's name, marked as unverified (a DCR name is
     self-asserted);
   - the household, and the redirect hostname (`claude.ai`), which the
     spec requires, with a warning for a loopback redirect (Claude Code);
   - the scopes: reading is always included, and "add, check off and plan"
     is a checkbox, on by default;
   - Allow and Deny buttons.
3. **Allow** → `POST /api/oauth-consent/{handle}/approve { write }` with the
   normal session token. The Worker runs `approveConsent()`, which checks
   the browser cookie and works once, then `completeAuthorization()` with
   `userId = username`, and returns `{ redirectTo }`. The app sets
   `location` to it and Claude finishes the token exchange itself.
   **Deny** → `POST …/deny` → `denyConsent()` → `{ redirectTo }`, which
   carries `access_denied`.

These consent routes are ordinary authenticated routes, deliberately
**not** in `CONNECTOR_ROUTES`: a connector can never approve its own
consent. React escapes every client-supplied string it renders.

## Tools (v1)

The tools are a narrow surface: everyday use, nothing administrative. Write
tools are hidden from `tools/list` and refused by `tools/call` without the
`write` scope, and phase 1's gate enforces the same thing again underneath.
Descriptions are in English, since the model reads them; results include
the Norwegian display name of each item next to its canonical one.

| Tool | Scope | Endpoint(s) |
|---|---|---|
| `get_shopping_list(include_bought?)` | read | `GET /list` |
| `add_items(items: [{name, qty?, notes?}])` | write | `GET /catalogue` once, `POST /list` per item |
| `check_off_items(ids[])` | write | `GET /list`, then `POST /list/{id}/toggle` for each id still unbought (never toggles back) |
| `set_item_important(id, important)` | write | `PATCH /list/{id}` |
| `get_meal_plan(from?, to?)` | read | `GET /plan` + `GET /list-users` |
| `plan_meal(date, meal_name?, responsible?)` | write | `GET /plan`, `POST /plan` |
| `search_meals(query?)` | read | `GET /meals` |
| `update_meal(id \| name, new_name?, ingredients?, labels? \| add_labels?/remove_labels?, recipe_url?)` | write | `GET /meals`, `PATCH /meals/{id}`, `GET /meals` (added in 1.67.0) |
| `find_storage(query)` | read | `GET /storage/boxes`, searched in the MCP layer |
| `get_box(number)` | read | `GET /storage/boxes/by-number/{n}` |

Deliberately left **out**: deleting anything, `mark-all-bought`, item
catalogue edits, creating meals outside `plan_meal`, creating or editing boxes, `push/ping`, and everything
account-, admin-, invite- or calendar-feed-related.

### Details that need care

- **Item names are canonical and in English.** "Add milk" said in
  Norwegian (*melk*) must resolve to the catalogue's `Milk`, or the
  catalogue fills with Norwegian duplicates. `add_items` runs **the same**
  `matchCatalogue(name, catalogue, "nb")` as the app, imported from
  `src/lib/shoppingUtils.js` (pure; it imports only `shared/` and
  `i18n/itemNames.js`), and uses its best hit when it is an exact or
  whole-word match. Otherwise the name goes through as typed, exactly as
  in the app. The result says what each name was matched to.
- **Dates.** The model doesn't know what "today" is in Oslo. Meal-plan
  results carry `today` (Europe/Oslo, via `osloLocalDateParts`) and
  weekday names. `plan_meal` refuses dates outside the window the app
  shows (from the start of last week through the end of the week four
  weeks ahead, `WEEK_MIN..WEEK_MAX`).
- **Overwrites.** `POST /plan` replaces the day. `plan_meal` returns what
  was there before, and its description tells Claude to ask before
  overwriting a planned day.
- **`responsible`.** Accepts a display name or a username, resolved through
  `GET /list-users`. Unknown text goes through as free text, as in the app.
- **Errors.** An API error becomes a tool result with `isError: true` and
  the error's English message (from `shared/errorCodes.js`), not a protocol
  error, so Claude can explain it. A `401` from the inner call (password
  changed) says to reconnect the connector.

### Protocol

The endpoint behaves as a **stateless MCP 2025-11-25 server** over
Streamable HTTP:
- `POST` only, with JSON responses (no SSE, no `Mcp-Session-Id`). `GET`
  answers `405`.
- `initialize` echoes a known `protocolVersion` (2025-11-25, 2025-06-18,
  2025-03-26) or offers 2025-11-25. `ping`, `tools/list`, `tools/call`;
  notifications get `202`.
- A request whose `MCP-Protocol-Version` header names a version we don't
  serve gets `400`, the 2025 behaviour that MCP 2026-07-28 clients fall
  back from. Moving to the session-less 2026-07-28 revision
  (`server/discover`, per-request `_meta`) is a later, separate change.

## Security (summary)

- **Redirect-URI allowlist, so only Claude can connect:**
  `https://claude.ai/api/mcp/auth_callback`,
  `https://claude.com/api/mcp/auth_callback`, and loopback
  `http://localhost|127.0.0.1:<any>/callback` (Claude Code). It is applied in
  `/oauth/authorize` (a refused request renders an error and never
  redirects) and at registration (`clientRegistrationCallback`, so foreign
  clients don't pile up in KV). Adding another client later is a deliberate
  edit to this list.
- **Lifetimes:** OAuth access tokens last 1 hour; refresh tokens last 30
  days and rotate on use (library defaults). The connector JWT that a tool
  call carries internally lasts 5 minutes.
- **Revocation:** Settings → "Connected apps" lists and revokes grants
  (`listUserGrants`/`revokeGrant`). A password change kills every grant in
  practice through `tv`. After `DELETE /account` the user no longer exists,
  so the grant is dead too; its KV leftovers expire with their TTLs.
- **Scopes in three layers:** the consent screen grants them, the MCP layer
  hides and refuses write tools, and the phase-1 gate refuses write methods.
- **Rate limiting:** none in v1. Every call is authenticated and scoped to
  the caller's own list.

## Implementation status

- **Done (1.66.0):** connector tokens (`connectorClaims`,
  `CONNECTOR_ROUTES`, the scope gate, no `X-Refresh-Token` for connectors;
  the constants live on one exported `CONNECTOR_TOKEN` object because
  workerd refuses to start when the entry module exports a bare string or
  number); `worker/mcp.js` with the OAuth wiring, `/oauth/authorize`, the
  JSON-RPC handler and the tools (the OAuth library is loaded lazily, since
  it imports `cloudflare:workers`, which plain Node can't resolve and Node is
  where `tests/worker-unit.test.mjs` imports the Worker); the consent and
  connected-apps routes; `/connect` served as the app shell;
  `ConnectScreen` and the "Connected apps" subpage. Tests:
  `tests/worker-unit.test.mjs` (allowlist, hosts/paths, name resolution,
  plan window, JSON-RPC and tools against a fake `route()`),
  `tests/connector-token.test.mjs` and `tests/mcp-connector.test.mjs`. The
  latter runs the whole flow under wrangler dev: registration, authorize,
  consent, token, tools, refresh, read-only, revoke, password change.
- **Before relying on it:** confirm that "Add custom connector" exists on the
  claude.ai plan in use, then connect from claude.ai once against the branch
  preview's `*.workers.dev` URL plus `/mcp`, and once against production
  after merge.
- **Later, if needed:** MCP 2026-07-28 (session-less, `server/discover`);
  more tools; CIMD.

## Open questions

1. **Branch previews share the production DB and KV.** Test with throwaway
   accounts and clean them up afterwards (see CLAUDE.md, Testing
   conventions). Revoke test grants under "Connected apps".
