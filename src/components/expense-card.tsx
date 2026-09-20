import { Image } from "lucide-react";
import { MemberAvatar } from "@/components/member-avatar";
import { expenseInvolves } from "@/lib/split/calc";
import { groupByDay } from "@/lib/split/date";
import { expenseCardLine, expenseCardPeopleIds } from "@/lib/split/expense-line";
import { formatMoney } from "@/lib/split/money";
import { isSettledExpense, type Expense, type Member } from "@/lib/split/types";
import { cn } from "@/lib/utils";

const MAX_CARD_FACES = 7;

export function ExpenseCard({
  expense,
  meId,
  membersById,
  onOpen,
}: {
  expense: Expense;
  meId: string | null;
  membersById: Record<string, Member>;
  onOpen: () => void;
}) {
  const payer = membersById[expense.payerId];
  const payerName = payer?.name ?? "未知";
  const photoCount = expense.photos?.length ?? 0;
  const settled = isSettledExpense(expense);
  const line = expenseCardLine(expense, meId, payerName);
  const mine = Boolean(meId && expenseInvolves(expense, meId));
  const peopleNames = expenseCardPeopleIds(expense)
    .map((id) => membersById[id]?.name)
    .filter((name): name is string => Boolean(name));

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${expense.title}，${payerName}付，${peopleNames.join("、")}，${line}`}
      className="flex w-full flex-col gap-1.5 rounded-xl bg-surface px-3 py-2.5 text-left shadow-card transition-colors hover:bg-chip/60 sm:px-4 sm:py-3"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate font-medium">{expense.title}</p>
        <p className="shrink-0 font-display text-base font-semibold tabular-nums">
          {formatMoney(expense.amountCents)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <CardPeople expense={expense} membersById={membersById} />
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {mine ? (
            <p className="text-xs tabular-nums text-owe">{line}</p>
          ) : null}
          {photoCount > 0 ? (
            <span className="inline-flex items-center gap-0.5 text-[11px] text-subtle">
              <Image className="size-3" />
              {photoCount}
            </span>
          ) : null}
          {settled ? <span className="text-[11px] text-subtle">已结</span> : null}
        </div>
      </div>
    </button>
  );
}

function CardPeople({
  expense,
  membersById,
}: {
  expense: Expense;
  membersById: Record<string, Member>;
}) {
  const people = expenseCardPeopleIds(expense)
    .map((id) => membersById[id])
    .filter((member): member is Member => Boolean(member));
  if (people.length === 0) return null;

  const overflow =
    people.length > MAX_CARD_FACES ? people.length - (MAX_CARD_FACES - 1) : 0;
  const visible = overflow > 0 ? people.slice(0, MAX_CARD_FACES - 1) : people;
  const payer = visible.find((person) => person.id === expense.payerId) ?? visible[0];
  const others = visible.filter((person) => person.id !== payer?.id);

  return (
    <div className="flex min-w-0 items-center">
      {payer ? (
        <span className="flex min-w-0 shrink-0 items-center">
          <MemberAvatar
            member={payer}
            size="xs"
            className="outline-2 -outline-offset-2 outline-surface"
          />
          <span className="ml-0.5 flex min-w-0 items-center text-[11px] leading-none text-muted">
            <span className="max-w-12 truncate">{payer.name}</span>
            <span className="shrink-0">付</span>
          </span>
        </span>
      ) : null}
      {others.length > 0 ? (
        <span className="ml-1.5 flex min-w-0 items-center">
          {others.map((person, i) => (
            <span
              key={person.id}
              className={cn("relative shrink-0", i > 0 && "-ml-1.5")}
            >
              <MemberAvatar
                member={person}
                size="xs"
                className="outline-2 -outline-offset-2 outline-surface"
              />
            </span>
          ))}
        </span>
      ) : null}
      {overflow > 0 ? (
        <span className="ml-1 shrink-0 text-[11px] text-subtle">+{overflow}</span>
      ) : null}
    </div>
  );
}

export function ExpenseDayList({
  expenses,
  meId,
  membersById,
  onOpen,
  empty,
}: {
  expenses: Expense[];
  meId: string | null;
  membersById: Record<string, Member>;
  onOpen: (expense: Expense) => void;
  empty: string;
}) {
  if (expenses.length === 0) {
    return <p className="py-10 text-center text-sm text-muted">{empty}</p>;
  }

  return (
    <div className="space-y-5">
      {groupByDay(expenses).map((day) => (
        <section key={day.key}>
          <h3 className="mb-2 px-1 text-xs font-medium text-muted">{day.label}</h3>
          <ul className="space-y-2">
            {day.items.map((expense) => (
              <li key={expense.id}>
                <ExpenseCard
                  expense={expense}
                  meId={meId}
                  membersById={membersById}
                  onOpen={() => onOpen(expense)}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
