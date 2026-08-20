import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Copy, Plus, RotateCcw, Users } from "lucide-react";
import { AddExpenseDialog } from "@/components/add-expense-dialog";
import { AuthSlot } from "@/components/auth-slot";
import { GroupMembersDialog } from "@/components/group-members-dialog";
import { GroupSwitcher } from "@/components/group-switcher";
import { MemberAvatar } from "@/components/member-avatar";
import { MembersDialog } from "@/components/members-dialog";
import { MyGroupsPanel } from "@/components/my-groups";
import { MyLedger } from "@/components/my-ledger";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { computeLedger, expenseInvolves } from "@/lib/split/calc";
import { formatMoney } from "@/lib/split/money";
import { useTripStore } from "@/lib/split/store";
import { useTripSync } from "@/lib/split/use-trip-sync";
import type { Expense, Trip } from "@/lib/split/types";
import { cn } from "@/lib/utils";

export type TripViewProps = {
  trip: Trip;
  meId: string | null;
  variant: "demo" | "group";
  inviteCode?: string;
  groupId?: string;
  createdBy?: string;
  onRename: (name: string) => void;
  onAddExpense: (input: Omit<Expense, "id" | "createdAt">) => void | Promise<void>;
  onRemoveExpense: (id: string) => void | Promise<void>;
  onSetMe?: (id: string) => void;
  onLeave?: () => void;
  onUpdateMyName?: (name: string) => void | Promise<void>;
};

