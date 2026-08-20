import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  GROK_PROVIDERS,
  authClient,
  authEnabled,
  signIn,
} from "@/lib/auth/client";
import { emailAndPasswordEnabled } from "@/lib/auth/email-password";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  validateSearch: (raw: Record<string, unknown>) => ({
    redirect:
      typeof raw.redirect === "string" && raw.redirect.startsWith("/")
        ? raw.redirect
        : undefined,
  }),
  component: Login,
});

function Login() {
  const { redirect } = Route.useSearch();
  const callbackURL = redirect ?? "/";
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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
      if (mode === "signup") {
        const { error: signUpError } = await authClient.signUp.email({
          email: email.trim(),
          password,
          name: name.trim(),
        });
        if (signUpError) throw new Error(signUpError.message ?? "注册失败");
      } else {
        const { error: signInError } = await authClient.signIn.email({
          email: email.trim(),
          password,
        });
        if (signInError) throw new Error(signInError.message ?? "登录失败");
      }
      await authClient.getSession();
      window.location.href = callbackURL;
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center px-6 py-12">
      <div className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-card sm:p-8">
        <p className="text-xs font-medium tracking-[0.18em] text-muted uppercase">
          途账
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
          登录后一起记账
        </h1>
        <p className="mt-2 text-sm text-muted">
          每个人用自己的账号。建一个群、发邀请码，同行就能加入，一起记垫付和 AA。
        </p>
        <div className="mt-6 space-y-2">
          {authEnabled ? (
            GROK_PROVIDERS.map((p) => (
              <Button
                key={p.providerId}
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => signIn(p.providerId, { callbackURL })}
              >
                使用 {p.label} 继续
              </Button>
            ))
          ) : (
            <p className="text-sm text-muted">登录已关闭。</p>
          )}
        </div>

        {authEnabled && emailAndPasswordEnabled ? (
          <>
            <div className="my-5 flex items-center gap-3 text-xs text-subtle">
              <span className="h-px flex-1 bg-border" />
              或用邮箱
              <span className="h-px flex-1 bg-border" />
            </div>
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
                <Label htmlFor="password">密码</Label>
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
          </>
        ) : null}

        <Link
          to="/"
          className="mt-5 inline-flex text-sm text-muted underline-offset-4 hover:text-fg hover:underline"
        >
          先不登录，看示例
        </Link>
      </div>
    </main>
  );
}
