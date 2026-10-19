# MCP connector: Panhandle in Claude (claude.ai)

> **Status: plan, nothing built yet.** Written 2026-10-19. The goal is a
> remote MCP server that a household member can add to claude.ai on the web
> (Settings → Connectors → "Add custom connector") so Claude can read and
> write their shopping list, meal plan, and storage boxes, for example
> "add milk and eggs", "what's for dinner on Thursday?" or "which box are
> the Christmas lights in?".

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

Writing all of that by hand would be a large new security surface. This app
deliberately hand-rolls PBKDF2 and JWT, but OAuth 2.1 with DCR, CIMD, PKCE,
refresh rotation and RFC 9728 is far more state machine than those. This
falls under the same reasoning as `@pushforge/builder` (see CLAUDE.md, Push
notifications): **use Cloudflare's `@cloudflare/workers-oauth-provider`**,
which implements all of the above on Workers (DCR, CIMD, RFC 8414/9728,
PKCE, refresh, revocation, encrypted grant props in KV).

## Architecture decision: a separate `panhandle-mcp` Worker

```
claude.ai ──OAuth + MCP──▶ mcp.panhandle.app  (new Worker, mcp/)
                              │  OAUTH_KV (grants, clients, tokens)
                              │  service binding PANHANDLE
                              ▼
                           panhandle Worker (worker/index.js, unchanged API)
                              │
                              ▼
                             D1
```

**Recommended: a new Worker in `mcp/`** with its own `wrangler.toml` and
`package.json`, on the custom domain `mcp.panhandle.app`. It talks to the
existing Worker **only** through a service binding, calling the same
`/api/*` routes the app uses. Reasons:

- `worker/index.js` stays one file without dependencies. Wrapping it in
  `OAuthProvider` would make OAuth, KV and the MCP SDK part of every
  request the app makes, and `OAuthProvider` only wraps `fetch`, not
  `scheduled()` (the cron).
- **All existing validation applies automatically**: `list_id` scoping,
  `TEXT_LIMITS`, the identical-item merge in `POST /list`, error codes. The
  MCP layer contains no business logic and no SQL. It never gets a D1
  binding.
- A bug in the MCP Worker can't break the app, and the reverse holds too.
  The two deploy separately, and the MCP Worker can be switched off in the
  dashboard without touching the app.
- The cost is a second Workers Builds project (root directory `mcp/`) and
  one extra hop per tool call. The service binding keeps that hop
  in-process with no public network round trip.

The rejected alternative was a `/mcp` route inside the existing Worker. It
saves one deploy target, but costs everything listed above.

### How the MCP Worker acts as a user

The grant created at consent stores the props
`{ username, tv }` (`tv` = `users.token_version` at consent time),
encrypted in KV by the library. For each tool call the MCP Worker:

1. mints a **short-lived connector JWT**: `sub=username`, `tv`,
   `aud: "mcp"`, `scp: ["read"] | ["read","write"]`, `exp = now + 5 min`.
   It is signed with the shared `JWT_SECRET`, set as a secret on the MCP
   Worker too.
2. calls `env.PANHANDLE.fetch("https://internal/api/list", { headers: { Authorization: "Bearer …" } })`.

The main Worker's `requireAuth` already checks `tv` against the DB. That
gives the connector **automatic revocation on password change or flag
change**, the same as every other device. A rename via `/change-email`
changes `sub`, so the grant stops working and the user reconnects. That is
acceptable and documented on the settings page.

### Main-Worker changes: what a connector token is allowed to do

A plain `Bearer` with `JWT_SECRET` would give full account access, including
`DELETE /account`, admin routes and invites. Defence in depth means the
**main Worker** itself, not just the MCP Worker, limits what an
`aud: "mcp"` token can do:

- `requireAuth` returns the token kind (`"session"` | `"connector"`) and
  scopes as well as the user row. A connector token with `exp` more than
  10 minutes ahead is rejected outright, so a leaked one dies quickly.
- `route()`: after the auth gate, if the token is a connector token, match
  against a separate `CONNECTOR_ROUTES` allowlist (method + path/pattern,
  same shape as `AUTHENTICATED_ROUTES`). `GET` requires `read`, and every
  other method requires `write`. Anything else answers `403 FORBIDDEN`, or
  a new code such as `CONNECTOR_NOT_ALLOWED` added to
  `shared/errorCodes.js` with a Norwegian entry in `nb.js`, following the
  usual recipe.
