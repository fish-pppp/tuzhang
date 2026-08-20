import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, LogIn, Plus, UserPlus } from "lucide-react";
import { CreateGroupDialog, JoinGroupDialog } from "@/components/group-dialogs";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { listMyGroups } from "@/lib/split/group-api";
import { cn } from "@/lib/utils";

export function GroupSwitcher({
  currentLabel,
  currentGroupId,
}: {
  currentLabel: string;
  currentGroupId?: string | null;
}) {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  const groupsQuery = useQuery({
    queryKey: ["groups"],
    queryFn: () => listMyGroups(),
    enabled: Boolean(user),
  });
  const groups = groupsQuery.data ?? [];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className="inline-flex max-w-full items-center gap-1 rounded-full bg-chip px-3 py-1 text-sm font-medium text-fg"
      >
        <span className="truncate">{currentLabel}</span>
        <ChevronDown className="size-4 shrink-0 text-muted" />
      </button>
      {menuOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-30 cursor-default"
            aria-label="关闭菜单"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute top-full left-0 z-40 mt-2 w-72 rounded-xl bg-surface p-2 shadow-card-hover">
            <Link
              to="/"
              onClick={() => setMenuOpen(false)}
              className={cn(
                "flex items-center justify-between rounded-lg px-3 py-2.5 text-sm",
                !currentGroupId ? "bg-chip" : "hover:bg-chip/70",
              )}
            >
              <span>示例 · 本地演示</span>
              {!currentGroupId && <Check className="size-4 text-primary" />}
            </Link>
            {groups.length > 0 && (
              <p className="mt-2 px-3 pb-1 text-xs text-muted">我的群组</p>
            )}
            {groups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  void navigate({ to: "/g/$groupId", params: { groupId: g.id } });
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm",
                  currentGroupId === g.id ? "bg-chip" : "hover:bg-chip/70",
                )}
              >
                <span className="truncate">{g.name}</span>
                <span className="ml-2 shrink-0 text-xs text-subtle">
                  {g.memberCount} 人
                  {g.myNetCents > 0
                    ? " · 收"
                    : g.myNetCents < 0
                      ? " · 付"
                      : ""}
                </span>
              </button>
            ))}
            <div className="my-1 h-px bg-border" />
            {isPending ? (
              <div className="h-9 rounded-lg bg-chip" />
            ) : user ? (
              <>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm hover:bg-chip/70"
                  onClick={() => {
                    setMenuOpen(false);
                    setCreateOpen(true);
                  }}
                >
                  <Plus className="size-4" />
                  新建群组
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm hover:bg-chip/70"
                  onClick={() => {
                    setMenuOpen(false);
                    setJoinOpen(true);
                  }}
                >
                  <UserPlus className="size-4" />
                  加入群组
                </button>
              </>
            ) : (
              <Link
                to="/login"
                search={{ redirect: undefined }}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm hover:bg-chip/70"
              >
                <LogIn className="size-4" />
                登录后建群、邀请朋友
              </Link>
            )}
          </div>
        </>
      )}
      <CreateGroupDialog open={createOpen} onOpenChange={setCreateOpen} />
      <JoinGroupDialog open={joinOpen} onOpenChange={setJoinOpen} />
    </div>
  );
}
