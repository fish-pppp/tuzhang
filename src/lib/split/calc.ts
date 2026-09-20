import { resolveShares } from "./shares";
import type { Expense, Ledger, PersonLedger, Transfer, Trip } from "./types";
import { isActiveExpense, isOpenExpense } from "./types";

export { equalShares, resolveShares, splitShares } from "./shares";

export type ShareSlice = { memberId: string; cents: number };

export function shareBreakdown(expense: Expense): ShareSlice[] {
  return resolveShares(expense);
}

export function shareForMember(expense: Expense, memberId: string): number {
  return shareBreakdown(expense).find((s) => s.memberId === memberId)?.cents ?? 0;
}

export function computeLedger(trip: Trip): Ledger {
  const paid = new Map<string, number>();
  const share = new Map<string, number>();
  for (const m of trip.members) {
    paid.set(m.id, 0);
    share.set(m.id, 0);
  }

  const allowed = new Set(trip.members.map((m) => m.id));
  let totalCents = 0;
  for (const expense of trip.expenses) {
    if (!isOpenExpense(expense)) continue;
    const slices = resolveShares(expense, allowed);
    if (slices.length === 0 || expense.amountCents <= 0) continue;
    totalCents += expense.amountCents;
    if (paid.has(expense.payerId)) {
      paid.set(expense.payerId, (paid.get(expense.payerId) ?? 0) + expense.amountCents);
    }
    for (const slice of slices) {
      if (!share.has(slice.memberId)) continue;
      share.set(slice.memberId, (share.get(slice.memberId) ?? 0) + slice.cents);
    }
  }

  const perPerson: PersonLedger[] = trip.members.map((m) => {
    const paidCents = paid.get(m.id) ?? 0;
    const shareCents = share.get(m.id) ?? 0;
    return {
      memberId: m.id,
      paidCents,
      shareCents,
      netCents: paidCents - shareCents,
    };
  });

  const transfers = settle(perPerson);
  const unsettledCents = perPerson.reduce(
    (sum, p) => sum + Math.max(0, p.netCents),
    0,
  );

  return { totalCents, perPerson, transfers, unsettledCents };
}

function settle(perPerson: PersonLedger[]): Transfer[] {
  const debtors = perPerson
    .filter((p) => p.netCents < 0)
    .map((p) => ({ id: p.memberId, cents: -p.netCents }))
    .sort((a, b) => b.cents - a.cents);
  const creditors = perPerson
    .filter((p) => p.netCents > 0)
    .map((p) => ({ id: p.memberId, cents: p.netCents }))
    .sort((a, b) => b.cents - a.cents);

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];
    if (!d || !c) break;
    const amount = Math.min(d.cents, c.cents);
    if (amount > 0) {
      transfers.push({ fromId: d.id, toId: c.id, cents: amount });
      d.cents -= amount;
      c.cents -= amount;
    }
    if (d.cents <= 0) i += 1;
    if (c.cents <= 0) j += 1;
  }
  return transfers;
}

export function expenseInvolves(expense: Expense, memberId: string): boolean {
  return expense.payerId === memberId || expense.participantIds.includes(memberId);
}

export type PaidByMeRow = {
  expense: Expense;
  myShareCents: number;
  othersOweCents: number;
  others: ShareSlice[];
};

export type ShareOfMineRow = {
  expense: Expense;
  myShareCents: number;
};

export type PersonalBook = {
  memberId: string;
  paidCents: number;
  shareCents: number;
  netCents: number;
  paidByMe: PaidByMeRow[];
  INeedToChip: ShareOfMineRow[];
  transfersIn: Transfer[];
  transfersOut: Transfer[];
};

export function personalBook(trip: Trip, memberId: string): PersonalBook | null {
  const ledger = computeLedger(trip);
  const me = ledger.perPerson.find((p) => p.memberId === memberId);
  if (!me) return null;
  const paidByMe: PaidByMeRow[] = trip.expenses
    .filter((e) => isOpenExpense(e) && e.payerId === memberId)
    .map((expense) => {
      const slices = shareBreakdown(expense);
      const myShareCents = slices.find((s) => s.memberId === memberId)?.cents ?? 0;
      const others = slices.filter((s) => s.memberId !== memberId);
      return {
        expense,
        myShareCents,
        othersOweCents: others.reduce((sum, s) => sum + s.cents, 0),
        others,
      };
    });
  const INeedToChip: ShareOfMineRow[] = trip.expenses
    .filter(
      (e) =>
        isOpenExpense(e) &&
        e.payerId !== memberId &&
        e.participantIds.includes(memberId),
    )
    .map((expense) => ({
      expense,
      myShareCents: shareForMember(expense, memberId),
    }));
  return {
    memberId,
    paidCents: me.paidCents,
    shareCents: me.shareCents,
    netCents: me.netCents,
    paidByMe,
    INeedToChip,
    transfersIn: ledger.transfers.filter((t) => t.toId === memberId),
    transfersOut: ledger.transfers.filter((t) => t.fromId === memberId),
  };
}

/** Paid / share / net for one member without building a full trip ledger. */
export function memberBalance(
  expenses: Expense[],
  memberId: string,
): { paidCents: number; shareCents: number; netCents: number; expenseCount: number } {
  let paidCents = 0;
  let shareCents = 0;
  for (const expense of expenses) {
    if (!isOpenExpense(expense)) continue;
    if (expense.payerId === memberId) paidCents += expense.amountCents;
    shareCents += shareForMember(expense, memberId);
  }
  const openCount = expenses.filter(isOpenExpense).length;
  return {
    paidCents,
    shareCents,
    netCents: paidCents - shareCents,
    expenseCount: openCount,
  };
}

export function expenseSplitLabel(expense: Expense): string {
  const n = expense.participantIds.length;
  if (expense.shares && expense.shares.length > 0) {
    return `${n} 人自定义`;
  }
  return `${n} 人 AA`;
}

/** Count active bills (including already-settled ones) for history totals. */
export function activeExpenseCount(expenses: Expense[]): number {
  return expenses.filter(isActiveExpense).length;
}

/** Lifetime spend still on the books, including already-settled bills. */
export function activeTotalCents(expenses: Expense[]): number {
  return expenses
    .filter(isActiveExpense)
    .reduce((sum, expense) => sum + expense.amountCents, 0);
}
