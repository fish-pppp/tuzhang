import { Link } from "@tanstack/react-router";
import { signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export function AuthSlot() {
  const { user, isPending } = useCurrentUserState();

  if (isPending) {
    return <div className="h-9 w-16 animate-pulse rounded-full bg-chip" />;
  }

  if (user) {
    const label = user.displayName ?? user.primaryEmail ?? "已登录";
    return (
      <div className="flex items-center gap-2">
        {user.profileImageUrl ? (
          <img
            src={user.profileImageUrl}
            alt=""
            className="size-8 rounded-full object-cover outline outline-1 -outline-offset-1 outline-fg/10"
            crossOrigin="anonymous"
          />
        ) : (
          <span className="grid size-8 place-items-center rounded-full bg-chip text-xs font-medium">
            {label.slice(0, 1)}
          </span>
        )}
        <button
          type="button"
          onClick={() => void signOut()}
          className="text-sm text-muted underline-offset-4 hover:text-fg hover:underline"
        >
          退出
        </button>
      </div>
    );
  }

  return (
    <Link
      to="/login"
      className="inline-flex h-9 items-center rounded-full bg-chip px-3 text-sm font-medium text-fg transition-colors hover:bg-border"
    >
      登录
    </Link>
  );
}
