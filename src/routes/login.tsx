import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, authEnabled } from "@/lib/auth/client";
import { emailAndPasswordEnabled } from "@/lib/auth/email-password";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { friendlyAuthError } from "@/lib/errors";
import { resolvePostLoginPath } from "@/lib/split/home-path";

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("登录超时，请再试一次")), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export const Route = createFileRoute("/login")({
  validateSearch: (raw: Record<string, unknown>) => ({
    redirect:
      typeof raw.redirect === "string" && raw.redirect.startsWith("/") ? raw.redirect : undefined,
  }),
  component: Login,
});

function Login() {
  const { redirect } = Route.useSearch();
  const { user, isPending: sessionPending } = useCurrentUserState();
  const userId = user?.id ?? null;
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const emailLoginOn = authEnabled && emailAndPasswordEnabled;
  const forgot = mode === "forgot";

  // Already signed in (e.g. pressed Back onto /login): skip the form.
  // Depend on `userId`, not the user object — `useCurrentUserState` builds a
  // new object every render, and that cleanup was cancelling the redirect.
  useEffect(() => {
    if (sessionPending || !userId || pending) return;
    let cancelled = false;
    void resolvePostLoginPath(redirect).then((path) => {
      if (!cancelled) window.location.replace(path);
    });
    return () => {
      cancelled = true;
    };
  }, [pending, redirect, sessionPending, userId]);

  async function onEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || password.length < 8) {
      setError("请填写邮箱，密码至少 8 位");
      return;
    }
    if (mode === "signup" && !name.trim()) {
      setError("请填写你的名字");
      return;
    }
    setPending(true);
    try {
      const fetchOptions = { timeout: 12_000 };
      if (mode === "signup") {
        const { error: signUpError } = await authClient.signUp.email({
          email: email.trim(),
          password,
          name: name.trim(),
          fetchOptions,
        });
        if (signUpError) throw new Error(friendlyAuthError(signUpError.message, "注册失败"));
      } else {
        const { error: signInError } = await authClient.signIn.email({
          email: email.trim(),
          password,
          fetchOptions,
        });
        if (signInError) throw new Error(friendlyAuthError(signInError.message, "登录失败"));
      }
      // The session cookie is already set. A follow-up getSession can stay
      // pending forever if that request is aborted, which left the button on
      // “请稍候…”. Open the book directly, and if that lookup stalls, reload
      // home so the cookie can finish signing in.
      try {
        window.location.href = await withTimeout(resolvePostLoginPath(redirect), 12_000);
      } catch {
        window.location.href =
          redirect && redirect.startsWith("/") && redirect !== "/" ? redirect : "/";
      }
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : null;
      const timedOut = message != null && /abort|timed out|timeout|登录超时/i.test(message);
      setError(timedOut ? "登录超时，请再试一次" : friendlyAuthError(message, "登录失败"));
    }
    setPending(false);
  }

  return (
    <main className="grid min-h-dvh place-items-center px-6 py-12">
      <div className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-card sm:p-8">
        <p className="text-xs font-medium tracking-[0.18em] text-muted uppercase">途账</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
          {forgot ? "找回密码" : "登录后进入你的账本"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {forgot
            ? "输入邮箱，我们会发 6 位验证码。用验证码就能设新密码。"
            : "用邮箱注册或登录。登录后会打开你创建的分组；也可以再新建或加入别人的群。"}
        </p>

        {emailLoginOn && forgot ? (
          <ForgotPasswordForm
            email={email}
            onEmailChange={setEmail}
            onBack={() => {
              setMode("signin");
              setError(null);
              setPassword("");
            }}
          />
        ) : emailLoginOn ? (
          <div className="mt-6">
            <div className="mb-3 flex rounded-full bg-chip p-1">
              <button
                type="button"
                onClick={() => setMode("signin")}
                className={
                  mode === "signin"
                    ? "h-10 flex-1 rounded-full bg-surface text-sm font-medium shadow-card"
                    : "h-10 flex-1 rounded-full text-sm text-muted"
                }
              >
                登录
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={
                  mode === "signup"
                    ? "h-10 flex-1 rounded-full bg-surface text-sm font-medium shadow-card"
                    : "h-10 flex-1 rounded-full text-sm text-muted"
                }
              >
                注册
              </button>
            </div>
            <form onSubmit={(e) => void onEmail(e)} className="space-y-3">
              {mode === "signup" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="name">名字</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="同行怎么叫你"
                    maxLength={40}
                    autoComplete="name"
                  />
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor="email">邮箱</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="password">密码</Label>
                  {mode === "signin" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setMode("forgot");
                        setError(null);
                      }}
                      className="text-xs text-muted underline-offset-4 hover:text-fg hover:underline"
                    >
                      忘记密码
                    </button>
                  ) : null}
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少 8 位"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                />
              </div>
              {error ? <p className="text-sm text-owe">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "请稍候…" : mode === "signup" ? "注册并进入" : "登录"}
              </Button>
            </form>
          </div>
        ) : (
          <p className="mt-6 text-sm text-muted">登录已关闭。</p>
        )}

        <Link
          to="/"
          search={{ demo: true }}
          className="mt-5 inline-flex text-sm text-muted underline-offset-4 hover:text-fg hover:underline"
        >
          先不登录，看示例
        </Link>
      </div>
    </main>
  );
}
