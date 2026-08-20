import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Plus, RotateCcw, Users } from "lucide-react";
import { AddExpenseDialog } from "@/components/add-expense-dialog";
import { AuthSlot } from "@/components/auth-slot";
import { MemberAvatar } from "@/components/member-avatar";
import { MembersDialog } from "@/components/members-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { computeLedger, expenseInvolves } from "@/lib/split/calc";
import { formatMoney } from "@/lib/split/money";
import { useTripStore } from "@/lib/split/store";
import { useTripSync } from "@/lib/split/use-trip-sync";
import { cn } from "@/lib/utils";

export function TripBoard() {
  const trip = useTripStore((s) => s.trip);
  const selectedMemberId = useTripStore((s) => s.selectedMemberId);
  const selectMember = useTripStore((s) => s.selectMember);
  const setHydrated = useTripStore((s) => s.setHydrated);
  const renameTrip = useTripStore((s) => s.renameTrip);
  const removeExpense = useTripStore((s) => s.removeExpense);
  const resetDemo = useTripStore((s) => s.resetDemo);
  const clearExpenses = useTripStore((s) => s.clearExpenses);

  const [expenseOpen, setExpenseOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);

  useTripSync();

  useEffect(() => {
    const result = useTripStore.persist.rehydrate();
    void Promise.resolve(result).then(() => setHydrated(true));
  }, [setHydrated]);

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

  const visibleExpenses = selectedMemberId
    ? trip.expenses.filter((e) => expenseInvolves(e, selectedMemberId))
    : trip.expenses;

  const selectedName = selectedMemberId
    ? memberMap[selectedMemberId]?.name
    : null;

  return (
    <div className="relative mx-auto min-h-dvh max-w-5xl px-4 pb-28 pt-6 sm:px-6">
      <header className="mb-8 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-[0.18em] text-muted uppercase">
            途账
          </p>
          <input
            value={trip.name}
            onChange={(e) => renameTrip(e.target.value)}
            className="mt-1 w-full max-w-md bg-transparent font-display text-3xl font-semibold tracking-tight text-fg outline-none sm:text-4xl"
            aria-label="旅行名称"
          />
          <p className="mt-1 text-sm text-muted">
            {trip.members.length} 人同行 · 账单当场算清
          </p>
        </div>
        <AuthSlot />
      </header>

      <section className="-mx-4 mb-6 overflow-x-auto px-4 pb-2 sm:mx-0 sm:overflow-visible sm:px-0">
        <ul className="flex min-w-max gap-2 sm:min-w-0 sm:justify-between">
          {trip.members.map((member, i) => {
            const row = byId[member.id];
            const net = row?.netCents ?? 0;
            const selected = selectedMemberId === member.id;
            return (
              <li
                key={member.id}
                className="stagger-item min-w-16 flex-1"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <button
                  type="button"
                  onClick={() => selectMember(member.id)}
                  className={cn(
                    "flex w-full flex-col items-center gap-2 rounded-xl px-1 py-2 transition-colors duration-150",
                    selected ? "bg-chip" : "hover:bg-chip/70",
                  )}
                >
                  <MemberAvatar member={member} size="lg" selected={selected} />
                  <span className="max-w-full truncate px-0.5 text-center text-xs font-medium whitespace-nowrap sm:text-sm">
                    {member.name}
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
              管理
            </Button>
          </div>
          <ul className="divide-y divide-border">
            {trip.members.map((member) => {
              const row = byId[member.id];
              if (!row) return null;
              const selected = selectedMemberId === member.id;
              return (
                <li key={member.id}>
                  <button
                    type="button"
                    onClick={() => selectMember(member.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-1 py-3 text-left transition-colors",
                      selected ? "bg-chip" : "hover:bg-chip/60",
                    )}
                  >
                    <MemberAvatar member={member} size="md" selected={selected} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-medium">{member.name}</span>
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
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => clearExpenses()}>
              清空
            </Button>
            <Button variant="ghost" size="sm" onClick={() => resetDemo()}>
              <RotateCcw className="size-3.5" />
              示例
            </Button>
          </div>
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
                    onClick={() => removeExpense(expense.id)}
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

      <Separator className="my-8" />
      <p className="pb-2 text-center text-xs text-subtle">
        垫付、AA、结余会随每一笔记账即时更新。
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

      <AddExpenseDialog open={expenseOpen} onOpenChange={setExpenseOpen} />
      <MembersDialog open={membersOpen} onOpenChange={setMembersOpen} />
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
