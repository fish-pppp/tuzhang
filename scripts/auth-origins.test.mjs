import assert from "node:assert/strict";
import test from "node:test";

// Keep in sync with src/lib/auth/origins.ts
function parseOriginList(raw) {
  if (!raw) return [];
  const out = [];
  const seen = new Set();
  for (const part of raw.split(/[\s,]+/)) {
    const trimmed = part.trim().replace(/\/+$/, "");
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function extraTrustedOrigins(env) {
  const value = env.BETTER_AUTH_TRUSTED_ORIGINS?.trim();
  return parseOriginList(value || undefined);
}

function shouldRequireAuthSecret(env) {
  if (env.BETTER_AUTH_SECRET?.trim()) return false;
  return Boolean(env.VERCEL?.trim()) || env.TUZHANG_SELF_HOST?.trim() === "1";
}

test("parseOriginList splits commas and strips trailing slashes", () => {
  assert.deepEqual(parseOriginList("https://a.com/, https://b.com"), [
    "https://a.com",
    "https://b.com",
  ]);
  assert.deepEqual(parseOriginList("https://a.com https://a.com/"), ["https://a.com"]);
  assert.deepEqual(parseOriginList(""), []);
  assert.deepEqual(parseOriginList(undefined), []);
});

test("extraTrustedOrigins reads BETTER_AUTH_TRUSTED_ORIGINS", () => {
  assert.deepEqual(extraTrustedOrigins({}), []);
  assert.deepEqual(
    extraTrustedOrigins({ BETTER_AUTH_TRUSTED_ORIGINS: " https://www.t.example/ " }),
    ["https://www.t.example"],
  );
});

test("Vercel / self-host require a signing secret; vite production build does not", () => {
  assert.equal(shouldRequireAuthSecret({}), false);
  assert.equal(shouldRequireAuthSecret({ NODE_ENV: "production" }), false);
  assert.equal(shouldRequireAuthSecret({ VERCEL: "1" }), true);
  assert.equal(shouldRequireAuthSecret({ TUZHANG_SELF_HOST: "1" }), true);
  assert.equal(shouldRequireAuthSecret({ VERCEL: "1", BETTER_AUTH_SECRET: "x" }), false);
});
