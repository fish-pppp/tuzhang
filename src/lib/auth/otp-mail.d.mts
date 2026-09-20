export const RESET_OTP_MINUTES: number;
export const RESET_OTP_SECONDS: number;
export const RESET_OTP_LENGTH: number;

export type Mailer =
  | { kind: "resend"; apiKey: string; from: string }
  | {
      kind: "smtp";
      host: string;
      port: number;
      secure: boolean;
      user?: string;
      pass?: string;
      from: string;
    }
  | { kind: "log" }
  | { kind: "none" }
  | { kind: "invalid"; reason: string };

export function envTrim(
  env: Record<string, string | undefined>,
  key: string,
): string | undefined;
export function allowOtpLog(env: Record<string, string | undefined>): boolean;
export function resolveMailer(env: Record<string, string | undefined>): Mailer;
export function extractEmailAddress(from: string): string;
export function maskEmail(email: string): string;
export function passwordResetEmail(otp: string): {
  subject: string;
  text: string;
  html: string;
};
