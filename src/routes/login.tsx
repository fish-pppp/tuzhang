import { createFileRoute, Link } from "@tanstack/react-router";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 py-12">
      <div className="w-full max-w-sm rounded-2xl bg-surface p-6 shadow-card sm:p-8">
        <p className="text-xs font-medium tracking-[0.18em] text-muted uppercase">
          途账
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
          登录后云端保存
        </h1>
        <p className="mt-2 text-sm text-muted">
          不登录也能先记这一趟的账。登录后，账单会跟账号一起走。
        </p>
        <div className="mt-6 space-y-2">
          {authEnabled ? (
            GROK_PROVIDERS.map((p) => (
              <Button
                key={p.providerId}
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => signIn(p.providerId, { callbackURL: "/" })}
              >
                使用 {p.label} 继续
              </Button>
            ))
          ) : (
            <p className="text-sm text-muted">登录已关闭。</p>
          )}
        </div>
        <Link
          to="/"
          className="mt-5 inline-flex text-sm text-muted underline-offset-4 hover:text-fg hover:underline"
        >
          先不登录，直接记账
        </Link>
      </div>
    </main>
  );
}