export function TripView({
  trip,
  meId,
  variant,
  inviteCode,
  createdBy,
  onRename,
  onAddExpense,
  onRemoveExpense,
  onSetMe,
  onLeave,
  onUpdateMyName,
}: TripViewProps) {
  const [tab, setTab] = useState<"all" | "mine">("all");
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(meId);
  const [copied, setCopied] = useState(false);

  const ledger = useMemo(() => computeLedger(trip), [trip]);
  const byId = useMemo(
    () => Object.fromEntries(ledger.perPerson.map((p) => [p.memberId, p])),
    [ledger],
  );
  const memberMap = useMemo(
    () => Object.fromEntries(trip.members.map((m) => [m.id, m])),
    [trip.members],
  );
  const avgCents =
    trip.members.length > 0
      ? Math.round(ledger.totalCents / trip.members.length)
      : 0;

  const focusId = tab === "mine" ? meId : selectedMemberId;
  const visibleExpenses = focusId
    ? trip.expenses.filter((e) => expenseInvolves(e, focusId))
    : trip.expenses;
  const selectedName = focusId ? memberMap[focusId]?.name : null;
  const emptyGroup = variant === "group" && trip.expenses.length === 0;

  async function copyInvite() {
    if (!inviteCode) return;
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/join/${inviteCode}`
        : inviteCode;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="relative mx-auto min-h-dvh max-w-5xl px-4 pb-28 pt-6 sm:px-6">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <p className="text-xs font-medium tracking-[0.18em] text-muted uppercase">
              途账
            </p>
            <GroupSwitcher
              currentLabel={variant === "group" ? "群组" : "示例"}
              currentGroupId={variant === "group" ? trip.id : null}
            />
          </div>
          <input
            value={trip.name}
            onChange={(e) => onRename(e.target.value)}
            className="w-full max-w-md bg-transparent font-display text-3xl font-semibold tracking-tight text-fg outline-none sm:text-4xl"
            aria-label="旅行或群组名称"
          />
          <p className="mt-1 text-sm text-muted">
            {trip.members.length} 人同行
            {variant === "demo" ? " · 本地示例，可随便改" : " · 登录账号一起记"}
          </p>
          {inviteCode ? (
            <button
              type="button"
              onClick={() => void copyInvite()}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-chip px-3 py-1 text-xs font-medium text-muted hover:text-fg"
            >
              <Copy className="size-3" />
              {copied ? "已复制邀请链接" : `邀请码 ${inviteCode}`}
            </button>
          ) : null}
        </div>
        <AuthSlot />
      </header>

      {variant === "demo" ? <MyGroupsPanel /> : null}

      <div className="mb-5 flex rounded-full bg-chip p-1">
        <TabButton active={tab === "all"} onClick={() => setTab("all")}>
          全员
        </TabButton>
        <TabButton active={tab === "mine"} onClick={() => setTab("mine")}>
          与我相关
        </TabButton>
      </div>

      {tab === "mine" && !meId ? (
        <section className="rounded-2xl bg-surface p-5 shadow-card">
          <h2 className="font-display text-lg font-semibold">你是谁？</h2>
          <p className="mt-1 text-sm text-muted">
            先点一个头像，标记成你自己，就能看到你垫了什么、还要摊什么。
          </p>
          <ul className="mt-4 flex flex-wrap gap-3">
            {trip.members.map((member) => (
              <li key={member.id}>
                <button
                  type="button"
                  onClick={() => onSetMe?.(member.id)}
                  className="flex w-20 flex-col items-center gap-2 rounded-xl px-2 py-2 hover:bg-chip"
                >
                  <MemberAvatar member={member} size="lg" />
                  <span className="text-xs font-medium">{member.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tab === "mine" && meId ? <MyLedger trip={trip} meId={meId} /> : null}

      {tab === "all" ? (
        <>
          {emptyGroup ? (
            <section className="mb-6 rounded-2xl bg-surface p-4 shadow-card sm:p-5">
              <h2 className="font-display text-lg font-semibold">群刚建好</h2>
              <p className="mt-1 text-sm text-muted">
                把邀请码发给同行。他们登录后加入，就会用自己的账号出现在上面，一起记账。
              </p>
              {inviteCode ? (
                <button
                  type="button"
                  onClick={() => void copyInvite()}
                  className="mt-3 inline-flex items-center gap-2 rounded-full bg-chip px-4 py-2 text-sm font-medium"
                >
                  <Copy className="size-4" />
                  {copied ? "已复制邀请链接" : `复制邀请 · ${inviteCode}`}
                </button>
              ) : null}
            </section>
          ) : null}

          <section className="-mx-4 mb-6 overflow-x-auto px-4 pb-2 sm:mx-0 sm:overflow-visible sm:px-0">
            <ul className="flex min-w-max gap-2 sm:min-w-0 sm:justify-between">
              {trip.members.map((member, i) => {
                const row = byId[member.id];
                const net = row?.netCents ?? 0;
                const selected = selectedMemberId === member.id;
                const isMe = meId === member.id;
                return (
                  <li
                    key={member.id}
                    className="stagger-item min-w-16 flex-1"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedMemberId((id) => (id === member.id ? null : member.id))
                      }
                      className={cn(
                        "flex w-full flex-col items-center gap-2 rounded-xl px-1 py-2 transition-colors duration-150",
                        selected ? "bg-chip" : "hover:bg-chip/70",
                      )}
                    >
                      <MemberAvatar member={member} size="lg" selected={selected} />
                      <span className="max-w-full truncate px-0.5 text-center text-xs font-medium whitespace-nowrap sm:text-sm">
                        {member.name}
                        {isMe ? " ·我" : ""}
                      </span>
                      <span
                        className={cn(
                          "text-xs tabular-nums",
                          net > 0 && "text-receive",
                          net < 0 && "text-owe",
                          net === 0 && "text-subtle",
                        )}
                      >
                        {net > 0 && "收 "}
                        {net < 0 && "付 "}
                        {net === 0 ? "平" : formatMoney(Math.abs(net))}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="mb-6 grid grid-cols-3 gap-2 sm:gap-3">
            <StatCard label="总支出" value={formatMoney(ledger.totalCents)} />
            <StatCard label="人均" value={formatMoney(avgCents)} />
            <StatCard
              label="待结清"
              value={formatMoney(ledger.unsettledCents)}
              hint={ledger.transfers.length === 0 ? "已结清" : `${ledger.transfers.length} 笔`}
            />
          </section>

          <div className="grid gap-4 lg:grid-cols-5">
            <section className="rounded-2xl bg-surface p-4 shadow-card lg:col-span-3 lg:p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold">每个人</h2>
                <Button variant="ghost" size="sm" onClick={() => setMembersOpen(true)}>
                  <Users className="size-4" />
                  {variant === "demo" ? "管理" : "成员"}
                </Button>
              </div>
              <ul className="divide-y divide-border">
                {trip.members.map((member) => {
                  const row = byId[member.id];
                  if (!row) return null;
                  const selected = selectedMemberId === member.id;
                  const isMe = meId === member.id;
                  return (
                    <li key={member.id}>
                      <div
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-1 py-3",
                          selected ? "bg-chip" : "",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedMemberId((id) =>
                              id === member.id ? null : member.id,
                            )
                          }
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <MemberAvatar member={member} size="md" selected={selected} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="font-medium">
                                {member.name}
                                {isMe ? (
                                  <span className="ml-1 text-xs font-normal text-muted">我</span>
                                ) : null}
                              </span>
                              {row.netCents > 0 && (
                                <Badge variant="receive">应收 {formatMoney(row.netCents)}</Badge>
                              )}
                              {row.netCents < 0 && (
                                <Badge variant="owe">还要付 {formatMoney(-row.netCents)}</Badge>
                              )}
                              {row.netCents === 0 && <Badge variant="settled">已结清</Badge>}
                            </div>
                            <p className="mt-1 text-xs text-muted tabular-nums">
                              已付 {formatMoney(row.paidCents)} · 应付 {formatMoney(row.shareCents)}
                            </p>
                          </div>
                        </button>
                        {onSetMe && !isMe ? (
                          <button
                            type="button"
                            onClick={() => onSetMe(member.id)}
                            className="shrink-0 px-2 text-xs text-muted hover:text-fg"
                          >
                            这是我
                          </button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="rounded-2xl bg-surface p-4 shadow-card lg:col-span-2 lg:p-5">
              <h2 className="mb-4 font-display text-lg font-semibold">怎么还</h2>
              {ledger.transfers.length === 0 ? (
                <p className="text-sm text-muted">账单已结清，没有人还要付钱。</p>
              ) : (
                <ul className="space-y-3">
                  {ledger.transfers.map((t) => {
                    const from = memberMap[t.fromId];
                    const to = memberMap[t.toId];
                    if (!from || !to) return null;
                    return (
                      <li
                        key={`${t.fromId}-${t.toId}`}
                        className="flex items-center gap-2 rounded-lg bg-bg-elevated px-3 py-2.5"
                      >
                        <MemberAvatar member={from} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">
                            <span className="font-medium">{from.name}</span>
                            <ArrowRight className="mx-1 inline size-3.5 text-subtle" />
                            <span className="font-medium">{to.name}</span>
                          </p>
                          <p className="text-xs text-muted tabular-nums">
                            转 {formatMoney(t.cents)}
                          </p>
                        </div>
                        <MemberAvatar member={to} size="sm" />
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </>
      ) : null}

      {tab === "all" ? (
        <section className="mt-4 rounded-2xl bg-surface p-4 shadow-card lg:p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold">
              账单
              {selectedName ? (
                <span className="ml-2 text-sm font-normal text-muted">
                  · {selectedName} 相关
                </span>
              ) : null}
            </h2>
            {variant === "demo" ? <DemoBillActions /> : null}
          </div>
          {visibleExpenses.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">
              {trip.expenses.length === 0
                ? "还没有支出。点右下角记一笔。"
                : "这个人暂时没有相关账单。"}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {visibleExpenses.map((expense) => {
                const payer = memberMap[expense.payerId];
                const n = expense.participantIds.length;
                return (
                  <li key={expense.id} className="flex items-start gap-3 py-3">
                    <MemberAvatar
                      member={payer ?? { id: "x", name: "?", avatar: null }}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="truncate font-medium">{expense.title}</p>
                        <p className="shrink-0 font-medium tabular-nums">
                          {formatMoney(expense.amountCents)}
                        </p>
                      </div>
                      <p className="mt-0.5 text-xs text-muted">
                        {payer?.name ?? "未知"} 付 · {n} 人 AA
                        {n > 0 && (
                          <span className="tabular-nums">
                            {" "}
                            · {formatMoney(Math.round(expense.amountCents / n))}/人
                          </span>
                        )}
                      </p>
                      <div className="mt-2 flex -space-x-1.5">
                        {expense.participantIds.slice(0, 8).map((id) => {
                          const m = memberMap[id];
                          if (!m) return null;
                          return (
                            <MemberAvatar
                              key={id}
                              member={m}
                              size="sm"
                              className="size-6 outline-surface"
                            />
                          );
                        })}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void onRemoveExpense(expense.id)}
                      className="mt-1 min-h-10 text-xs text-subtle hover:text-owe"
                    >
                      删除
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      <Separator className="my-8" />
      <p className="pb-2 text-center text-xs text-subtle">
        {variant === "demo"
          ? "这是示例。登录后可建群，邀请朋友用各自的账号一起记。"
          : "群里每个人登录后都能记账，结余会一起更新。"}
      </p>

      {!expenseOpen && !membersOpen && (
        <Button
          type="button"
          onClick={() => setExpenseOpen(true)}
          className="fixed right-4 bottom-5 z-40 h-14 rounded-full px-5 shadow-card-hover sm:right-8"
        >
          <Plus className="size-5" />
          记一笔
        </Button>
      )}

      <AddExpenseDialog
        open={expenseOpen}
        onOpenChange={setExpenseOpen}
        trip={trip}
        defaultPayerId={meId ?? selectedMemberId ?? trip.members[0]?.id}
        onAdd={onAddExpense}
      />
      {variant === "demo" ? (
        <MembersDialog open={membersOpen} onOpenChange={setMembersOpen} />
      ) : (
        <GroupMembersDialog
          open={membersOpen}
          onOpenChange={setMembersOpen}
          members={trip.members}
          meId={meId}
          inviteCode={inviteCode}
          createdBy={createdBy}
          onUpdateMyName={onUpdateMyName}
          onLeave={onLeave}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 flex-1 rounded-full text-sm font-medium transition-colors",
        active ? "bg-surface text-fg shadow-card" : "text-muted hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

function DemoBillActions() {
  const clearExpenses = useTripStore((s) => s.clearExpenses);
  const resetDemo = useTripStore((s) => s.resetDemo);
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="sm" onClick={() => clearExpenses()}>
        清空
      </Button>
      <Button variant="ghost" size="sm" onClick={() => resetDemo()}>
        <RotateCcw className="size-3.5" />
        示例
      </Button>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl bg-surface px-3 py-3 shadow-card sm:px-4 sm:py-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-display text-lg font-semibold tracking-tight tabular-nums sm:text-2xl">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-subtle">{hint}</p> : null}
    </div>
  );
}

export function TripBoard() {
  const trip = useTripStore((s) => s.trip);
  const meId = useTripStore((s) => s.meId);
  const setHydrated = useTripStore((s) => s.setHydrated);
  const renameTrip = useTripStore((s) => s.renameTrip);
  const addExpense = useTripStore((s) => s.addExpense);
  const removeExpense = useTripStore((s) => s.removeExpense);
  const setMeId = useTripStore((s) => s.setMeId);

  useTripSync();

  useEffect(() => {
    const result = useTripStore.persist.rehydrate();
    void Promise.resolve(result).then(() => setHydrated(true));
  }, [setHydrated]);

  return (
    <TripView
      trip={trip}
      meId={meId}
      variant="demo"
      onRename={renameTrip}
      onAddExpense={addExpense}
      onRemoveExpense={removeExpense}
      onSetMe={setMeId}
    />
  );
}
