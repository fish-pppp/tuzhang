import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ProfileDialog } from "@/components/profile-dialog";
import { signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export function AuthSlot() {
  const { user, isPending } = useCurrentUserState();
  const [profileOpen, setProfileOpen] = useState(false);

  if (isPending) {
    return <div className="h-9 w-16 animate-pulse rounded-full bg-chip" />;
  }

  if (user) {
    const label = user.displayName ?? user.primaryEmail ?? "已登录";
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setProfileOpen(true)}
          className="flex items-center gap-2 rounded-full py-0.5 pr-1 pl-0.5 hover:bg-chip"
          aria-label="更换头像"
        >
          {user.profileImageUrl ? (
            <img
              src={user.profileImageUrl}
              alt=""
              className="size-8 rounded-full object-cover outline outline-1 -outline-offset-1 outline-fg/10"
            />
          ) : (
            <span className="grid size-8 place-items-center rounded-full bg-chip text-xs font-medium">
              {label.slice(0, 1)}
            </span>
          )}
          <span className="hidden max-w-32 truncate text-sm font-medium sm:inline" title={label}>
            {label}
          </span>
        </button>
        <button
          type="button"
          onClick={() => void signOut()}
          className="text-sm text-muted underline-offset-4 hover:text-fg hover:underline"
        >
          退出
        </button>
        <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
      </div>
    );
  }

  return (
    <Link
      to="/login"
      search={{ redirect: undefined }}
      className="inline-flex h-9 items-center rounded-full bg-chip px-3 text-sm font-medium text-fg transition-colors hover:bg-border"
    >
      登录
    </Link>
  );
}
