// Plain-Node integration test for the claude.ai connector (worker/mcp.js,
// docs/mcp-connector-plan.md), end to end against the real Worker under
// wrangler dev: discovery, dynamic client registration (and its Claude-only
// allowlist), /oauth/authorize -> /connect consent -> approve, the token
// exchange with PKCE, refresh, the MCP JSON-RPC tools against real data,
// read-only grants, the connected-apps list/revoke, and password-change
// revocation.
//
// Run: node tests/mcp-connector.test.mjs
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { startWorker, seedAndLogin } from "./_helpers.mjs";

const PORT = 8813;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const RUN_ID = Date.now().toString(36);
const PASS = "Test-password-123!";
const CLAUDE_CALLBACK = "https://claude.ai/api/mcp/auth_callback";

async function main() {
  const worker = await startWorker({ port: PORT });
  try {
    await runTests(worker.base);
    console.log("\nAll mcp-connector tests passed.");
  } finally {
    await worker.teardown();
  }
}

const b64url = (buf) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function register(redirectUris) {
  return fetch(`${ORIGIN}/oauth/register`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "Claude", redirect_uris: redirectUris,
      grant_types: ["authorization_code", "refresh_token"], response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
  });
}

// Runs one full authorization: authorize -> consent screen data -> approve ->
// token exchange. Returns the token response.
async function connect(BASE, auth, clientId, { write = true } = {}) {
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  const authorizeUrl = new URL(`${ORIGIN}/oauth/authorize`);
  for (const [k, v] of Object.entries({
    response_type: "code", client_id: clientId, redirect_uri: CLAUDE_CALLBACK,
    code_challenge: challenge, code_challenge_method: "S256", state: "st-" + RUN_ID,
    scope: "read offline_access", resource: `${ORIGIN}/mcp`,
  })) authorizeUrl.searchParams.set(k, v);

  const authz = await fetch(authorizeUrl, { redirect: "manual" });
  assert.equal(authz.status, 302, `authorize: ${await authz.clone().text()}`);
  const location = new URL(authz.headers.get("Location"), ORIGIN);
  assert.equal(location.pathname, "/connect");
  const handle = location.searchParams.get("handle");
  assert.ok(handle);
  const cookie = authz.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  assert.ok(cookie, "beginConsent should bind the handle with a cookie");

  const details = await fetch(`${BASE}/oauth-consent/${encodeURIComponent(handle)}`, { headers: auth });
  assert.equal(details.status, 200);
  const d = await details.json();
  assert.equal(d.redirect_host, "claude.ai");
  assert.equal(d.client_name, "Claude");

  const approve = await fetch(`${BASE}/oauth-consent/${encodeURIComponent(handle)}/approve`, {
    method: "POST", headers: { ...auth, Cookie: cookie }, body: JSON.stringify({ write }),
  });
  assert.equal(approve.status, 200, `approve: ${await approve.clone().text()}`);
  const { redirectTo } = await approve.json();
  const back = new URL(redirectTo);
  assert.equal(`${back.origin}${back.pathname}`, CLAUDE_CALLBACK);
  assert.equal(back.searchParams.get("state"), "st-" + RUN_ID);
  const code = back.searchParams.get("code");
  assert.ok(code);

  const token = await fetch(`${ORIGIN}/oauth/token`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code", code, redirect_uri: CLAUDE_CALLBACK,
      client_id: clientId, code_verifier: verifier, resource: `${ORIGIN}/mcp`,
    }),
  });
  assert.equal(token.status, 200, `token: ${await token.clone().text()}`);
  return token.json();
}

let rpcId = 0;
async function rpc(accessToken, method, params) {
  const res = await fetch(`${ORIGIN}/mcp`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
  });
  return { status: res.status, body: res.status === 200 ? await res.json() : await res.text() };
}

async function callTool(accessToken, name, args = {}) {
  const { status, body } = await rpc(accessToken, "tools/call", { name, arguments: args });
  assert.equal(status, 200, `${name}: ${JSON.stringify(body)}`);
  const result = body.result;
  return { isError: !!result.isError, data: result.structuredContent, text: result.content[0].text };
}