- **Never send `X-Refresh-Token` on a connector request.** `authedJson`
  currently always mints a fresh *90-day session token*. For a connector
  token that would hand the MCP Worker a full-access, long-lived session
  token in every response. This is the single most important detail on the
  main-Worker side.
- `tests/worker-unit.test.mjs`: pin `CONNECTOR_ROUTES` the way the
  `auth boundary` block already pins `PUBLIC_ROUTES`, so adding a route is
  a deliberate test edit. Add an integration test,
  `tests/connector-token.test.mjs`: a connector token can `GET /list`,
  can't call `DELETE /account` or `GET /admin/users`, a read-scoped token
  can't `POST /list`, no `X-Refresh-Token` comes back, and a `tv` mismatch
  gives `401`.

**No D1 migration is needed.** Grants, clients and tokens live in
`OAUTH_KV`, and the main Worker stores nothing new.

## Consent flow (reuses the app's existing login)

The consent page lives **in the app**, not in the MCP Worker. The user is
usually already signed in on shop.panhandle.app. That means no new login
UI, Google sign-in works with no new OAuth origin, and Turnstile and the
rate limits stay where they are.

1. Claude sends the user to `https://mcp.panhandle.app/authorize?...`.
2. The MCP Worker runs `env.OAUTH_PROVIDER.parseAuthRequest(request)` and
   looks up the client (name and redirect URI). It **rejects** a redirect
   URI outside the allowlist (see Security below). It stores the parsed
   request in KV under a random `req_id` (TTL 10 min, single-use) and
   redirects to `https://shop.panhandle.app/connect?req=<req_id>`.
3. The app (a new route `/connect`) shows `ConnectScreen`. If the user is
   signed out, it shows login first and resumes afterwards, the same
   pattern as `pendingBoxNumber` for `/b/{n}`. The main Worker's ROUTING
   section must serve `/connect` as the app shell, like `/b/{number}`.
   The screen shows:
   - "**Claude** wants access to the household *<list name>*" plus the
     redirect hostname (`claude.ai`), as the spec requires.
   - The scopes: "Read the list, meal plan and storage" (always) and
     "Add, check off and plan" (a checkbox, on by default).
   - Allow and Deny buttons.
4. Allow → `POST https://mcp.panhandle.app/connect/complete` with
   `Authorization: Bearer <the app's normal session token>` and
   `{ req_id, scopes }`. The MCP Worker validates the session token by
   calling `GET /api/account` through the service binding. That avoids a
   second JWT verification implementation and also checks `tv`. It then
   runs `completeAuthorization({ request, userId: username, scope, props: { username, tv } })`
   and returns `{ redirectTo }`. The app sets `location = redirectTo`, and
   Claude completes the token exchange on its own.
   Deny → the MCP Worker redirects back with `error=access_denied`.
5. CORS on `/connect/complete` and `/connections`: only
   `Origin: https://shop.panhandle.app`, plus branch-preview hostnames
   while testing. Add `https://mcp.panhandle.app` to `connect-src` in
   `withSecurityHeaders`' CSP. It is report-only today, but it must be
   correct before it is enforced, and the CSP test should include the
   origin.

The approval POST carries the Bearer token from `localStorage`, not a
cookie, so it has no CSRF exposure. Clickjacking is already covered by
`X-Frame-Options: DENY`.

## Tools (v1)

The tools form a deliberately narrow surface: everyday use, nothing
administrative. Each one maps onto existing endpoints. The tool
descriptions are in English, since the model reads them. The output
returns **both** the canonical name and the Norwegian display name
(`translateItemName`) so Claude can answer in the user's language.

| Tool | Scope | Endpoint(s) | Annotations |
|---|---|---|---|
| `get_shopping_list` | read | `GET /list` (unbought by default; `include_bought` optional, last 20) | readOnly |
| `add_items(items: [{name, qty?, notes?}])` | write | `GET /catalogue` once, then `POST /list` per item | — |
| `check_off_items(ids[])` | write | `POST /list/{id}/toggle` (only if currently unbought, so it never toggles back) | idempotent |
| `mark_important(id, important)` | write | `PATCH /list/{id}` | idempotent |
| `get_meal_plan(from?, to?)` | read | `GET /plan` + `GET /list-users` (names) | readOnly |
| `plan_meal(date, meal_name?, responsible?)` | write | `POST /plan` | destructive (overwrites the day) |
| `search_meals(query?)` | read | `GET /meals` / `GET /meals/suggestions` | readOnly |
| `find_storage(query)` | read | `GET /storage/boxes`, search done in the MCP layer | readOnly |
| `get_box(number)` | read | `GET /storage/boxes/by-number/{n}` | readOnly |

