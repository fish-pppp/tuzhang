import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { MemberAvatar } from "@/components/member-avatar";
import { Badge } from "@/components/ui/badge";
import { personalBook } from "@/lib/split/calc";
import { formatMoney } from "@/lib/split/money";
import type { Expense, Trip } from "@/lib/split/types";
import { cn } from "@/lib/utils";

function formatDay(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    timeZone: "Asia/Shanghai",
  }).format(d);
}

export function MyLedger({ trip, meId }: { trip: Trip; meId: string }) {
  const book = personalBook(trip, meId);
  const me = trip.members.find((m) => m.id === meId);
  if (!book || !me) {
    return <p className="text-sm text-muted">找不到这个人的账单。</p>;
  }
  const memberMap = Object.fromEntries(trip.members.map((m) => [m.id, m]));
  const frontedTotal = book.paidByMe.reduce((s, r) => s + r.expense.amountCents, 0);
  const myKeep = book.paidByMe.reduce((s, r) => s + r.myShareCents, 0);
  const chipTotal = book.INeedToChip.reduce((s, r) => s + r.myShareCents, 0);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-surface p-4 shadow-card lg:p-5">
        <div className="mb-4 flex items-center gap-3">
          <MemberAvatar member={me} size="md" selected />
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold">{me.name} 的账本</h2>
            <p className="text-xs text-muted">
              你垫过的大头、别人该还你的，以及你在别处要摊的份。
            </p>
          </div>
        </div>
        <p className="mb-4 rounded-xl bg-bg-elevated px-3 py-3 text-sm leading-relaxed text-muted">
          {book.paidByMe.length > 0 ? (
            <>
              你先付了 {book.paidByMe.length} 笔，一共{" "}
              <span className="font-medium text-fg tabular-nums">
                {formatMoney(frontedTotal)}
              </span>
              ，其中自己该留{" "}
              <span className="tabular-nums">{formatMoney(myKeep)}</span>
              。
            </>
          ) : (
            "你还没有垫过钱。"
          )}{" "}
          {book.INeedToChip.length > 0 ? (
            <>
              另外有 {book.INeedToChip.length} 笔是别人先付、你要摊的，共{" "}
              <span className="font-medium text-owe tabular-nums">
                {formatMoney(chipTotal)}
              </span>
              。
            </>
          ) : null}
        </p>
        <div className="grid grid-cols-3 gap-2">
          <MiniStat label="我已付" value={formatMoney(book.paidCents)} />
          <MiniStat label="我应付" value={formatMoney(book.shareCents)} />
          <MiniStat
            label={book.netCents >= 0 ? "我应收" : "我还要付"}
            value={formatMoney(Math.abs(book.netCents))}
            tone={book.netCents > 0 ? "receive" : book.netCents < 0 ? "owe" : "muted"}
          />
        </div>
      </section>

      <section className="rounded-2xl bg-surface p-4 shadow-card lg:p-5">
        <h3 className="mb-1 font-display text-lg font-semibold">我垫的</h3>
        <p className="mb-3 text-xs text-muted">你先付的大头。每个人该还你多少，写在下面。</p>
        {book.paidByMe.length === 0 ? (
          <p className="text-sm text-muted">你还没有垫过钱。</p>
        ) : (
          <ul className="divide-y divide-border">
            {book.paidByMe.map(({ expense, myShareCents, othersOweCents, others }) => (
              <li key={expense.id} className="py-3">
                <ExpenseHead expense={expense} />
                <p className="mt-1 text-xs text-muted tabular-nums">
                  {expense.participantIds.length} 人 AA · 我自己承担{" "}
                  {formatMoney(myShareCents)}
                </p>
                {others.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {others.map((slice) => {
                      const person = memberMap[slice.memberId];
                      if (!person) return null;
                      return (
                        <li
                          key={slice.memberId}
                          className="flex items-center gap-2 rounded-lg bg-bg-elevated px-2.5 py-2"
                        >
                          <MemberAvatar member={person} size="sm" />
                          <span className="min-w-0 flex-1 truncate text-sm">
                            {person.name}
                          </span>
                          <span className="text-sm font-medium tabular-nums text-receive">
                            欠我 {formatMoney(slice.cents)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="mt-2">
                    <Badge variant="settled">只算我自己</Badge>
                  </div>
                )}
                {othersOweCents > 0 ? (
                  <p className="mt-2 text-xs text-receive tabular-nums">
                    这一笔别人一共欠我 {formatMoney(othersOweCents)}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl bg-surface p-4 shadow-card lg:p-5">
        <h3 className="mb-1 font-display text-lg font-semibold">我要摊的</h3>
        <p className="mb-3 text-xs text-muted">别人先付的地方，你需要出的那一份。</p>
        {book.INeedToChip.length === 0 ? (
          <p className="text-sm text-muted">没有需要你摊的账单。</p>
        ) : (
          <ul className="divide-y divide-border">
            {book.INeedToChip.map(({ expense, myShareCents }) => {
              const payer = memberMap[expense.payerId];
              return (
                <li key={expense.id} className="flex items-start gap-3 py-3">
                  <MemberAvatar
                    member={payer ?? { id: "x", name: "?", avatar: null }}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate font-medium">{expense.title}</p>
                      <p className="shrink-0 font-medium text-owe tabular-nums">
                        我出 {formatMoney(myShareCents)}
                      </p>
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      {formatDay(expense.createdAt)}
                      {formatDay(expense.createdAt) ? " · " : ""}
                      {payer?.name ?? "未知"} 付了 {formatMoney(expense.amountCents)} ·{" "}
                      {expense.participantIds.length} 人 AA
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl bg-surface p-4 shadow-card lg:p-5">
        <h3 className="mb-3 font-display text-lg font-semibold">怎么跟我结</h3>
        {book.transfersIn.length === 0 && book.transfersOut.length === 0 ? (
          <p className="text-sm text-muted">和你相关的账已经结清。</p>
        ) : (
          <ul className="space-y-2">
            {book.transfersIn.map((t) => {
              const from = memberMap[t.fromId];
              if (!from) return null;
              return (
                <li
                  key={`in-${t.fromId}`}
                  className="flex items-center gap-2 rounded-lg bg-bg-elevated px-3 py-2.5"
                >
                  <ArrowDownRight className="size-4 text-receive" />
                  <MemberAvatar member={from} size="sm" />
                  <p className="min-w-0 flex-1 text-sm">
                    <span className="font-medium">{from.name}</span>
                    <span className="text-muted"> 转给你 </span>
                    <span className="font-medium tabular-nums text-receive">
                      {formatMoney(t.cents)}
                    </span>
                  </p>
                </li>
              );
            })}
            {book.transfersOut.map((t) => {
              const to = memberMap[t.toId];
              if (!to) return null;
              return (
                <li
                  key={`out-${t.toId}`}
                  className="flex items-center gap-2 rounded-lg bg-bg-elevated px-3 py-2.5"
                >
                  <ArrowUpRight className="size-4 text-owe" />
                  <MemberAvatar member={to} size="sm" />
                  <p className="min-w-0 flex-1 text-sm">
                    <span className="text-muted">你转给 </span>
                    <span className="font-medium">{to.name}</span>
                    <span className="font-medium tabular-nums text-owe">
                      {" "}
                      {formatMoney(t.cents)}
                    </span>
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function ExpenseHead({ expense }: { expense: Expense }) {
  const day = formatDay(expense.createdAt);
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate font-medium">{expense.title}</p>
        {day ? <p className="text-xs text-subtle">{day}</p> : null}
      </div>
      <p className="shrink-0 font-medium tabular-nums">
        {formatMoney(expense.amountCents)}
      </p>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: string;
  tone?: "muted" | "receive" | "owe";
}) {
  return (
    <div className="rounded-xl bg-bg-elevated px-3 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p
        className={cn(
          "mt-1 font-display text-base font-semibold tabular-nums sm:text-lg",
          tone === "receive" && "text-receive",
          tone === "owe" && "text-owe",
        )}
      >
        {value}
      </p>
    </div>
  );
}
