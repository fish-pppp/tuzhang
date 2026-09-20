/**
 * Deliver a password-reset OTP. Server-only (Node net/tls + fetch).
 *
 * Prefer Resend on Vercel (HTTPS). SMTP is for QQ / 163 / self-hosted.
 * Locally, with neither configured, the code is printed to the server log.
 */
import { writeFileSync } from "node:fs";
import { createConnection } from "node:net";
import { connect as tlsConnect, type TLSSocket } from "node:tls";
import type { Socket } from "node:net";
import {
  extractEmailAddress,
  maskEmail,
  passwordResetEmail,
  resolveMailer,
} from "./otp-mail.mjs";

const SMTP_TIMEOUT_MS = 20_000;

export async function sendPasswordResetOtp(input: {
  email: string;
  otp: string;
}): Promise<void> {
  const email = input.email.trim().toLowerCase();
  const mailer = resolveMailer(process.env);
  const content = passwordResetEmail(input.otp);

  if (mailer.kind === "log") {
    console.info(`[auth] RESET_OTP ${maskEmail(email)} ${input.otp}`);
    try {
      writeFileSync(
        "/tmp/tuzhang-reset-otp.json",
        `${JSON.stringify({ email, otp: input.otp, at: Date.now() })}\n`,
      );
    } catch {
      /* ignore — log line above is enough */
    }
    return;
  }

  if (mailer.kind === "none" || mailer.kind === "invalid") {
    console.error("[auth] password-reset mail is not configured", mailer);
    throw new Error("邮件服务还没配好，暂时发不了验证码");
  }

  try {
    if (mailer.kind === "resend") {
      await sendResend({
        apiKey: mailer.apiKey,
        from: mailer.from,
        to: email,
        ...content,
      });
    } else {
      await sendSmtp({
        host: mailer.host,
        port: mailer.port,
        secure: mailer.secure,
        user: mailer.user,
        pass: mailer.pass,
        from: mailer.from,
        to: email,
        ...content,
      });
    }
  } catch (err) {
    console.error("[auth] failed to send reset OTP to", maskEmail(email), err);
    throw new Error("验证码发送失败，请稍后再试");
  }
}

async function sendResend(input: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: input.from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html,
    }),
  });
  if (response.ok) return;
  const detail = await response.text().catch(() => "");
  throw new Error(`Resend ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
}

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
};

async function sendSmtp(cfg: SmtpConfig): Promise<void> {
  await withTimeout(smtpSession(cfg), SMTP_TIMEOUT_MS, "SMTP timed out");
}

async function smtpSession(cfg: SmtpConfig): Promise<void> {
  let socket: Socket | TLSSocket = cfg.secure
    ? await connectTls(cfg.host, cfg.port)
    : await connectPlain(cfg.host, cfg.port);

  try {
    await expect(socket, 220);
    await command(socket, `EHLO tuzhang`);
    await expect(socket, 250);

    if (!cfg.secure) {
      socket = await upgradeStartTls(socket, cfg.host);
      await command(socket, `EHLO tuzhang`);
      await expect(socket, 250);
    }

    if (cfg.user) {
      await command(socket, "AUTH LOGIN");
      await expect(socket, 334);
      await command(socket, Buffer.from(cfg.user, "utf8").toString("base64"));
      await expect(socket, 334);
      await command(socket, Buffer.from(cfg.pass ?? "", "utf8").toString("base64"));
      await expect(socket, 235);
    }

    const fromAddr = extractEmailAddress(cfg.from);
    await command(socket, `MAIL FROM:<${fromAddr}>`);
    await expect(socket, 250);
    await command(socket, `RCPT TO:<${cfg.to}>`);
    await expect(socket, 250);
    await command(socket, "DATA");
    await expect(socket, 354);
    socket.write(`${buildMime(cfg)}\r\n.\r\n`);
    await expect(socket, 250);
    await command(socket, "QUIT").catch(() => undefined);
  } finally {
    socket.destroy();
  }
}

function connectPlain(host: string, port: number): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host, port }, () => resolve(socket));
    socket.once("error", reject);
  });
}

function connectTls(host: string, port: number): Promise<TLSSocket> {
  return new Promise((resolve, reject) => {
    const socket = tlsConnect({ host, port, servername: host }, () => resolve(socket));
    socket.once("error", reject);
  });
}

async function upgradeStartTls(socket: Socket, host: string): Promise<TLSSocket> {
  await command(socket, "STARTTLS");
  await expect(socket, 220);
  return new Promise((resolve, reject) => {
    const tlsSocket = tlsConnect({ socket, servername: host }, () => resolve(tlsSocket));
    tlsSocket.once("error", reject);
  });
}

function command(socket: Socket, line: string): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.write(`${line}\r\n`, (err) => (err ? reject(err) : resolve()));
  });
}

function expect(socket: Socket, code: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let buf = "";
    const onData = (chunk: Buffer) => {
      buf += chunk.toString("utf8");
      const lines = buf.split(/\r?\n/).filter((line) => line.length > 0);
      const last = lines[lines.length - 1];
      if (!last || !/^\d{3}[ -]/.test(last) || last[3] === "-") return;
      socket.off("data", onData);
      socket.off("error", onError);
      const got = Number(last.slice(0, 3));
      if (got !== code) {
        reject(new Error(`SMTP expected ${code}, got ${got}: ${last.slice(0, 120)}`));
        return;
      }
      resolve(buf);
    };
    const onError = (err: Error) => {
      socket.off("data", onData);
      reject(err);
    };
    socket.on("data", onData);
    socket.once("error", onError);
  });
}

function buildMime(cfg: SmtpConfig): string {
  const boundary = `tz${Date.now().toString(36)}`;
  const subject = `=?UTF-8?B?${Buffer.from(cfg.subject, "utf8").toString("base64")}?=`;
  return [
    `From: ${cfg.from}`,
    `To: ${cfg.to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(cfg.text, "utf8").toString("base64"),
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(cfg.html, "utf8").toString("base64"),
    `--${boundary}--`,
  ].join("\r\n");
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
