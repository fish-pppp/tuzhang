/**
 * Vercel runtime helpers for Better Auth (server-only).
 *
 * Vercel injects hostnames without a scheme (`VERCEL_URL`,
 * `VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_BRANCH_URL`). Better Auth needs
 * full origins and an allowlist so email/password POSTs from `*.vercel.app`
 * (and custom domains set as BETTER_AUTH_URL) are not rejected as
 * "Invalid origin".
 */

function env(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
}

function asHttpsOrigin(hostOrUrl: string | undefined): string | undefined {
  if (!hostOrUrl) return undefined;
  if (/^https?:\/\//i.test(hostOrUrl)) return hostOrUrl.replace(/\/+$/, "");
  return `https://${hostOrUrl}`;
}

/** Host patterns Better Auth may derive a per-request baseURL from. */
export const VERCEL_ALLOWED_HOSTS = ["*.vercel.app"] as const;

export function isVercelRuntime(): boolean {
  return Boolean(env("VERCEL"));
}

/** This deployment + production + preview origins, plus a `*.vercel.app` wildcard. */
export function vercelOrigins(): string[] {
  const origins = [
    asHttpsOrigin(env("VERCEL_URL")),
    asHttpsOrigin(env("VERCEL_BRANCH_URL")),
    asHttpsOrigin(env("VERCEL_PROJECT_PRODUCTION_URL")),
  ].filter((item): item is string => Boolean(item));
  if (isVercelRuntime() || origins.length > 0) {
    origins.push("https://*.vercel.app");
  }
  return [...new Set(origins)];
}

/** Prefer the production hostname, then this deployment's URL. */
export function vercelFallbackOrigin(): string | undefined {
  return (
    asHttpsOrigin(env("VERCEL_PROJECT_PRODUCTION_URL")) ??
    asHttpsOrigin(env("VERCEL_URL"))
  );
}
