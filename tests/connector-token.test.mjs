// Plain-Node integration test for connector tokens — the short-lived,
// scoped JWTs the panhandle-mcp Worker (claude.ai connector, see
// docs/mcp-connector-plan.md) uses to call this API on a user's behalf.
// Spins up the real Worker locally against a local D1 via tests/_helpers.mjs.
//
// Covers: a connector token reaches its allowlisted routes and nothing else,
// a read-only token can't write, no X-Refresh-Token ever comes back (that
// header is a full 90-day session token), an over-long or foreign-audience
// token is rejected outright, and a password change (token_version bump)
// cuts the connector off like any other device.
//
// Run: node tests/connector-token.test.mjs
import assert from "node:assert/strict";
import { startWorker, seedAndLogin, JWT_SECRET } from "./_helpers.mjs";
import { signJwt, b64urlDecode } from "../worker/index.js";

const PORT = 8812;
const RUN_ID = Date.now().toString(36);
const PASS = "Test-password-123!";

async function main() {
  const worker = await startWorker({ port: PORT });
  try {
    await runTests(worker.base);
    console.log("\nAll connector-token tests passed.");
  } finally {
    await worker.teardown();
  }
}

function claimsOf(token) {
  return JSON.parse(b64urlDecode(token.split(".")[1]));
}

async function connectorAuth(sessionToken, { scp = ["read", "write"], ttl = 300, aud = "mcp" } = {}) {
  const { sub, tv } = claimsOf(sessionToken);
  const token = await signJwt({ sub, tv, aud, scp, exp: Math.floor(Date.now() / 1000) + ttl }, JWT_SECRET);
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function runTests(BASE) {
  const { token } = await seedAndLogin(BASE, `ct_${RUN_ID}@example.com`, PASS);
  const rw = await connectorAuth(token);

  // Allowlisted read + write work, and never carry a refresh token.
  const list = await fetch(`${BASE}/list`, { headers: rw });
  assert.equal(list.status, 200);
  assert.equal(list.headers.get("X-Refresh-Token"), null);

  const add = await fetch(`${BASE}/list`, { method: "POST", headers: rw, body: JSON.stringify({ name: "Milk" }) });
  assert.equal(add.status, 200);
  assert.equal(add.headers.get("X-Refresh-Token"), null);
  const { id } = await add.json();

  const toggle = await fetch(`${BASE}/list/${id}/toggle`, { method: "POST", headers: rw });
  assert.equal(toggle.status, 200);

  // An error answer from an allowlisted route doesn't leak one either.
  const badPlan = await fetch(`${BASE}/plan`, { method: "POST", headers: rw, body: JSON.stringify({ plan_date: "nope" }) });
  assert.equal(badPlan.status, 400);
  assert.equal(badPlan.headers.get("X-Refresh-Token"), null);

  // Everything outside the allowlist is refused, before any handler runs.
  for (const [method, path] of [
    ["GET", "/account"], ["DELETE", "/account"], ["GET", "/admin/users"],
    ["POST", "/list-invites"], [`DELETE`, `/list/${id}`], ["POST", "/list/mark-all-bought"],
  ]) {
    const res = await fetch(`${BASE}${path}`, { method, headers: rw, body: method === "GET" ? undefined : "{}" });
    assert.equal(res.status, 403, `${method} ${path}`);
    assert.equal((await res.json()).code, "CONNECTOR_NOT_ALLOWED", `${method} ${path}`);
  }

  // Read-only scope: reads pass, writes don't.
  const ro = await connectorAuth(token, { scp: ["read"] });
  assert.equal((await fetch(`${BASE}/plan`, { headers: ro })).status, 200);
  const roAdd = await fetch(`${BASE}/list`, { method: "POST", headers: ro, body: JSON.stringify({ name: "Eggs" }) });
  assert.equal(roAdd.status, 403);
  assert.equal((await roAdd.json()).code, "INSUFFICIENT_SCOPE");

  // Over-long lifetime or a foreign audience is not a valid token at all.
  assert.equal((await fetch(`${BASE}/list`, { headers: await connectorAuth(token, { ttl: 3600 }) })).status, 401);
  assert.equal((await fetch(`${BASE}/list`, { headers: await connectorAuth(token, { aud: "other" }) })).status, 401);

  // The session token itself is unaffected and still gets its refresh header.
  const session = await fetch(`${BASE}/list`, { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(session.status, 200);
  assert.ok(session.headers.get("X-Refresh-Token"));

  // A password change bumps token_version, which cuts the connector off.
  const change = await fetch(`${BASE}/change-password`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ current_password: PASS, new_password: "Another-password-456!" }),
  });
  assert.equal(change.status, 200, `change-password: ${await change.clone().text()}`);
  assert.equal((await fetch(`${BASE}/list`, { headers: rw })).status, 401);

  console.log("  ✓ connector tokens: allowlist, scopes, no refresh token, ttl/aud, tv revocation");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