async function runTests(BASE) {
  // Discovery: an unauthenticated /mcp call is a 401 pointing at metadata.
  const unauth = await fetch(`${ORIGIN}/mcp`, { method: "POST", body: "{}" });
  assert.equal(unauth.status, 401);
  assert.match(unauth.headers.get("WWW-Authenticate") || "", /resource_metadata=/);
  const prm = await (await fetch(`${ORIGIN}/.well-known/oauth-protected-resource/mcp`)).json();
  assert.equal(prm.resource, `${ORIGIN}/mcp`);
  assert.deepEqual(prm.authorization_servers, [ORIGIN]);
  const asm = await (await fetch(`${ORIGIN}/.well-known/oauth-authorization-server`)).json();
  assert.equal(asm.authorization_endpoint, `${ORIGIN}/oauth/authorize`);
  assert.ok(asm.registration_endpoint);
  assert.deepEqual(asm.code_challenge_methods_supported, ["S256"]);
  console.log("  ✓ discovery");

  // Only Claude's callbacks may register.
  const foreign = await register(["https://evil.example/callback"]);
  assert.equal(foreign.status, 400);
  const reg = await register([CLAUDE_CALLBACK]);
  assert.equal(reg.status, 201, `register: ${await reg.clone().text()}`);
  const { client_id: clientId } = await reg.json();
  console.log("  ✓ registration allowlist");

  const { token, auth } = await seedAndLogin(BASE, `mcp_${RUN_ID}@example.com`, PASS);
  const tokens = await connect(BASE, auth, clientId);
  assert.ok(tokens.access_token);
  assert.ok(tokens.refresh_token);
  assert.deepEqual(tokens.scope.split(" ").sort(), ["offline_access", "read", "write"]);
  console.log("  ✓ authorize -> consent -> token");

  const init = await rpc(tokens.access_token, "initialize", {
    protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" },
  });
  assert.equal(init.status, 200);
  assert.equal(init.body.result.protocolVersion, "2025-06-18");
  const list = await rpc(tokens.access_token, "tools/list", {});
  assert.ok(list.body.result.tools.some((t) => t.name === "add_items"));
  console.log("  ✓ initialize + tools/list");

  // Norwegian names resolve to the canonical catalogue entry. Test lists
  // aren't seeded with COMMON_ITEMS (bootstrapAccount inserts the list row
  // directly), so put "Milk" in the catalogue the way the app would first.
  const seeded = await fetch(`${BASE}/list`, { method: "POST", headers: auth, body: JSON.stringify({ name: "Milk" }) });
  assert.equal(seeded.status, 200);
  const { id: seededId } = await seeded.json();
  await fetch(`${BASE}/list/${seededId}`, { method: "DELETE", headers: auth });
  const added = await callTool(tokens.access_token, "add_items", { items: [{ name: "melk", qty: 2 }, { name: "Tannkrem" }] });
  assert.equal(added.isError, false, added.text);
  assert.equal(added.data.results[0].added_as, "Milk");
  const shopping = await callTool(tokens.access_token, "get_shopping_list");
  const milk = shopping.data.to_buy.find((it) => it.name === "Milk");
  assert.ok(milk, "Milk should be on the list");
  assert.equal(milk.qty, 2);
  assert.equal(milk.name_nb, "Melk");
  const checked = await callTool(tokens.access_token, "check_off_items", { ids: [milk.id] });
  assert.equal(checked.data.results[0].status, "bought");
  const again = await callTool(tokens.access_token, "check_off_items", { ids: [milk.id] });
  assert.equal(again.data.results[0].status, "already bought", "never toggles back");
  console.log("  ✓ shopping-list tools");

  const plan = await callTool(tokens.access_token, "get_meal_plan");
  assert.ok(plan.data.today);
  const planned = await callTool(tokens.access_token, "plan_meal", { date: plan.data.today, meal_name: "Taco" });
  assert.equal(planned.isError, false, planned.text);
  const replanned = await callTool(tokens.access_token, "plan_meal", { date: plan.data.today, meal_name: "Pizza" });
  assert.equal(replanned.data.replaced, "Taco");
  const tooFar = await callTool(tokens.access_token, "plan_meal", { date: "2099-01-01", meal_name: "Taco" });
  assert.equal(tooFar.isError, true);
  const tagged = await callTool(tokens.access_token, "update_meal", { name: "pizza", add_labels: ["fredag", "Kids"] });
  assert.equal(tagged.isError, false, tagged.text);
  assert.deepEqual(tagged.data.meal.labels, ["Fredag", "Kids"]);
  const retagged = await callTool(tokens.access_token, "update_meal", {
    id: tagged.data.meal.id, remove_labels: ["kids"], ingredients: ["Dough", "Cheese"], recipe_url: "https://example.com/pizza",
  });
  assert.equal(retagged.isError, false, retagged.text);
  assert.deepEqual(retagged.data.meal.labels, ["Fredag"]);
  assert.deepEqual(retagged.data.meal.ingredients, ["Dough", "Cheese"]);
  const foundMeal = await callTool(tokens.access_token, "search_meals", { query: "fredag" });
  assert.equal(foundMeal.data.meals[0].name, "Pizza");
  const badUrl = await callTool(tokens.access_token, "update_meal", { name: "Pizza", recipe_url: "javascript:alert(1)" });
  assert.equal(badUrl.isError, true);
  const created = await callTool(tokens.access_token, "create_meal", { name: "fiskesuppe", labels: ["fisk", "Quick"], ingredients: ["Cod"] });
  assert.equal(created.isError, false, created.text);
  assert.equal(created.data.meal.name, "Fiskesuppe");
  assert.deepEqual(created.data.meal.labels, ["Fisk", "Quick"]);
  const dupMeal = await callTool(tokens.access_token, "create_meal", { name: "Fiskesuppe" });
  assert.equal(dupMeal.isError, true);
  console.log("  ✓ meal tools");

  const box = await fetch(`${BASE}/storage/boxes`, {
    method: "POST", headers: auth, body: JSON.stringify({ name: "Jul", location: "Garasje", items: ["Julelys"] }),
  });
  assert.equal(box.status, 200);
  const found = await callTool(tokens.access_token, "find_storage", { query: "julelys" });
  assert.equal(found.data.boxes.length, 1);
  assert.equal(found.data.boxes[0].location, "Garasje");
  console.log("  ✓ storage tools");

  // Refresh rotates and keeps working.
  const refreshed = await fetch(`${ORIGIN}/oauth/token`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: tokens.refresh_token, client_id: clientId }),
  });
  assert.equal(refreshed.status, 200);
  const rt = await refreshed.json();
  assert.notEqual(rt.refresh_token, tokens.refresh_token);
  assert.equal((await rpc(rt.access_token, "ping", {})).status, 200);
  console.log("  ✓ refresh");

  // A read-only grant hides and refuses write tools. (Re-authorizing the
  // same client replaces its earlier grant — the library's default — so the
  // read-write tokens above stop working from here on.)
  const ro = await connect(BASE, auth, clientId, { write: false });
  const roTools = (await rpc(ro.access_token, "tools/list", {})).body.result.tools.map((t) => t.name);
  assert.ok(!roTools.includes("add_items"));
  const roAdd = await callTool(ro.access_token, "add_items", { items: [{ name: "Eggs" }] });
  assert.equal(roAdd.isError, true);
  console.log("  ✓ read-only grant");

  // Connected apps: list, then revoke kills the token.
  const apps = await (await fetch(`${BASE}/connected-apps`, { headers: auth })).json();
  assert.ok(apps.length >= 1);
  assert.equal(apps[0].client_name, "Claude");
  const roGrant = apps.find((a) => !a.scope.includes("write"));
  assert.ok(roGrant);
  const revoke = await fetch(`${BASE}/connected-apps/${encodeURIComponent(roGrant.id)}`, { method: "DELETE", headers: auth });
  assert.equal(revoke.status, 200);
  assert.equal((await rpc(ro.access_token, "ping", {})).status, 401);
  assert.equal((await rpc(rt.access_token, "ping", {})).status, 401, "re-authorizing replaced the earlier grant");
  console.log("  ✓ connected apps list + revoke");

  // A password change cuts the connector off on its next call.
  const fresh = await connect(BASE, auth, clientId);
  assert.equal((await callTool(fresh.access_token, "get_shopping_list")).isError, false);
  const change = await fetch(`${BASE}/change-password`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ current_password: PASS, new_password: "Another-password-456!" }),
  });
  assert.equal(change.status, 200);
  const afterChange = await callTool(fresh.access_token, "get_shopping_list");
  assert.equal(afterChange.isError, true);
  assert.match(afterChange.text, /Reconnect/);
  console.log("  ✓ password change revokes");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