Deliberately left **out of v1**: deleting items or meals, `mark-all-bought`,
editing the catalogue, creating or editing storage boxes, `push/ping`,
everything under account/admin/invite/calendar feed. Add them later if
there's a real need. `mark-all-bought` and deletions are exactly the sort
of thing an LLM gets wrong at the worst moment.

### Details that need care

- **Item names are canonical and in English.** "Add milk" said in
  Norwegian (*melk*) must resolve to the catalogue's `Milk`, or the
  catalogue fills with Norwegian duplicates. `add_items` fetches
  `GET /catalogue` and runs **the same** `matchCatalogue(name, catalogue, "nb")`
  as the app, imported directly from `src/lib/shoppingUtils.js`. That file
  is pure and imports only `shared/categories.js` and `i18n/itemNames.js`,
  so the MCP Worker's bundler can take it as is and no copy can drift. Use
  the hit at rank 0/1 (exact or whole word). Otherwise send the name as
  typed and let `POST /list` create a custom entry under `Other`, exactly
  as the app does. Return what it was matched to, for example
  "melk → Milk (Dairy)", so Claude can tell the user.
- **Dates.** The model doesn't know what "today" is in Oslo. Every
  meal-plan response includes `today` (Europe/Oslo, computed the same way
  as `osloLocalDateParts`) and the weekday. `plan_meal` rejects a date
  outside the window the app shows (`WEEK_MIN..WEEK_MAX`, -1..+4 weeks).
  Older rows are deleted by `GET /plan` anyway.
- **Overwrites.** `POST /plan` replaces the day. `plan_meal` returns what
  was there before (`replaced: "Taco"`), and the tool description tells
  Claude to ask first if the day is already planned.
- **`responsible`.** Accept a display name or username and resolve it
  through `GET /list-users`. Pass unknown text through as free text, as the
  app does.
- **Errors.** Map the main Worker's `{ error, code }` to a tool result with
  `isError: true` and the English message (from `shared/errorCodes.js`), so
  Claude can explain what went wrong. Don't throw a protocol error.
- **Response size.** Keep it short: id, name, Norwegian name, qty, notes,
  important, added_by display name. Don't send all 700+ catalogue entries
  back to the model.

### Transport

Stateless Streamable HTTP is enough, since no tool needs session state. Use
`createMcpHandler` from the `agents` package (or the MCP SDK directly)
**without** a Durable Object. Choose `McpAgent` (a Durable Object) only if
something stateful is ever needed. Verify the exact API against the
current `agents` and `workers-oauth-provider` READMEs at implementation
time, since they move fast.

## Security (summary)

- **Redirect-URI allowlist** during DCR and CIMD registration and in
  `/authorize`: `https://claude.ai/api/mcp/auth_callback`,
  `https://claude.com/api/mcp/auth_callback`, and loopback
  `http://localhost|127.0.0.1:<any>/callback` for Claude Code. That means
  no random third-party app can phish household members through an honest
  Panhandle consent screen. Opening it up to "similar" clients (ChatGPT
  and others) later means adding their callback to the list, a deliberate
  edit.
- **Token lifetimes:** access token 1 hour, refresh token 30 days with
  rotation (required for public clients). The connector JWT to the main
  Worker lives 5 min.
- **Revocation:**
  - Settings → "Connected apps" (`/connections`) lists and revokes grants.
  - A password change bumps `tv`, so every grant dies on the next call.
  - `DELETE /account` means the user no longer exists, so the grant dies.
  - KV is eventually consistent, so a revoke can take up to about 60 s to
    take effect. That is acceptable for this kind of data.
- **Scopes in two layers:** the MCP Worker hides write tools for read-only
  grants, *and* the main Worker refuses write methods for a read-only
  connector token.
- `JWT_SECRET` now lives on two Workers. The secret's trust level is
  unchanged (the same operator), but rotating it means updating both, and
  the runbook must say so.
