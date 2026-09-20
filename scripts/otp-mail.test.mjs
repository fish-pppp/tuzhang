import assert from "node:assert/strict";
import test from "node:test";
import {
  RESET_OTP_LENGTH,
  RESET_OTP_MINUTES,
  RESET_OTP_SECONDS,
  allowOtpLog,
  extractEmailAddress,
  formatMailerError,
  maskEmail,
  normalizeEmailFrom,
  passwordResetEmail,
  resolveMailer,
} from "../src/lib/auth/otp-mail.mjs";

test("reset OTP timing matches the copy", () => {
  assert.equal(RESET_OTP_LENGTH, 6);
  assert.equal(RESET_OTP_MINUTES, 10);
  assert.equal(RESET_OTP_SECONDS, 600);
});

test("resolveMailer prefers Resend when both providers are set", () => {
  const mailer = resolveMailer({
    RESEND_API_KEY: "re_test",
    EMAIL_FROM: "途账 <noreply@example.com>",
    SMTP_HOST: "smtp.qq.com",
    SMTP_USER: "a@qq.com",
    SMTP_PASS: "secret",
  });
  assert.deepEqual(mailer, {
    kind: "resend",
    apiKey: "re_test",
    from: "途账 <noreply@example.com>",
  });
});

test("resolveMailer reads SMTP and defaults 465 to implicit TLS", () => {
  const mailer = resolveMailer({
    SMTP_HOST: "smtp.qq.com",
    SMTP_PORT: "465",
    SMTP_USER: "a@qq.com",
    SMTP_PASS: "auth-code",
    EMAIL_FROM: "a@qq.com",
  });
  assert.equal(mailer.kind, "smtp");
  assert.equal(mailer.port, 465);
  assert.equal(mailer.secure, true);
  assert.equal(mailer.user, "a@qq.com");
});

test("resolveMailer treats 587 as STARTTLS unless SMTP_SECURE=true", () => {
  const mailer = resolveMailer({
    SMTP_HOST: "smtp.example.com",
    EMAIL_FROM: "noreply@example.com",
  });
  assert.equal(mailer.kind, "smtp");
  assert.equal(mailer.port, 587);
  assert.equal(mailer.secure, false);
});

test("envTrim strips wrapping quotes on EMAIL_FROM", () => {
  const mailer = resolveMailer({
    RESEND_API_KEY: "re_test",
    EMAIL_FROM: '"途账 <noreply@diyforvisa.com>"',
  });
  assert.equal(mailer.kind, "resend");
  assert.equal(mailer.from, "途账 <noreply@diyforvisa.com>");
});

test("normalizeEmailFrom restores a display name that lost its angle brackets", () => {
  assert.equal(
    normalizeEmailFrom("途账", { BETTER_AUTH_URL: "https://www.diyforvisa.com" }),
    "途账 <noreply@diyforvisa.com>",
  );
  assert.equal(
    normalizeEmailFrom("途账 noreply@diyforvisa.com"),
    "途账 <noreply@diyforvisa.com>",
  );
  assert.equal(
    normalizeEmailFrom("途账 &lt;noreply@diyforvisa.com&gt;"),
    "途账 <noreply@diyforvisa.com>",
  );
  assert.equal(
    normalizeEmailFrom("途账 ＜noreply@diyforvisa.com＞"),
    "途账 <noreply@diyforvisa.com>",
  );
});

test("resolveMailer rejects a display name with no mailbox", () => {
  assert.deepEqual(resolveMailer({ RESEND_API_KEY: "re_test", EMAIL_FROM: "途账" }), {
    kind: "invalid",
    reason: "EMAIL_FROM is malformed",
  });
});

test("formatMailerError explains a Resend unverified domain", () => {
  const message = formatMailerError(
    'Resend 403: {"statusCode":403,"message":"The diyforvisa.com domain is not verified. Please, add and verify your domain on https://resend.com/domains"}',
  );
  assert.match(message, /发件域名还没在 Resend 验证通过/);
  assert.match(message, /diyforvisa.com/);
});

test("formatMailerError explains a bad API key", () => {
  assert.match(
    formatMailerError("Resend 401: {\"message\":\"Invalid API key\"}"),
    /API Key 无效/,
  );
});

test("resolveMailer rejects a half-configured provider", () => {
  assert.deepEqual(resolveMailer({ RESEND_API_KEY: "re_test" }), {
    kind: "invalid",
    reason: "EMAIL_FROM is required",
  });
});

test("allowOtpLog is off on Vercel unless explicitly enabled", () => {
  assert.equal(allowOtpLog({ VERCEL: "1" }), false);
  assert.equal(allowOtpLog({ VERCEL: "1", EMAIL_OTP_ALLOW_LOG: "true" }), true);
  assert.equal(allowOtpLog({ NODE_ENV: "production" }), false);
  assert.equal(allowOtpLog({ NODE_ENV: "development" }), true);
  assert.equal(allowOtpLog({}), true);
});

test("resolveMailer logs locally and refuses production without a provider", () => {
  assert.deepEqual(resolveMailer({ NODE_ENV: "development" }), { kind: "log" });
  assert.deepEqual(resolveMailer({ NODE_ENV: "production" }), { kind: "none" });
});

test("extractEmailAddress and maskEmail", () => {
  assert.equal(extractEmailAddress("途账 <noreply@example.com>"), "noreply@example.com");
  assert.equal(extractEmailAddress("you@email.com"), "you@email.com");
  assert.equal(maskEmail("you@email.com"), "yo***@email.com");
  assert.equal(maskEmail("a@x.io"), "a*@x.io");
  assert.equal(maskEmail("not-an-email"), "***");
});

test("password reset email includes the OTP in subject and body", () => {
  const mail = passwordResetEmail("483920");
  assert.match(mail.subject, /483920/);
  assert.match(mail.text, /483920/);
  assert.match(mail.html, /483920/);
  assert.match(mail.text, /10 分钟/);
});

test("OTP Better Auth errors match the Chinese copy patterns", () => {
  const cases = [
    ["OTP expired", /otp expired/i],
    ["Invalid OTP", /invalid otp/i],
    ["Too many attempts", /too many attempts/i],
  ];
  for (const [message, pattern] of cases) {
    assert.match(message, pattern);
  }
});
