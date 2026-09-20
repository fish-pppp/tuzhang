import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Request a password-reset OTP and wait for the mail provider to accept it.
 *
 * Better Auth's `/email-otp/request-password-reset` always returns `{ success:
 * true }` — unknown emails skip send, and sendVerificationOTP errors are
 * swallowed by `runInBackgroundOrAwait`. This function reads a per-request
 * trace so the UI can show 发送成功 or the real Resend/SMTP error.
 */
export const sendPasswordResetCode = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const parsed = z.object({ email: z.string() }).parse(data);
    const email = parsed.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("邮箱格式不对");
    }
    return { email };
  })
  .handler(async ({ data }) => {
    const { assertSameSiteRequest } = await import("./isolation.server");
    assertSameSiteRequest();

    const { resolveMailer } = await import("./otp-mail.mjs");
    const mailer = resolveMailer(process.env);
    if (mailer.kind === "none") {
      throw new Error(
        "邮件服务还没配好：Vercel 里要有 EMAIL_FROM 和 RESEND_API_KEY，保存后 Redeploy",
      );
    }
    if (mailer.kind === "invalid") {
      throw new Error(
        mailer.reason === "EMAIL_FROM is malformed"
          ? "邮件服务还没配好：EMAIL_FROM 请写成 途账 <noreply@diyforvisa.com>"
          : "邮件服务还没配好：已经有发信配置，但缺少 EMAIL_FROM",
      );
    }

    const { getRequest } = await import("@tanstack/react-start/server");
    const { auth } = await import("./server");
    const { otpSendTrace } = await import("./send-mail");

    const trace = { delivered: false, error: null as string | null };
    const request = getRequest();
    await otpSendTrace.run(trace, async () => {
      await auth.api.requestPasswordResetEmailOTP({
        body: { email: data.email },
        headers: request?.headers ?? new Headers(),
      });
    });

    if (trace.error) throw new Error(trace.error);
    if (!trace.delivered) {
      throw new Error("验证码没有发出去：这个邮箱还没注册");
    }
    return { sent: true as const };
  });
