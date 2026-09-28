import { expenseInvolves } from "./calc";
import { formatShareAmount, shareRows } from "./shares";
import type { Expense } from "./types";

/** Payer first, then the other people on the bill, no duplicates. */
export function expenseCardPeopleIds(expense: Expense): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const id of [expense.payerId, ...expense.participantIds]) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function expenseCardLine(expense: Expense, meId: string | null, payerName: string): string {
  if (meId && expenseInvolves(expense, meId)) {
    const row = shareRows(expense).find((slice) => slice.memberId === meId);
    return `我要付 ${formatShareAmount(
      expense.currency ?? "CNY",
      row?.cents ?? 0,
      row?.originalMinor ?? null,
    )}`;
  }
  return `${payerName}付`;
}
