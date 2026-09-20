import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { sendPasswordResetCode } from "./reset-api";

/**
 * Better Auth client for this React SPA (browser-side).
 *
 * Talks to this app's OWN Better Auth at same-origin `/api/auth/*`. In the live
 * preview the app is an embedded iframe with PARTITIONED cookies, so a stored
 * bearer token (if present) is attached via `onRequest`. When deployed (cookie
 * auth) no token is stored, so nothing changes.
 */
export const authClient = createAuthClient({
  plugins: [emailOTPClient()],
  fetchOptions: {
    onRequest(ctx) {
      const token = getBearerToken();
      if (token) ctx.headers.set("Authorization", `Bearer ${token}`);
      return ctx;
    },
  },
});

/** Send a 6-digit reset code. Throws if the mailer rejects the message. */
export async function requestPasswordResetCode(email: string): Promise<void> {
  await sendPasswordResetCode({ data: { email } });
}

/** Set a new password after the user types the email OTP. */
export async function resetPasswordWithCode(input: {
  email: string;
  otp: string;
  password: string;
}): Promise<void> {
  const { error } = await authClient.emailOtp.resetPassword(input);
  if (error) throw new Error(error.message || "改密码失败");
}

/**
 * True when sign-in UI should be shown. On by default; set
 * `VITE_AUTH_ENABLED=false` to force it off (dev user — see `use-current-user`).
 */
export const authEnabled = import.meta.env.VITE_AUTH_ENABLED !== "false";

// ── Live-preview bearer token ────────────────────────────────────────────────
// The embedded preview iframe has partitioned cookies, so we keep the session's
// bearer token in sessionStorage and attach it to every Better Auth request (and
// to server functions, via `@/lib/auth/middleware`). Empty everywhere except the
// preview after a token is stored, so the cookie path is untouched elsewhere.
const BEARER_KEY = "grok-auth.bearer-token";

/** The stored preview bearer token, or null. */
export function getBearerToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(BEARER_KEY);
  } catch {
    return null;
  }
}

function setBearerToken(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token) window.sessionStorage.setItem(BEARER_KEY, token);
    else window.sessionStorage.removeItem(BEARER_KEY);
  } catch {
    /* storage unavailable — ignore */
  }
}

/** Sign out of THIS app's local session, clear the preview token, then redirect. */
export async function signOut(redirectTo = "/"): Promise<void> {
  try {
    await authClient.signOut();
  } finally {
    setBearerToken(null);
  }
  window.location.href = redirectTo;
}
