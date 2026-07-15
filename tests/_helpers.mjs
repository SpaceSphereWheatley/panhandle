// Shared bootstrap for the wrangler-dev-backed integration tests in this
// directory (tests/*.test.mjs, excluding worker-unit.test.mjs which is a
// pure node:test file with no wrangler dependency). Spins up the real Worker
// locally against a local D1 so tests exercise the actual HTTP API rather
// than reimplementing its logic. These tests are intentionally NOT wired
// into CI — see CLAUDE.md's Testing conventions section — run them on
// demand via `npm run test:integration` or `node tests/<file>.test.mjs`.
import { spawn } from "node:child_process";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hashPassword } from "../worker/index.js";

export const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const JWT_SECRET = "test-jwt-secret-not-for-production";
const DEV_VARS_PATH = path.join(ROOT, ".dev.vars");

export function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: ROOT, stdio: "inherit" });
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`))));
  });
}

async function waitForServer(base, proc, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${base}/version`);
      if (res.ok) return;
    } catch { /* not up yet */ }
    if (proc.exitCode !== null) throw new Error("wrangler dev exited before becoming ready");
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Timed out waiting for wrangler dev to start");
}

// Spawns `wrangler dev --local` against a freshly migrated local D1 on the
// given port. Writes a throwaway .dev.vars if one doesn't already exist (so
// this never clobbers a developer's real one), removing it again on
// teardown. `extraDevVars` appends extra lines (e.g. SUPERADMIN_USERNAMES=...)
// when this test run's .dev.vars is the one being written.
export async function startWorker({ port, extraDevVars = "" } = {}) {
  if (!port) throw new Error("startWorker requires a port");
  const base = `http://127.0.0.1:${port}/api`;

  let wroteDevVars = false;
  if (!existsSync(DEV_VARS_PATH)) {
    writeFileSync(DEV_VARS_PATH, `JWT_SECRET=${JWT_SECRET}\n${extraDevVars}`);
    wroteDevVars = true;
  }

  console.log("Applying local D1 migrations...");
  await run("npx", ["wrangler", "d1", "migrations", "apply", "panhandle", "--local"]);

  console.log(`Starting wrangler dev (local, port ${port})...`);
  // `wrangler dev` spawns its own child process (workerd) that a plain
  // proc.kill() on the npx process doesn't reach, leaving it (and its held
  // stdio pipes) running after teardown. detached:true puts it in its own
  // process group so we can kill the whole tree via the negative pid.
  const proc = spawn("npx", ["wrangler", "dev", "--local", "--port", String(port)], {
    cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], detached: true,
  });

  await waitForServer(base, proc);

  return {
    base,
    async teardown() {
      try {
        process.kill(-proc.pid, "SIGTERM");
      } catch { /* already gone */ }
      if (wroteDevVars) unlinkSync(DEV_VARS_PATH);
    },
  };
}

// Bootstraps a throwaway account (a fresh list, owner+admin) by writing
// straight to the local D1 SQLite file via `wrangler d1 execute --local` —
// there's no HTTP bootstrap endpoint (the old /seed route was removed once
// self-service signup made it unnecessary; see CLAUDE.md's Auth model).
// Throws (rejecting the whole test run, same as any other `run()` call in
// this file) if the insert fails, rather than returning a status to check.
function sqlEscape(str) {
  return str.replace(/'/g, "''");
}

export async function bootstrapAccount(base, username, password) {
  const hash = await hashPassword(password);
  const sql = [
    "INSERT INTO lists (name) VALUES (NULL);",
    `INSERT INTO users (username, pass_hash, token_version, is_admin, is_owner, list_id, created_by) ` +
      `VALUES ('${sqlEscape(username)}', '${sqlEscape(hash)}', 1, 1, 1, last_insert_rowid(), 'test-bootstrap');`,
  ].join("\n");
  const sqlFile = path.join(ROOT, `.test-bootstrap-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`);
  writeFileSync(sqlFile, sql);
  try {
    await run("npx", ["wrangler", "d1", "execute", "panhandle", "--local", "--file", sqlFile]);
  } finally {
    unlinkSync(sqlFile);
  }
}

// bootstrapAccount() + login, returning both the raw token and a
// ready-to-spread auth header.
export async function seedAndLogin(base, username, password) {
  await bootstrapAccount(base, username, password);

  const res = await fetch(`${base}/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (res.status !== 200) throw new Error(`login failed for ${username}: ${res.status} ${await res.text()}`);
  const { token } = await res.json();
  return { token, auth: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } };
}
