import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { MemberAvatar } from "@/components/member-avatar";
import { Badge } from "@/components/ui/badge";
import {
  expenseSplitLabel,
  groupChipByPayer,
  groupOthersOweByPerson,
  personalBook,
  sortRowsByNewest,
  type PaidByMeRow,
  type PersonAaGroup,
  type PersonalBook,
  type ShareOfMineRow,
} from "@/lib/split/calc";
import { formatMoney } from "@/lib/split/money";
import type { Expense, Member, Trip } from "@/lib/split/types";
import { cn } from "@/lib/utils";

type Section = "paid" | "chip" | "settle";
type ListMode = "bills" | "people";

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
  const book = useMemo(() => personalBook(trip, meId), [trip, meId]);
  const me = trip.members.find((m) => m.id === meId);
  const [section, setSection] = useState<Section>(() => {
    if (!book) return "paid";
    if (book.paidByMe.length > 0) return "paid";
    if (book.INeedToChip.length > 0) return "chip";
    return "settle";
  });
  const [listMode, setListMode] = useState<ListMode>("bills");

  const paidRows = useMemo(
    () => (book ? sortRowsByNewest(book.paidByMe) : []),
    [book],
  );
  const chipRows = useMemo(
    () => (book ? sortRowsByNewest(book.INeedToChip) : []),
    [book],
  );
  const othersByPerson = useMemo(() => groupOthersOweByPerson(paidRows), [paidRows]);
  const chipByPayer = useMemo(() => groupChipByPayer(chipRows), [chipRows]);

  if (!book || !me) {
    return <p className="text-sm text-muted">找不到这个人的账单。</p>;
  }

  const memberMap = Object.fromEntries(trip.members.map((m) => [m.id, m]));
  const frontedTotal = paidRows.reduce((s, r) => s + r.expense.amountCents, 0);
  const myKeep = paidRows.reduce((s, r) => s + r.myShareCents, 0);
  const othersReturn = paidRows.reduce((s, r) => s + r.othersOweCents, 0);
  const chipTotal = chipRows.reduce((s, r) => s + r.myShareCents, 0);
  const settleCount = book.transfersIn.length + book.transfersOut.length;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-surface p-4 shadow-card lg:p-5">
        <div className="mb-4 flex items-center gap-3">
          <MemberAvatar member={me} size="md" selected />
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold">{me.name} 的 A 款</h2>
            <p className="text-xs text-muted">
              我先付出去的叫「我A的」，别人先付、我还要出的叫「要我A的」。
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <MiniStat label="我A了" value={formatMoney(book.paidCents)} />
          <MiniStat label="我该出" value={formatMoney(book.shareCents)} />
          <MiniStat
            label={book.netCents >= 0 ? "我应收" : "我还要付"}
            value={formatMoney(Math.abs(book.netCents))}
            tone={book.netCents > 0 ? "receive" : book.netCents < 0 ? "owe" : "muted"}
          />
        </div>
      </section>

      <div className="flex rounded-full bg-chip p-1">
        <SectionTab
          active={section === "paid"}
          onClick={() => setSection("paid")}
          count={paidRows.length}
        >
          我A的
        </SectionTab>
        <SectionTab
          active={section === "chip"}
          onClick={() => setSection("chip")}
          count={chipRows.length}
        >
          要我A的
        </SectionTab>
        <SectionTab
          active={section === "settle"}
          onClick={() => setSection("settle")}
          count={settleCount}
        >
          结账
        </SectionTab>
      </div>

      {section === "paid" ? (
        <PaidSection
          rows={paidRows}
          othersByPerson={othersByPerson}
          memberMap={memberMap}
          listMode={listMode}
          onListMode={setListMode}
          frontedTotal={frontedTotal}
          myKeep={myKeep}
          othersReturn={othersReturn}
        />
      ) : null}

      {section === "chip" ? (
        <ChipSection
          rows={chipRows}
          chipByPayer={chipByPayer}
          memberMap={memberMap}
          listMode={listMode}
          onListMode={setListMode}
          chipTotal={chipTotal}
        />
      ) : null}

      {section === "settle" ? (
        <SettleSection book={book} memberMap={memberMap} />
      ) : null}
    </div>
  );
}

