// Unit tests for worker/index.js's pure/crypto helper functions. Uses only
// Node's built-in node:test + node:assert/strict (Node 20+), no wrangler, no
// D1, no network — matches this repo's no-added-tooling stance for the
// backend. Run: node --test tests/worker-unit.test.mjs
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  b64url, b64urlStr, b64urlDecode, timingSafeEqual, hmac,
  signJwt, verifyJwt, hashPassword, verifyPassword, genPassword,
  sanitizeDisplayName, extractGlutenFree, capitalizeName, sanitizeLabels,
  isSuperAdmin, escapeHtml, COMMON_ITEMS,
  osloLocalDateParts, isReminderDue, addDaysIso,
} from "../worker/index.js";
import { CATEGORIES } from "../shared/categories.js";

describe("b64url / b64urlStr / b64urlDecode", () => {
  test("roundtrips a UTF-8 string through b64urlStr/b64urlDecode", () => {
    const original = "hello world";
    assert.equal(b64urlDecode(b64urlStr(original)), original);
  });

  test("roundtrips non-ASCII payload (Norwegian letters)", () => {
    const original = "Bjørn Åse Møller æøå";
    assert.equal(b64urlDecode(b64urlStr(original)), original);
  });

  test("output uses URL-safe charset (no +, /, =)", () => {
    // A payload likely to produce +, /, = in standard base64.
    const encoded = b64urlStr("subs>>??>>~~~???///+++===");
    assert.ok(!encoded.includes("+"));
    assert.ok(!encoded.includes("/"));
    assert.ok(!encoded.includes("="));
  });

  test("b64url encodes raw bytes (ArrayBuffer)", () => {
    const bytes = new Uint8Array([0, 1, 2, 253, 254, 255]);
    const encoded = b64url(bytes.buffer);
    assert.equal(typeof encoded, "string");
    assert.ok(encoded.length > 0);
  });
});

describe("timingSafeEqual", () => {
  test("equal strings return true", () => {
    assert.equal(timingSafeEqual("abcdef", "abcdef"), true);
  });

  test("different length returns false", () => {
    assert.equal(timingSafeEqual("abc", "abcd"), false);
  });

  test("single-char difference returns false", () => {
    assert.equal(timingSafeEqual("abcdef", "abcdeg"), false);
  });

  test("both empty returns true", () => {
    assert.equal(timingSafeEqual("", ""), true);
  });
});

describe("signJwt / verifyJwt", () => {
  const secret = "test-secret";

  test("roundtrips a payload", async () => {
    const token = await signJwt({ sub: "alice", tv: 1 }, secret);
    const payload = await verifyJwt(token, secret);
    assert.equal(payload.sub, "alice");
    assert.equal(payload.tv, 1);
  });

  test("rejects a tampered signature", async () => {
    const token = await signJwt({ sub: "alice" }, secret);
    const [header, body] = token.split(".");
    const tampered = `${header}.${body}.tamperedsignature`;
    assert.equal(await verifyJwt(tampered, secret), null);
  });

  test("rejects an expired token", async () => {
    const expired = Math.floor(Date.now() / 1000) - 10;
    const token = await signJwt({ sub: "alice", exp: expired }, secret);
    assert.equal(await verifyJwt(token, secret), null);
  });

  test("accepts a token that hasn't expired yet", async () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    const token = await signJwt({ sub: "alice", exp: future }, secret);
    const payload = await verifyJwt(token, secret);
    assert.equal(payload.sub, "alice");
  });

  test("rejects a malformed token (wrong segment count)", async () => {
    assert.equal(await verifyJwt("not.a.valid.jwt.token", secret), null);
    assert.equal(await verifyJwt("onlyonepart", secret), null);
  });

  test("rejects a token signed with a different secret", async () => {
    const token = await signJwt({ sub: "alice" }, secret);
    assert.equal(await verifyJwt(token, "wrong-secret"), null);
  });
});

