import { expenseInvolves, shareForMember } from "./calc";
import { formatMoney } from "./money";
import type { Expense } from "./types";

export function expenseCardLine(
  expense: Expense,
  meId: string | null,
  payerName: string,
): string {
  if (meId && expenseInvolves(expense, meId)) {
    return `我要付 ${formatMoney(shareForMember(expense, meId))}`;
  }
  return `${payerName}付`;
}