function PaidSection({
  rows,
  othersByPerson,
  memberMap,
  listMode,
  onListMode,
  frontedTotal,
  myKeep,
  othersReturn,
}: {
  rows: PaidByMeRow[];
  othersByPerson: PersonAaGroup[];
  memberMap: Record<string, Member>;
  listMode: ListMode;
  onListMode: (mode: ListMode) => void;
  frontedTotal: number;
  myKeep: number;
  othersReturn: number;
}) {
  return (
    <section className="rounded-2xl bg-surface p-4 shadow-card lg:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold">我A了哪些钱</h3>
          <p className="mt-1 text-xs text-muted tabular-nums">
            {rows.length === 0
              ? "还没有你先付的账单。"
              : `${rows.length} 笔 · 一共 A 了 ${formatMoney(frontedTotal)} · 自己留 ${formatMoney(myKeep)} · 别人还我 ${formatMoney(othersReturn)}`}
          </p>
        </div>
        {rows.length > 0 ? (
          <ModeToggle mode={listMode} onChange={onListMode} />
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">记一笔并选自己付款，就会出现在这里。</p>
      ) : listMode === "people" ? (
        othersByPerson.length === 0 ? (
          <p className="text-sm text-muted">这几笔都只算你自己，没有人还要还你。</p>
        ) : (
          <ul className="space-y-3">
            {othersByPerson.map((group) => {
              const person = memberMap[group.memberId];
              if (!person) return null;
              return (
                <PersonAaCard
                  key={group.memberId}
                  person={person}
                  cents={group.cents}
                  rows={group.rows}
                  tone="receive"
                  verb="欠我"
                />
              );
            })}
          </ul>
        )
      ) : (
        <ul className="space-y-3">
          {rows.map(({ expense, myShareCents, othersOweCents, others }) => (
            <li
              key={expense.id}
              className="rounded-xl bg-bg-elevated px-3 py-3"
            >
              <ExpenseHead expense={expense} />
              <p className="mt-1 text-xs text-muted">
                {expenseSplitLabel(expense)}
              </p>
              <div className="mt-3 flex items-baseline justify-between gap-3">
                <span className="text-sm text-muted">我A了</span>
                <span className="font-display text-xl font-semibold tabular-nums">
                  {formatMoney(expense.amountCents)}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <SplitChip label="自己留" value={formatMoney(myShareCents)} />
                <SplitChip
                  label="别人还我"
                  value={formatMoney(othersOweCents)}
                  tone={othersOweCents > 0 ? "receive" : "muted"}
                />
              </div>
              {others.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {others.map((slice) => {
                    const person = memberMap[slice.memberId];
                    if (!person) return null;
                    return (
                      <li key={slice.memberId} className="flex items-center gap-2">
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
                <div className="mt-3">
                  <Badge variant="settled">只算我自己</Badge>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ChipSection({
  rows,
  chipByPayer,
  memberMap,
  listMode,
  onListMode,
  chipTotal,
}: {
  rows: ShareOfMineRow[];
  chipByPayer: PersonAaGroup[];
  memberMap: Record<string, Member>;
  listMode: ListMode;
  onListMode: (mode: ListMode) => void;
  chipTotal: number;
}) {
  return (
    <section className="rounded-2xl bg-surface p-4 shadow-card lg:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold">要我A的钱</h3>
          <p className="mt-1 text-xs text-muted tabular-nums">
            {rows.length === 0
              ? "没有别人先付、你还要出的账单。"
              : `${rows.length} 笔 · 一共要 A ${formatMoney(chipTotal)}`}
          </p>
        </div>
        {rows.length > 0 ? (
          <ModeToggle mode={listMode} onChange={onListMode} />
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">别人记了你参与的账单，会出现在这里。</p>
      ) : listMode === "people" ? (
        <ul className="space-y-3">
          {chipByPayer.map((group) => {
            const person = memberMap[group.memberId];
            if (!person) return null;
            return (
              <PersonAaCard
                key={group.memberId}
                person={person}
                cents={group.cents}
                rows={group.rows}
                tone="owe"
                verb="我要A"
              />
            );
          })}
        </ul>
      ) : (
        <ul className="space-y-3">
          {rows.map(({ expense, myShareCents }) => {
            const payer = memberMap[expense.payerId];
            const n = expense.participantIds.length;
            return (
              <li
                key={expense.id}
                className="flex items-start gap-3 rounded-xl bg-bg-elevated px-3 py-3"
              >
                <MemberAvatar
                  member={payer ?? { id: "x", name: "?", avatar: null }}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <ExpenseHead expense={expense} hideAmount />
                  <p className="mt-1 text-xs text-muted">
                    {payer?.name ?? "未知"} 先付 {formatMoney(expense.amountCents)}
                    {n > 0 ? ` · ${expenseSplitLabel(expense)}` : ""}
                    {n > 0 && !expense.shares?.length
                      ? ` · 人均 ${formatMoney(Math.round(expense.amountCents / n))}`
                      : ""}
                  </p>
                  <div className="mt-3 flex items-baseline justify-between gap-3">
                    <span className="text-sm text-muted">我要A</span>
                    <span className="font-display text-xl font-semibold tabular-nums text-owe">
                      {formatMoney(myShareCents)}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function SettleSection({
  book,
  memberMap,
}: {
  book: PersonalBook;
  memberMap: Record<string, Member>;
}) {
  return (
    <section className="rounded-2xl bg-surface p-4 shadow-card lg:p-5">
      <h3 className="mb-1 font-display text-lg font-semibold">怎么跟我结</h3>
      <p className="mb-3 text-xs text-muted">
        把上面所有 A 款轧差之后，实际要转的钱。
      </p>
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
  );
}

function PersonAaCard({
  person,
  cents,
  rows,
  tone,
  verb,
}: {
  person: Member;
  cents: number;
  rows: Array<{ expense: Expense; cents: number }>;
  tone: "receive" | "owe";
  verb: string;
}) {
  return (
    <li className="rounded-xl bg-bg-elevated px-3 py-3">
      <div className="flex items-center gap-2">
        <MemberAvatar member={person} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{person.name}</p>
          <p className="text-xs text-muted">{rows.length} 笔</p>
        </div>
        <p
          className={cn(
            "shrink-0 text-sm font-semibold tabular-nums",
            tone === "receive" ? "text-receive" : "text-owe",
          )}
        >
          {verb} {formatMoney(cents)}
        </p>
      </div>
      <ul className="mt-3 space-y-2 border-t border-border pt-2">
        {rows.map((row) => (
          <li
            key={row.expense.id}
            className="flex items-baseline justify-between gap-3 text-sm"
          >
            <span className="min-w-0 truncate">
              {row.expense.title}
              {formatDay(row.expense.createdAt) ? (
                <span className="ml-1.5 text-xs text-subtle">
                  {formatDay(row.expense.createdAt)}
                </span>
              ) : null}
            </span>
            <span
              className={cn(
                "shrink-0 tabular-nums",
                tone === "receive" ? "text-receive" : "text-owe",
              )}
            >
              {formatMoney(row.cents)}
            </span>
          </li>
        ))}
      </ul>
    </li>
  );
}

function ExpenseHead({
  expense,
  hideAmount = false,
}: {
  expense: Expense;
  hideAmount?: boolean;
}) {
  const day = formatDay(expense.createdAt);
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate font-medium">{expense.title}</p>
        {day ? <p className="text-xs text-subtle">{day}</p> : null}
      </div>
      {hideAmount ? null : (
        <p className="shrink-0 text-sm text-muted tabular-nums">
          账单 {formatMoney(expense.amountCents)}
        </p>
      )}
    </div>
  );
}

function SplitChip({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: string;
  tone?: "muted" | "receive";
}) {
  return (
    <div className="rounded-lg bg-surface px-2.5 py-2">
      <p className="text-xs text-muted">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-sm font-medium tabular-nums",
          tone === "receive" && "text-receive",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: ListMode;
  onChange: (mode: ListMode) => void;
}) {
  return (
    <div className="flex rounded-full bg-chip p-0.5">
      <ModeButton active={mode === "bills"} onClick={() => onChange("bills")}>
        按账单
      </ModeButton>
      <ModeButton active={mode === "people"} onClick={() => onChange("people")}>
        按人
      </ModeButton>
    </div>
  );
}

function ModeButton({
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
      aria-pressed={active}
      className={cn(
        "h-8 rounded-full px-3 text-xs font-medium transition-colors",
        active ? "bg-surface text-fg shadow-card" : "text-muted hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

function SectionTab({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex h-9 flex-1 items-center justify-center gap-1 rounded-full text-sm font-medium transition-colors",
        active ? "bg-surface text-fg shadow-card" : "text-muted hover:text-fg",
      )}
    >
      <span>{children}</span>
      <span
        className={cn(
          "tabular-nums",
          active ? "text-fg" : "text-subtle",
        )}
      >
        {count}
      </span>
    </button>
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