describe("hmac", () => {
  test("is deterministic for the same secret+data", async () => {
    const a = await hmac("secret", "data");
    const b = await hmac("secret", "data");
    assert.equal(a, b);
  });

  test("differs when the secret differs", async () => {
    const a = await hmac("secret1", "data");
    const b = await hmac("secret2", "data");
    assert.notEqual(a, b);
  });
});

describe("hashPassword / verifyPassword", () => {
  test("a correct password verifies", async () => {
    const stored = await hashPassword("correct-horse-battery-staple");
    assert.equal(await verifyPassword("correct-horse-battery-staple", stored), true);
  });

  test("a wrong password fails to verify", async () => {
    const stored = await hashPassword("correct-horse-battery-staple");
    assert.equal(await verifyPassword("wrong-password", stored), false);
  });

  test("hashing the same password twice yields different stored strings (random salt) but both verify", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    assert.notEqual(a, b);
    assert.equal(await verifyPassword("same-password", a), true);
    assert.equal(await verifyPassword("same-password", b), true);
  });

  test("a malformed stored-hash string doesn't throw, just fails", async () => {
    assert.equal(await verifyPassword("anything", "garbage"), false);
    assert.equal(await verifyPassword("anything", ""), false);
  });
});

describe("genPassword", () => {
  test("matches the xxxx-xxxx-xxxx shape", () => {
    const pw = genPassword();
    assert.match(pw, /^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/);
  });

  test("excludes visually ambiguous characters (0, O, 1, l, I)", () => {
    for (let i = 0; i < 20; i++) {
      const pw = genPassword();
      assert.doesNotMatch(pw, /[0O1lI]/);
    }
  });
});

describe("sanitizeDisplayName", () => {
  test("trims leading/trailing whitespace", () => {
    assert.equal(sanitizeDisplayName("  Alice  "), "Alice");
  });

  test("collapses internal whitespace runs", () => {
    assert.equal(sanitizeDisplayName("Alice   Bob"), "Alice Bob");
  });

  test("preserves casing/punctuation as typed (not force-capitalized)", () => {
    assert.equal(sanitizeDisplayName("iPhone-Ola"), "iPhone-Ola");
  });

  test("preserves Norwegian letters (æøå)", () => {
    assert.equal(sanitizeDisplayName("Bjørn Åse"), "Bjørn Åse");
  });

  test("returns empty string for empty/whitespace-only/undefined input", () => {
    assert.equal(sanitizeDisplayName(""), "");
    assert.equal(sanitizeDisplayName("   "), "");
    assert.equal(sanitizeDisplayName(undefined), "");
  });

  test("caps length at 60 characters", () => {
    const long = "a".repeat(100);
    assert.equal(sanitizeDisplayName(long).length, 60);
    assert.equal(sanitizeDisplayName(long), "a".repeat(60));
  });
});

describe("extractGlutenFree", () => {
  test("strips a trailing GF marker and sets the flag", () => {
    assert.deepEqual(extractGlutenFree("Pasta GF"), { name: "Pasta", gf: true });
  });

  test("is case-insensitive and recognizes glutenfri/glutenfritt", () => {
    assert.deepEqual(extractGlutenFree("pasta glutenfri"), { name: "pasta", gf: true });
    assert.deepEqual(extractGlutenFree("Brød GLUTENFRITT"), { name: "Brød", gf: true });
  });

  test("matches on word boundaries only (Giraffe unaffected)", () => {
    assert.deepEqual(extractGlutenFree("Giraffe"), { name: "Giraffe", gf: false });
  });

  test("leaves marker-only input untouched (no name to attach it to)", () => {
    assert.deepEqual(extractGlutenFree("GF"), { name: "GF", gf: false });
  });

  test("leaves input with no marker unchanged", () => {
    assert.deepEqual(extractGlutenFree("Melk"), { name: "Melk", gf: false });
  });
});

