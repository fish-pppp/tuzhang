/**
 * Better Auth origin allowlist helpers (no Better Auth import).
 *
 * Email/password POSTs are rejected as "Invalid origin" unless the browser
 * Origin is in `trustedOrigins`. Setting `BETTER_AUTH_URL` used to *replace*
 * the preview / Vercel wildcards — so a custom domain like
 * `https://www.example.com` failed while the env still pointed at
 * `https://*.vercel.app`.
 */

export const LOCAL_DEV_ORIGINS: string[] = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://[::1]:8080",
];

function envTrim(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const value = env[key]?.trim();
  return value ? value : undefined;
}

/** Drop trailing slashes so `https://a.com/` matches `https://a.com`. */
export function normalizeOrigin(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

/** Split a comma / whitespace list of origins and drop trailing slashes. */
export function parseOriginList(raw: string | undefined): string[] {
  if (!raw) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(/[\s,]+/)) {
    const normalized = normalizeOrigin(part);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function uniqueOrigins(origins: Array<string | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of origins) {
    if (!item) continue;
    const normalized = normalizeOrigin(item);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

/**
 * Apex ↔ www pair for a two-label host (`example.com` / `www.example.com`).
 * Does not invent `www.tuzhang.vercel.app`.
 */
export function originWwwApexVariants(origin: string): string[] {
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

/** Extra origins from `BETTER_AUTH_TRUSTED_ORIGINS` (custom domain + Vercel URL). */
export function extraTrustedOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  return parseOriginList(envTrim(env, "BETTER_AUTH_TRUSTED_ORIGINS"));
}

/** Host wildcards plus `https://` / `http://` expansions Better Auth also matches. */
export function previewOriginWildcards(previewHosts: readonly string[]): string[] {
  return [
    ...previewHosts,
    ...previewHosts.flatMap((host) => [`https://${host}`, `http://${host}`]),
  ];
}

export function staticTrustedOrigins(input: {
  explicitBaseURL?: string;
  extraOrigins?: string[];
  vercelOrigins?: string[];
  previewHosts?: readonly string[];
  localOrigins?: string[];
}): string[] {
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

/**
 * Trust a credentialed POST that is truly same-origin: the browser Origin
 * matches the host this request actually hit (including forwarded proto/host).
 * Cross-site CSRF still fails because `Origin` would be the attacker site.
 */
export function sameOriginFromRequest(request: Request | undefined): string | undefined {
  if (!request) return undefined;
  const headerOrigin = request.headers.get("origin")?.trim();
  if (!headerOrigin || headerOrigin === "null") return undefined;
  const origin = normalizeOrigin(headerOrigin);

  try {
    if (origin === new URL(request.url).origin) return origin;
  } catch {
    // fall through to forwarded headers
  }

  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "")
    .split(",")[0]
    ?.trim();
  const proto = (request.headers.get("x-forwarded-proto") ?? "")
    .split(",")[0]
    ?.trim();
  if (!host || !proto) return undefined;
  const forwarded = normalizeOrigin(`${proto}://${host}`);
  return origin === forwarded ? origin : undefined;
}

export function resolveTrustedOrigins(
  request: Request | undefined,
  staticOrigins: string[],
): string[] {
  const sameOrigin = sameOriginFromRequest(request);
  if (!sameOrigin) return staticOrigins;
  return uniqueOrigins([...staticOrigins, sameOrigin]);
}
