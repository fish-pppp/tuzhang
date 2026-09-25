import { formatStamp } from "@/lib/split/date";
import { formatExpenseChange } from "@/lib/split/expense-edit";
import type { Expense, ExpenseEdit, Member } from "@/lib/split/types";

export function ExpenseEditHistory({
  edits,
  membersById,
  expensesById,
  onOpenExpense,
  empty = "还没有修改记录。",
}: {
  edits: ExpenseEdit[];
  membersById: Record<string, Member>;
  expensesById?: Record<string, Expense>;
  onOpenExpense?: (expense: Expense) => void;
  empty?: string;
}) {
  const nameOf = (id: string) => membersById[id]?.name ?? "未知";
  if (edits.length === 0) {
    return <p className="text-sm text-muted">{empty}</p>;
  }

  return (
    <ul className="space-y-2">
      {edits.map((edit) => {
        const expense = expensesById?.[edit.expenseId];
        const who = nameOf(edit.editedBy);
        const when = formatStamp(edit.editedAt) || "刚才";
        const body = (
          <>
            {expense ? <p className="truncate text-sm font-medium">{expense.title}</p> : null}
            <ul className={expense ? "mt-1 space-y-1" : "space-y-1"}>
              {edit.changes.map((change) => {
                const line = formatExpenseChange(change, nameOf);
                return (
                  <li key={`${edit.id}-${change.field}`} className="text-xs leading-5 text-muted">
                    <span className="text-fg">{line.label}</span> {line.before}
                    <span className="text-subtle"> → </span>
                    {line.after}
                  </li>
                );
              })}
            </ul>
            <p className="mt-1 text-xs text-subtle">
              {who} · {when}
            </p>
          </>
        );
        return (
          <li key={edit.id} className="rounded-xl bg-bg-elevated px-3 py-2.5">
            {expense && onOpenExpense ? (
              <button
                type="button"
                className="w-full text-left"
                onClick={() => onOpenExpense(expense)}
              >
                {body}
              </button>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
}