describe("capitalizeName", () => {
  test("returns empty string for empty input", () => {
    assert.equal(capitalizeName(""), "");
    assert.equal(capitalizeName(undefined), "");
  });

  test("capitalizes a single character", () => {
    assert.equal(capitalizeName("a"), "A");
  });

  test("leaves an already-capitalized name alone", () => {
    assert.equal(capitalizeName("Brød"), "Brød");
  });

  test("only capitalizes the first letter in a multi-word name", () => {
    assert.equal(capitalizeName("gresk yoghurt"), "Gresk yoghurt");
  });

  test("trims leading/trailing whitespace", () => {
    assert.equal(capitalizeName("  melk  "), "Melk");
  });

  test("preserves casing like '7 Up'", () => {
    assert.equal(capitalizeName("7 Up"), "7 Up");
  });
});

describe("sanitizeLabels", () => {
  test("non-array input returns []", () => {
    assert.deepEqual(sanitizeLabels(null), []);
    assert.deepEqual(sanitizeLabels(undefined), []);
    assert.deepEqual(sanitizeLabels("not an array"), []);
  });

  test("dedupes case-insensitively, keeping first-seen casing", () => {
    assert.deepEqual(sanitizeLabels(["vegetar", "Vegetar", "VEGETAR"]), ["Vegetar"]);
  });

  test("drops blank/whitespace-only entries", () => {
    assert.deepEqual(sanitizeLabels(["", "   ", "Vegansk"]), ["Vegansk"]);
  });

  test("tolerates non-string array entries without throwing", () => {
    assert.deepEqual(sanitizeLabels([42, null, "Vegansk", undefined]), ["Vegansk"]);
  });

  test("capitalizes each label like capitalizeName", () => {
    assert.deepEqual(sanitizeLabels(["quick", "budget-friendly"]), ["Quick", "Budget-friendly"]);
  });
});

describe("isSuperAdmin", () => {
  test("matches a username in the comma-separated allowlist case-insensitively", () => {
    const env = { SUPERADMIN_USERNAMES: "Alice,bob" };
    assert.equal(isSuperAdmin("alice", env), true);
    assert.equal(isSuperAdmin("BOB", env), true);
  });

  test("returns false for an empty/undefined env var", () => {
    assert.equal(isSuperAdmin("alice", {}), false);
    assert.equal(isSuperAdmin("alice", { SUPERADMIN_USERNAMES: "" }), false);
  });

  test("returns false for a username not on the allowlist", () => {
    assert.equal(isSuperAdmin("mallory", { SUPERADMIN_USERNAMES: "alice,bob" }), false);
  });

  test("tolerates stray whitespace around entries", () => {
    const env = { SUPERADMIN_USERNAMES: " alice , bob " };
    assert.equal(isSuperAdmin("alice", env), true);
    assert.equal(isSuperAdmin("bob", env), true);
  });
});

describe("escapeHtml", () => {
  test("escapes all five special characters", () => {
    assert.equal(escapeHtml(`<script>alert("hi") & 'bye'</script>`),
      "&lt;script&gt;alert(&quot;hi&quot;) &amp; &#39;bye&#39;&lt;/script&gt;");
  });

  test("leaves plain text untouched", () => {
    assert.equal(escapeHtml("Kan vi kjøpe mer melk?"), "Kan vi kjøpe mer melk?");
  });

  test("neutralizes an HTML-injection attempt so it can't break out of the surrounding markup", () => {
    const malicious = `</p><img src=x onerror=alert(1)><p>`;
    const escaped = escapeHtml(malicious);
    assert.ok(!escaped.includes("<img"), "raw tag must not survive escaping");
    assert.equal(escaped, "&lt;/p&gt;&lt;img src=x onerror=alert(1)&gt;&lt;p&gt;");
  });
});

