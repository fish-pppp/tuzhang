/**
 * Turn server / Better Auth errors into short Chinese messages for the UI.
 *
 * Server functions and Better Auth report in English ("Unauthorized",
 * "Invalid email or password"…); the app is Chinese-only, so map the common
 * ones here and fall back to the raw message (or a caller-provided default).
 */

export function isUnauthorizedError(err: unknown): boolean {
  return err instanceof Error && err.message === "Unauthorized";
}

const AUTH_MESSAGES: Array<[RegExp, string]> = [
  [/user already exists|already registered/i, "这个邮箱已经注册过了，直接登录即可"],
  [/otp expired/i, "验证码过期了，请重新发送"],
  [/invalid otp/i, "验证码不对"],
  [/too many attempts/i, "验证码试太多次了，请重新发送"],
  [/unsupported otp type/i, "验证码类型不对"],
  [/邮件服务还没配好/i, "邮件服务还没配好，暂时发不了验证码"],
  [/验证码发送失败/i, "验证码发送失败，请稍后再试"],
  [/invalid email or password|invalid password|user not found/i, "邮箱或密码不对"],
  [/invalid email/i, "邮箱格式不对"],
  [/password too short|at least 8/i, "密码至少 8 位"],
  [/password too long/i, "密码太长了"],
  [
    /invalid origin/i,
    "登录来源校验失败：当前网址不在白名单。请用和 BETTER_AUTH_URL 完全一致的地址打开（含 https，不要末尾 /）。自定义域名请写进 BETTER_AUTH_URL 或 BETTER_AUTH_TRUSTED_ORIGINS",
  ],
  [/forbidden/i, "请求被拒绝，请刷新后再试"],
  [/failed to fetch|network|load failed/i, "网络不通，请稍后再试"],
  [/too many requests|rate limit/i, "操作太频繁，稍等一下再试"],
];

/** Better Auth error → Chinese copy for the sign-in / sign-up form. */
export function friendlyAuthError(message: string | undefined | null, fallback: string): string {
  const text = (message ?? "").trim();
  if (!text) return fallback;
  for (const [pattern, copy] of AUTH_MESSAGES) {
    if (pattern.test(text)) return copy;
  }
  return text;
}

/** Any thrown value (usually from a server function) → Chinese copy. */
export function friendlyError(err: unknown, fallback = "出了点问题，请稍后再试"): string {
  if (isUnauthorizedError(err)) return "登录已过期，请重新登录";
  if (err instanceof Error && err.message) return friendlyAuthError(err.message, fallback);
  return fallback;
}
