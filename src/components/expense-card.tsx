import { ChevronRight, Image } from "lucide-react";
import { expenseInvolves } from "@/lib/split/calc";
import { groupByDay } from "@/lib/split/date";
import { expenseCardLine } from "@/lib/split/expense-line";
import { formatMoney } from "@/lib/split/money";
import { isSettledExpense, type Expense, type Member } from "@/lib/split/types";
import { cn } from "@/lib/utils";

export function ExpenseCard({
  expense,
  meId,
  payer,
  onOpen,
}: {
  expense: Expense;
  meId: string | null;
  payer: Member | undefined;
  onOpen: () => void;
}) {
  const payerName = payer?.name ?? "未知";
  const photoCount = expense.photos?.length ?? 0;
  const settled = isSettledExpense(expense);
  const line = expenseCardLine(expense, meId, payerName);
  const mine = Boolean(meId && expenseInvolves(expense, meId));

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-xl bg-surface px-4 py-3 text-left shadow-card transition-colors hover:bg-chip/60"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate font-medium">{expense.title}</p>
          <p className="shrink-0 font-display text-base font-semibold tabular-nums">
            {formatMoney(expense.amountCents)}
          </p>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p
            className={cn(
              "truncate text-xs tabular-nums",
              mine ? "text-owe" : "text-muted",
            )}
          >
            {line}
          </p>
          <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-subtle">
            {photoCount > 0 ? (
              <span className="inline-flex items-center gap-0.5">
                <Image className="size-3" />
                {photoCount}
              </span>
            ) : null}
            {settled ? <span>已结</span> : null}
          </span>
        </div>
      </div>
      <ChevronRight className="size-4 shrink-0 text-subtle" />
    </button>
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
                  payer={membersById[expense.payerId]}
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
