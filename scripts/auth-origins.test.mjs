import assert from "node:assert/strict";
import test from "node:test";

// Keep in sync with src/lib/auth/origins.ts
const LOCAL_DEV_ORIGINS = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://[::1]:8080",
];

function normalizeOrigin(raw) {
  return raw.trim().replace(/\/+$/, "");
}

function parseOriginList(raw) {
  if (!raw) return [];
  const out = [];
  const seen = new Set();
  for (const part of raw.split(/[\s,]+/)) {
    const normalized = normalizeOrigin(part);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function uniqueOrigins(origins) {
  const out = [];
  const seen = new Set();
  for (const item of origins) {
    if (!item) continue;
    const normalized = normalizeOrigin(item);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function originWwwApexVariants(origin) {
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") return [];
    const host = url.hostname.toLowerCase();
    const port = url.port ? `:${url.port}` : "";
    const proto = url.protocol;
    const labels = host.split(".");
    const variants = [`${proto}//${host}${port}`];
    if (host.startsWith("www.") && labels.length === 3) {
      variants.push(`${proto}//${host.slice(4)}${port}`);
    } else if (labels.length === 2) {
      variants.push(`${proto}//www.${host}${port}`);
    }
    return uniqueOrigins(variants);
  } catch {
    return [];
  }
}

function extraTrustedOrigins(env) {
  const value = env.BETTER_AUTH_TRUSTED_ORIGINS?.trim();
  return parseOriginList(value || undefined);
}

function previewOriginWildcards(previewHosts) {
  return [
    ...previewHosts,
    ...previewHosts.flatMap((host) => [`https://${host}`, `http://${host}`]),
  ];
}

function staticTrustedOrigins(input) {
  const explicit = input.explicitBaseURL ? normalizeOrigin(input.explicitBaseURL) : undefined;
  return uniqueOrigins([
    explicit,
    ...(explicit ? originWwwApexVariants(explicit) : []),
    ...(input.extraOrigins ?? []),
    ...(input.extraOrigins ?? []).flatMap(originWwwApexVariants),
    ...(input.localOrigins ?? LOCAL_DEV_ORIGINS),
    ...(input.vercelOrigins ?? []),
    ...previewOriginWildcards(input.previewHosts ?? []),
  ]);
}

function sameOriginFromRequest(request) {
  if (!request) return undefined;
  const headerOrigin = request.headers.get("origin")?.trim();
  if (!headerOrigin || headerOrigin === "null") return undefined;
  const origin = normalizeOrigin(headerOrigin);
  try {
    if (origin === new URL(request.url).origin) return origin;
  } catch {
    // fall through
  }
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "")
    .split(",")[0]
    ?.trim();
  const proto = (request.headers.get("x-forwarded-proto") ?? "").split(",")[0]?.trim();
  if (!host || !proto) return undefined;
  const forwarded = normalizeOrigin(`${proto}://${host}`);
  return origin === forwarded ? origin : undefined;
}

function resolveTrustedOrigins(request, staticOrigins) {
  const sameOrigin = sameOriginFromRequest(request);
  if (!sameOrigin) return staticOrigins;
  return uniqueOrigins([...staticOrigins, sameOrigin]);
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

test("www and apex are paired only for two-label hosts", () => {
  assert.deepEqual(originWwwApexVariants("https://diyforvisa.com"), [
    "https://diyforvisa.com",
    "https://www.diyforvisa.com",
  ]);
  assert.deepEqual(originWwwApexVariants("https://www.diyforvisa.com"), [
    "https://www.diyforvisa.com",
    "https://diyforvisa.com",
  ]);
  assert.deepEqual(originWwwApexVariants("https://tuzhang.vercel.app"), [
    "https://tuzhang.vercel.app",
  ]);
});

test("setting BETTER_AUTH_URL still keeps preview and Vercel wildcards", () => {
  const origins = staticTrustedOrigins({
    explicitBaseURL: "https://tuzhang.vercel.app/",
    extraOrigins: extraTrustedOrigins({
      BETTER_AUTH_TRUSTED_ORIGINS: "https://www.diyforvisa.com",
    }),
    vercelOrigins: ["https://*.vercel.app"],
    previewHosts: ["*.grok-sandbox.com", "*.vercel.app"],
  });
  assert.ok(origins.includes("https://tuzhang.vercel.app"));
  assert.ok(origins.includes("https://www.diyforvisa.com"));
  assert.ok(origins.includes("https://diyforvisa.com"));
  assert.ok(origins.includes("http://localhost:8080"));
  assert.ok(origins.includes("https://*.vercel.app"));
  assert.ok(origins.includes("https://*.grok-sandbox.com"));
});

test("same-origin POSTs from a custom domain are trusted", () => {
  const staticOrigins = staticTrustedOrigins({
    explicitBaseURL: "https://tuzhang.vercel.app",
    previewHosts: [],
    vercelOrigins: [],
  });
  const allowed = resolveTrustedOrigins(
    new Request("https://www.diyforvisa.com/api/auth/sign-in/email", {
      method: "POST",
      headers: { origin: "https://www.diyforvisa.com" },
    }),
    staticOrigins,
  );
  assert.ok(allowed.includes("https://www.diyforvisa.com"));
});

test("cross-site Origin is not added from the request host", () => {
  const staticOrigins = ["https://tuzhang.vercel.app"];
  const allowed = resolveTrustedOrigins(
    new Request("https://www.diyforvisa.com/api/auth/sign-in/email", {
      method: "POST",
      headers: { origin: "https://evil.example" },
    }),
    staticOrigins,
  );
  assert.deepEqual(allowed, staticOrigins);
});

test("forwarded proto/host matches Origin behind a reverse proxy", () => {
  const origin = sameOriginFromRequest(
    new Request("http://127.0.0.1:3000/api/auth/sign-in/email", {
      method: "POST",
      headers: {
        origin: "https://www.diyforvisa.com",
        "x-forwarded-host": "www.diyforvisa.com",
        "x-forwarded-proto": "https",
      },
    }),
  );
  assert.equal(origin, "https://www.diyforvisa.com");
});
