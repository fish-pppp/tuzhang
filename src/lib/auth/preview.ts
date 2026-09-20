/**
 * Live-preview host allowlist (server-only — NEVER import from the client).
 *
 * The sandbox serves each live preview on a dynamic `https://*.grok-sandbox.com`
 * URL. Better Auth derives the origin per request and validates it against this
 * list (wildcard-matched) so email sign-up / sign-in POSTs are not rejected as
 * "Invalid origin".
 */
export const PREVIEW_ALLOWED_HOSTS = ["*.grok-sandbox.com"] as const;
