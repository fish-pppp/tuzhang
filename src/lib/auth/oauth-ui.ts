/**
 * Whether the login page should render Google / X buttons.
 *
 * Build-time flag (`VITE_SHOW_OAUTH`). Unset = show (Vercel / preview).
 * Mainland self-host images set this to `false` so users are not sent to
 * sites that are unreachable from China.
 */
export const federatedSignInVisible = import.meta.env.VITE_SHOW_OAUTH !== "false";