- Rate limiting: not needed in v1. Every call is already authenticated and
  scoped to the user's own list. Consider a per-grant cap if abuse ever
  shows up.

## Implementation phases

Each phase is its own PR. Phase 1 can be merged and deployed alone with no
visible change.

### Phase 0: preparation (dashboard, no code)
- Confirm that the claude.ai plan in use allows custom connectors.
- Create the KV namespace `panhandle-mcp-oauth`.
- Create a Workers Builds project for `panhandle-mcp` (root directory
  `mcp/`, deploy command `npx wrangler deploy`, tracks `main`).
- Attach the custom domain `mcp.panhandle.app` to the new Worker.
- Set the secret `JWT_SECRET` (the same value) on the new Worker.

### Phase 1: connector tokens in the main Worker (PATCH)
- `requireAuth` → token kind and scopes; `CONNECTOR_ROUTES`; scope check;
  no `X-Refresh-Token` for connectors; max-`exp` guard.
- A new error code if needed (`shared/errorCodes.js` + `nb.js`).
- Unit tests (allowlist pinning) and `tests/connector-token.test.mjs`.
- CLAUDE.md, Auth model: describe connector tokens.
- Version bump PATCH and a changelog line ("Groundwork for connecting
  Panhandle to AI assistants.").

### Phase 2: the MCP Worker skeleton plus OAuth (no consent UI yet)
- `mcp/wrangler.toml`: `OAUTH_KV`, `[[services]] binding = "PANHANDLE", service = "panhandle"`,
  `compatibility_flags = ["global_fetch_strictly_public"]` (required for
  CIMD).
- `mcp/package.json`: `@cloudflare/workers-oauth-provider`, `agents`
  and/or `@modelcontextprotocol/sdk`, `zod`. Pin exact versions.
- `mcp/src/index.js`: `OAuthProvider` with `apiRoute: "/mcp"`,
  `scopesSupported: ["read", "write", "offline_access"]`, the
  `resourceMetadata` `resource` set to `https://mcp.panhandle.app/mcp`,
  `clientIdMetadataDocumentEnabled: true`, the redirect allowlist, and the
  `/authorize` → `/connect` redirect.
- One tool (`get_shopping_list`) to prove the whole chain end to end.
- Verify with MCP Inspector against the Worker's workers.dev or preview
  URL. Note that `resource` must match the URL being tested, so make it
  env-driven (`MCP_ORIGIN` in `[vars]`).
- CI: a new job in `ci.yml` that runs `npm ci && npm test` in `mcp/`.

### Phase 3: consent in the app (MINOR, the feature becomes visible)
- `/connect` served as the app shell (main-Worker ROUTING); `ConnectScreen`
  with resume after login; `nb`/`en` dictionary keys (the dictionary test
  fails on drift); haptics are irrelevant here.
- CSP `connect-src` += `https://mcp.panhandle.app`, plus the CSP test.
- Test the real flow in claude.ai: Settings → Connectors → Add custom
  connector → `https://mcp.panhandle.app/mcp`.

### Phase 4: the full v1 tool set
- The rest of the tool table, with `matchCatalogue` reuse, `today`, and
  overwrite warnings.
- Unit tests for the tool logic against a fake `PANHANDLE` binding (same
  pattern as the fake `env.DB` stub in `tests/push-notifications.test.mjs`):
  name resolution, rank selection, error mapping, scope hiding.

### Phase 5: "Connected apps" in Settings (PATCH)
- A new subpage (`settingsNav.js` + `SettingsRoot`/`SettingsTab`, following
  the existing pattern), `GET`/`DELETE https://mcp.panhandle.app/connections`
  (lists and revokes the caller's own grants, authenticated with the
  session token the same way as `/connect/complete`).
- CLAUDE.md: a new "MCP connector" section; mark this document as shipped.

## Open questions

1. **Read-only first?** v1 could launch with only the read scope and gain
   writes in phase 4 once read access feels safe. That is cheap to do,
   since scopes are in place from phase 1.
2. **Other clients ("or similar").** ChatGPT and others support remote MCP
   with OAuth too. Adding them is mainly a matter of allowlisting their
   callback, but each one should be tested separately. Not part of v1.
3. **Testing on branch previews:** the MCP Worker's previews get their own
   hostnames and the service binding points at the *production* Worker
   (and so the production DB, as usual). Test with throwaway accounts and
   clean them up afterwards (see CLAUDE.md, Testing conventions).
