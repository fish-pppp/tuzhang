import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordResetCode, resetPasswordWithCode } from "@/lib/auth/client";
import { RESET_OTP_LENGTH } from "@/lib/auth/otp-mail.mjs";
import { friendlyAuthError } from "@/lib/errors";

const RESEND_COOLDOWN_SEC = 60;

export function ForgotPasswordForm({
  email,
  onEmailChange,
  onBack,
}: {
  email: string;
  onEmailChange: (email: string) => void;
  onBack: () => void;
}) {
  const [step, setStep] = useState<"email" | "code" | "done">("email");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function sendCode() {
    setError(null);
    const trimmed = email.trim();
    if (!trimmed.includes("@")) {
      setError("请填写邮箱");
      return;
    }
    setPending(true);
    try {
      await requestPasswordResetCode(trimmed);
      setStep("code");
      setCooldown(RESEND_COOLDOWN_SEC);
    } catch (err) {
      setError(
        friendlyAuthError(err instanceof Error ? err.message : null, "验证码发送失败，请稍后再试"),
      );
    } finally {
      setPending(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step === "email") {
      await sendCode();
      return;
    }
    if (step !== "code") return;

    setError(null);
    if (!/^\d{6}$/.test(otp.trim())) {
      setError("请填写邮箱里的 6 位验证码");
      return;
    }
    if (password.length < 8) {
      setError("密码至少 8 位");
      return;
    }
    if (password !== confirm) {
      setError("两次输入的密码不一样");
      return;
    }

    setPending(true);
    try {
      await resetPasswordWithCode({
        email: email.trim(),
        otp: otp.trim(),
        password,
      });
      setStep("done");
    } catch (err) {
      setError(friendlyAuthError(err instanceof Error ? err.message : null, "改密码失败"));
    } finally {
      setPending(false);
    }
  }

  if (step === "done") {
    return (
      <div className="mt-6 space-y-4">
        <p className="text-sm text-receive">密码已经改好，请用新密码登录。</p>
        <Button type="button" className="w-full" onClick={onBack}>
          去登录
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="mt-6 space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="reset-email">邮箱</Label>
        <Input
          id="reset-email"
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          placeholder="you@email.com"
          autoComplete="email"
          disabled={step === "code"}
        />
      </div>

      {step === "code" ? (
        <>
          <p className="text-sm text-muted">
            如果这个邮箱已经注册，验证码会发到收件箱（也看一眼垃圾箱）。
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="reset-otp">验证码</Label>
            <Input
              id="reset-otp"
              name="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={RESET_OTP_LENGTH}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, RESET_OTP_LENGTH))}
              placeholder="6 位数字"
              className="tracking-[0.3em]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reset-password">新密码</Label>
            <Input
              id="reset-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 8 位"
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reset-confirm">再输一次</Label>
            <Input
              id="reset-confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="确认新密码"
              autoComplete="new-password"
            />
          </div>
        </>
      ) : null}

      {error ? <p className="text-sm text-owe">{error}</p> : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "请稍候…" : step === "email" ? "发送验证码" : "改好密码"}
      </Button>

      {step === "code" ? (
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          disabled={pending || cooldown > 0}
          onClick={() => void sendCode()}
        >
          {cooldown > 0 ? `重新发送（${cooldown}s）` : "重新发送"}
        </Button>
      ) : null}

      <button
        type="button"
        onClick={onBack}
        className="block w-full text-center text-sm text-muted underline-offset-4 hover:text-fg hover:underline"
      >
        返回登录
      </button>
    </form>
  );
}