describe("osloLocalDateParts", () => {
  test("converts a winter (CET, UTC+1) timestamp to local hhmm/today/tomorrow/dow", () => {
    const nowMs = Date.parse("2026-01-15T12:00:00Z");
    // 2026-01-15 is a Thursday -> dow 3 (0=Mon..6=Sun).
    assert.deepEqual(osloLocalDateParts(nowMs), { hhmm: "13:00", today: "2026-01-15", tomorrow: "2026-01-16", dow: 3 });
  });

  test("converts a summer (CEST, UTC+2) timestamp to local hhmm/today/tomorrow/dow", () => {
    const nowMs = Date.parse("2026-07-15T12:00:00Z");
    // 2026-07-15 is a Wednesday -> dow 2.
    assert.deepEqual(osloLocalDateParts(nowMs), { hhmm: "14:00", today: "2026-07-15", tomorrow: "2026-07-16", dow: 2 });
  });

  test("rolls 'today'/'tomorrow'/'dow' onto the Oslo-local calendar date, not the UTC one, near midnight", () => {
    // 22:30 UTC in summer is 00:30 the *next* day in Oslo (UTC+2); 2026-07-16 is a Thursday -> dow 3.
    const nowMs = Date.parse("2026-07-15T22:30:00Z");
    assert.deepEqual(osloLocalDateParts(nowMs), { hhmm: "00:30", today: "2026-07-16", tomorrow: "2026-07-17", dow: 3 });
  });

  test("rolls 'tomorrow' across a month boundary", () => {
    const nowMs = Date.parse("2026-01-31T20:00:00Z"); // 21:00 CET
    // 2026-01-31 is a Saturday -> dow 5.
    assert.deepEqual(osloLocalDateParts(nowMs), { hhmm: "21:00", today: "2026-01-31", tomorrow: "2026-02-01", dow: 5 });
  });

  test("recognizes Sunday as dow 6 (used to gate the weekly reminder)", () => {
    const nowMs = Date.parse("2026-02-01T17:00:00Z"); // 18:00 CET; 2026-02-01 is a Sunday
    assert.deepEqual(osloLocalDateParts(nowMs), { hhmm: "18:00", today: "2026-02-01", tomorrow: "2026-02-02", dow: 6 });
  });
});

describe("isReminderDue", () => {
  test("true when hhmm matches the configured time exactly", () => {
    assert.equal(isReminderDue("18:00", "18:00"), true);
  });

  test("false when hhmm differs from the configured time", () => {
    assert.equal(isReminderDue("18:15", "18:00"), false);
    assert.equal(isReminderDue("6:00", "06:00"), false);
  });
});

describe("addDaysIso", () => {
  test("adds days within the same month", () => {
    assert.equal(addDaysIso("2026-07-15", 6), "2026-07-21");
  });

  test("zero days returns the same date", () => {
    assert.equal(addDaysIso("2026-06-01", 0), "2026-06-01");
  });

  test("rolls across a month boundary", () => {
    assert.equal(addDaysIso("2026-01-28", 6), "2026-02-03");
  });

  test("rolls across a year boundary", () => {
    assert.equal(addDaysIso("2026-12-28", 6), "2027-01-03");
  });
});

describe("COMMON_ITEMS (new-list catalogue seed)", () => {
  test("carries the full catalogue migrations 0002/0003 backfilled into every list, not just the original smaller set", () => {
    // Regression guard: createList() only ever seeds new lists from this
    // array, so if it shrinks back down to the ~120-item set that predates
    // migrations/0002_seed_catalogue.sql + 0003_expand_catalogue.sql, every
    // list created afterwards silently falls behind the ~710-item catalogue
    // those migrations gave every list that already existed at the time.
    assert.ok(COMMON_ITEMS.length >= 700, `expected >=700 items, got ${COMMON_ITEMS.length}`);
  });

  test("every item has a category from the shared CATEGORIES list", () => {
    const bad = COMMON_ITEMS.filter((it) => !CATEGORIES.includes(it.category));
    assert.deepEqual(bad, []);
  });

  test("has no duplicate names (case-insensitive, matching item_catalogue's COLLATE NOCASE unique constraint)", () => {
    const seen = new Set();
    const dupes = [];
    for (const it of COMMON_ITEMS) {
      const key = it.name.toLowerCase();
      if (seen.has(key)) dupes.push(it.name);
      seen.add(key);
    }
    assert.deepEqual(dupes, []);
  });
});
