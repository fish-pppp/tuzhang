/**
 * Trusted-origin helpers for Better Auth (server-only, no Better Auth import).
 *
 * Used by `./server` and covered by `scripts/auth-origins.test.mjs` — keep the
 * parse / require rules in sync with that file.
 */

function envTrim(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const value = env[key]?.trim();
  return value ? value : undefined;
}

/** Split a comma / whitespace list of origins and drop trailing slashes. */
export function parseOriginList(raw: string | undefined): string[] {
  if (!raw) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(/[\s,]+/)) {
    const trimmed = part.trim().replace(/\/+$/, "");
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

/** Extra origins from `BETTER_AUTH_TRUSTED_ORIGINS` (www + apex, etc.). */
export function extraTrustedOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  return parseOriginList(envTrim(env, "BETTER_AUTH_TRUSTED_ORIGINS"));
}

export function shouldRequireAuthSecret(env: NodeJS.ProcessEnv = process.env): boolean {
  if (envTrim(env, "BETTER_AUTH_SECRET")) return false;
  // Do not key off NODE_ENV=production: `vite build` sets that and would fail
  // the Docker image build before a secret exists. Vercel sets VERCEL=1;
  // the self-host image sets TUZHANG_SELF_HOST=1 at runtime.
  return Boolean(envTrim(env, "VERCEL")) || envTrim(env, "TUZHANG_SELF_HOST") === "1";
}

/** Production / Vercel / Docker must share one signing secret across instances. */
export function requireAuthSecret(env: NodeJS.ProcessEnv = process.env): void {
  if (!shouldRequireAuthSecret(env)) return;
  throw new Error(
    "[auth] BETTER_AUTH_SECRET is required in production. Generate one with: openssl rand -base64 32",
  );
}
