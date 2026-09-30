import { shareForMember } from "./calc";
import {
  formatSpendPercent,
  summarizeSpend,
  type SpendSummary,
  type SpendSummaryLine,
} from "./spend-summary.mjs";
import { isActiveExpense, type Expense, type Trip } from "./types";

export { normalizeSpendPartId, spendTitleKey } from "./spend-summary.mjs";

export type { SpendSummary, SpendSummaryLine };

export type SpendBillInput = {
  id: string;
  groupId: string;
  groupName: string;
  title: string;
  amountCents: number;
  myShareCents: number;
  paidByMe: boolean;
  createdAt: string;
  settled: boolean;
};

/** One active bill this person paid or was charged for. Null when they are not on it. */
export function toSpendBill(
  expense: Expense,
  memberId: string,
  group: { id: string; name: string },
): SpendBillInput | null {
  if (!isActiveExpense(expense)) return null;
  const myShareCents = shareForMember(expense, memberId);
  const paidByMe = expense.payerId === memberId;
  if (myShareCents <= 0 && !paidByMe) return null;
  return {
    id: expense.id,
    groupId: group.id,
    groupName: group.name,
    title: expense.title,
    amountCents: expense.amountCents,
    myShareCents,
    paidByMe,
    createdAt: expense.createdAt,
    settled: Boolean(expense.settlementId),
  };
}

export function spendBillsForTrip(trip: Trip, memberId: string): SpendBillInput[] {
  const group = { id: trip.id, name: trip.name };
  const bills: SpendBillInput[] = [];
  for (const expense of trip.expenses) {
    const bill = toSpendBill(expense, memberId, group);
    if (bill) bills.push(bill);
  }
  return bills;
}

export function buildSpendSummary(
  bills: SpendBillInput[],
  partOverrides?: Readonly<Record<string, string>> | null,
): SpendSummary {
  return summarizeSpend(bills, partOverrides);
}

export function formatSpendSharePercent(value: number): string {
  return formatSpendPercent(value);
}

export type SpendSearch = { demo: true | undefined; groupId: string | undefined };

export function spendSearch(demo: boolean, groupId?: string): SpendSearch {
  if (demo) return { demo: true, groupId: undefined };
  return { demo: undefined, groupId };
}

export type SpendLine = SpendSummaryLine;
