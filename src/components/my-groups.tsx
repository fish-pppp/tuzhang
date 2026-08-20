import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, UserPlus } from "lucide-react";
import { useState } from "react";
import { CreateGroupDialog, JoinGroupDialog } from "@/components/group-dialogs";
import { Button } from "@/components/ui/button";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { listMyGroups } from "@/lib/split/group-api";
import { formatMoney } from "@/lib/split/money";
import { cn } from "@/lib/utils";

export function MyGroupsPanel() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const groupsQuery = useQuery({
    queryKey: ["groups"],
    queryFn: () => listMyGroups(),
    enabled: Boolean(user),
  });
  const groups = groupsQuery.data ?? [];

  if (isPending) {
    return (
      <section className="mb-6 rounded-2xl bg-surface p-4 shadow-card sm:p-5">
        <h2 className="font-display text-lg font-semibold">和朋友一起记</h2>
        <p className="mt-1 text-sm text-muted">
          登录后建一个群，把邀请码发给同行。每个人用自己的账号加入，一起记垫付和 AA。
        </p>
        <div className="mt-3 h-10 w-28 animate-pulse rounded-full bg-chip" />
      </section>
    );
  }

  if (!user) {
    return (
      <section className="mb-6 rounded-2xl bg-surface p-4 shadow-card sm:p-5">
        <h2 className="font-display text-lg font-semibold">和朋友一起记</h2>
        <p className="mt-1 text-sm text-muted">
          登录后建一个群，把邀请码发给同行。每个人用自己的账号加入，一起记垫付和 AA。
        </p>
        <Link
          to="/login"
          search={{ redirect: undefined }}
          className="mt-3 inline-flex h-11 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-fg"
        >
          登录后建群
        </Link>
      </section>
    );
  }

  return (
    <section className="mb-6 rounded-2xl bg-surface p-4 shadow-card sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold">我的群组</h2>
          <p className="text-xs text-muted">真实账号协作，下面示例只存在这台设备。</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="sm" onClick={() => setJoinOpen(true)}>
            <UserPlus className="size-3.5" />
            加入
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" />
            新建
          </Button>
        </div>
      </div>

      {groupsQuery.isPending ? (
        <div className="h-20 animate-pulse rounded-xl bg-chip" />
      ) : groups.length === 0 ? (
        <p className="rounded-xl bg-bg-elevated px-3 py-4 text-sm text-muted">
          还没有群。建一个，邀请朋友用各自的账号进来记账。
        </p>
      ) : (
        <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {groups.map((g) => (
            <li key={g.id} className="min-w-44 shrink-0">
              <button
                type="button"
                onClick={() =>
                  void navigate({ to: "/g/$groupId", params: { groupId: g.id } })
                }
                className="flex h-full w-full flex-col rounded-xl bg-bg-elevated px-3 py-3 text-left hover:bg-chip"
              >
                <span className="truncate font-medium">{g.name}</span>
                <span className="mt-1 text-xs text-muted">
                  {g.memberCount} 人 · {g.expenseCount} 笔
                </span>
                <span
                  className={cn(
                    "mt-2 text-sm font-medium tabular-nums",
                    g.myNetCents > 0 && "text-receive",
                    g.myNetCents < 0 && "text-owe",
                    g.myNetCents === 0 && "text-subtle",
                  )}
                >
                  {g.expenseCount === 0
                    ? "还没记账"
                    : g.myNetCents > 0
                      ? `我应收 ${formatMoney(g.myNetCents)}`
                      : g.myNetCents < 0
                        ? `我还要付 ${formatMoney(-g.myNetCents)}`
                        : "已结清"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {groups.length > 0 ? (
        <p className="mt-3 text-xs text-subtle">点进群组后，切到「与我相关」看你垫的和要摊的。</p>
      ) : null}

      <CreateGroupDialog open={createOpen} onOpenChange={setCreateOpen} />
      <JoinGroupDialog open={joinOpen} onOpenChange={setJoinOpen} />
    </section>
  );
}
